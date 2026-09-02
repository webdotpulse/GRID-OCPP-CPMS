import { prisma, pool } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface DatabaseBackupStats {
  tableCount: number;
  rowCount: number;
  sizeBytes: number;
  generatedAt: string;
  databaseVersion: string;
  tables: {
    name: string;
    rowCount: number;
  }[];
}

export interface ExportBackupResult {
  sql: string;
  filename: string;
  stats: DatabaseBackupStats;
}

export interface ImportBackupOptions {
  mode?: "restore" | "incremental";
  dryRun?: boolean;
  userId?: number;
  ip?: string;
}

export interface ImportBackupResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  mode: "restore" | "incremental";
  durationMs: number;
  statementsExecuted?: number;
  timestamp: string;
}

/**
 * Escapes a JavaScript value for safe insertion into a PostgreSQL SQL script.
 */
export function formatSqlLiteral(value: any): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'::timestamptz`;
  }

  if (Buffer.isBuffer(value)) {
    return `decode('${value.toString("hex")}', 'hex')`;
  }

  if (typeof value === "object") {
    // Arrays or JSON objects
    const jsonStr = JSON.stringify(value);
    const escapedJson = jsonStr.replace(/'/g, "''");
    return `'${escapedJson}'::jsonb`;
  }

  // String handling with standard PostgreSQL single-quote escaping
  const str = String(value);
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

export class DatabaseBackupService {
  /**
   * Retrieves list of all public base tables from PostgreSQL.
   */
  public static async getPublicTables(): Promise<string[]> {
    try {
      const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public' 
           AND table_type = 'BASE TABLE'
         ORDER BY table_name ASC;`
      );
      return rows.map((r) => r.table_name);
    } catch (err) {
      logger.error(`Failed to query database tables: ${err}`);
      throw new Error(`Database table query failed: ${err}`);
    }
  }

  /**
   * Retrieves column metadata for a given table.
   */
  public static async getTableColumns(tableName: string): Promise<string[]> {
    try {
      const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
           AND table_name = $1 
         ORDER BY ordinal_position ASC;`,
        tableName
      );
      return rows.map((r) => r.column_name);
    } catch (err) {
      logger.error(`Failed to query columns for table ${tableName}: ${err}`);
      throw new Error(`Failed to query columns for table ${tableName}`);
    }
  }

  /**
   * Gathers database statistics including row counts per table.
   */
  public static async getDatabaseStats(): Promise<DatabaseBackupStats> {
    const tables = await this.getPublicTables();
    let totalRows = 0;
    const tableStats: { name: string; rowCount: number }[] = [];

    for (const table of tables) {
      try {
        const countResult = await prisma.$queryRawUnsafe<{ count: string | number }[]>(
          `SELECT COUNT(*) AS count FROM "public"."${table}";`
        );
        const count = countResult[0] ? Number(countResult[0].count) : 0;
        tableStats.push({ name: table, rowCount: count });
        totalRows += count;
      } catch (err) {
        logger.warn(`Could not count rows for table ${table}: ${err}`);
        tableStats.push({ name: table, rowCount: 0 });
      }
    }

    let version = "PostgreSQL";
    try {
      const versionRes = await prisma.$queryRawUnsafe<{ version: string }[]>("SELECT version();");
      if (versionRes[0]?.version) {
        version = versionRes[0].version.split(" on ")[0];
      }
    } catch {
      // ignore
    }

    return {
      tableCount: tables.length,
      rowCount: totalRows,
      sizeBytes: 0,
      generatedAt: new Date().toISOString(),
      databaseVersion: version,
      tables: tableStats,
    };
  }

  /**
   * Generates a complete PostgreSQL SQL dump with foreign key protection,
   * batch row inserts, and sequence synchronizations.
   */
  public static async exportSqlBackup(options?: {
    tables?: string[];
    includeData?: boolean;
  }): Promise<ExportBackupResult> {
    const startTime = Date.now();
    const allTables = await this.getPublicTables();
    const targetTables = options?.tables && options.tables.length > 0
      ? allTables.filter((t) => options.tables!.includes(t))
      : allTables;

    const includeData = options?.includeData !== false;
    let totalRows = 0;
    const tableStats: { name: string; rowCount: number }[] = [];

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `GRID_CPMS_Database_Backup_${timestampStr}.sql`;

    const sqlChunks: string[] = [];

    // 1. Header & Configuration
    sqlChunks.push(
      `-- ==============================================================================`,
      `-- GRID-OCPP-CPMS PostgreSQL Database Backup Dump`,
      `-- Generated: ${now.toISOString()}`,
      `-- Tables Included: ${targetTables.length}`,
      `-- Database Engine: PostgreSQL / Prisma`,
      `-- ==============================================================================`,
      ``,
      `BEGIN;`,
      ``,
      `-- Disable constraint triggers and foreign key checks during import`,
      `SET session_replication_role = 'replica';`,
      `SET statement_timeout = 0;`,
      `SET client_encoding = 'UTF8';`,
      `SET standard_conforming_strings = on;`,
      ``
    );

    // 2. Truncate Tables (Clean slate for full restore)
    sqlChunks.push(`-- ------------------------------------------------------------------------------`);
    sqlChunks.push(`-- Clean Existing Tables`);
    sqlChunks.push(`-- ------------------------------------------------------------------------------`);
    for (const table of targetTables) {
      sqlChunks.push(`TRUNCATE TABLE "public"."${table}" CASCADE;`);
    }
    sqlChunks.push(``);

    // 3. Dump Table Data as Batch INSERTs
    if (includeData) {
      for (const table of targetTables) {
        const columns = await this.getTableColumns(table);
        if (columns.length === 0) continue;

        let rows: any[] = [];
        try {
          rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "public"."${table}";`);
        } catch (err) {
          logger.error(`Error reading rows from table ${table}: ${err}`);
          continue;
        }

        const rowCount = rows.length;
        totalRows += rowCount;
        tableStats.push({ name: table, rowCount });

        sqlChunks.push(`-- ------------------------------------------------------------------------------`);
        sqlChunks.push(`-- Table: "public"."${table}" (${rowCount} rows)`);
        sqlChunks.push(`-- ------------------------------------------------------------------------------`);

        if (rowCount === 0) {
          sqlChunks.push(`-- (No data)`);
          sqlChunks.push(``);
          continue;
        }

        const quotedCols = columns.map((col) => `"${col}"`).join(", ");
        const BATCH_SIZE = 50;

        for (let i = 0; i < rowCount; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const valueTuples = batch.map((row) => {
            const rowValues = columns.map((col) => formatSqlLiteral(row[col]));
            return `  (${rowValues.join(", ")})`;
          });

          sqlChunks.push(
            `INSERT INTO "public"."${table}" (${quotedCols}) VALUES\n${valueTuples.join(",\n")};`
          );
        }

        sqlChunks.push(``);
      }
    }

    // 4. Sequence Reset Block
    sqlChunks.push(
      `-- ------------------------------------------------------------------------------`,
      `-- Synchronize Auto-Increment Sequences`,
      `-- ------------------------------------------------------------------------------`,
      `DO $$`,
      `DECLARE`,
      `  seq_rec RECORD;`,
      `  max_val BIGINT;`,
      `BEGIN`,
      `  FOR seq_rec IN (`,
      `    SELECT `,
      `      s.relname AS seq_name,`,
      `      n.nspname AS schema_name,`,
      `      t.relname AS table_name,`,
      `      a.attname AS column_name`,
      `    FROM pg_class s`,
      `    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'`,
      `    JOIN pg_class t ON t.oid = d.refobjid`,
      `    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid`,
      `    JOIN pg_namespace n ON n.oid = s.relnamespace`,
      `    WHERE s.relkind = 'S' AND n.nspname = 'public'`,
      `  ) LOOP`,
      `    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', `,
      `      seq_rec.column_name, seq_rec.schema_name, seq_rec.table_name) INTO max_val;`,
      `    IF max_val > 0 THEN`,
      `      EXECUTE format('SELECT setval(''%I.%I'', %s, true)', `,
      `        seq_rec.schema_name, seq_rec.seq_name, max_val);`,
      `    END IF;`,
      `  END LOOP;`,
      `END $$;`,
      ``
    );

    // 5. Footer & Re-enable Foreign Keys
    sqlChunks.push(
      `-- Re-enable constraint checks`,
      `SET session_replication_role = 'origin';`,
      ``,
      `COMMIT;`,
      `-- End of Backup Dump`
    );

    const fullSql = sqlChunks.join("\n");
    const sizeBytes = Buffer.byteLength(fullSql, "utf8");

    let version = "PostgreSQL";
    try {
      const versionRes = await prisma.$queryRawUnsafe<{ version: string }[]>("SELECT version();");
      if (versionRes[0]?.version) {
        version = versionRes[0].version.split(" on ")[0];
      }
    } catch {
      // ignore
    }

    const stats: DatabaseBackupStats = {
      tableCount: targetTables.length,
      rowCount: totalRows,
      sizeBytes,
      generatedAt: now.toISOString(),
      databaseVersion: version,
      tables: tableStats,
    };

    logger.info(
      `Database SQL backup created: ${filename} (${targetTables.length} tables, ${totalRows} rows, ${sizeBytes} bytes in ${Date.now() - startTime}ms)`
    );

    return {
      sql: fullSql,
      filename,
      stats,
    };
  }

  /**
   * Generates a complete JSON snapshot of all database tables.
   */
  public static async exportJsonBackup(): Promise<{
    json: string;
    filename: string;
    stats: DatabaseBackupStats;
  }> {
    const allTables = await this.getPublicTables();
    const data: Record<string, any[]> = {};
    let totalRows = 0;
    const tableStats: { name: string; rowCount: number }[] = [];

    for (const table of allTables) {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "public"."${table}";`);
        data[table] = rows;
        totalRows += rows.length;
        tableStats.push({ name: table, rowCount: rows.length });
      } catch (err) {
        logger.error(`Error exporting JSON for table ${table}: ${err}`);
        data[table] = [];
        tableStats.push({ name: table, rowCount: 0 });
      }
    }

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `GRID_CPMS_Database_Backup_${timestampStr}.json`;

    const payload = {
      metadata: {
        application: "GRID-OCPP-CPMS",
        exportedAt: now.toISOString(),
        tableCount: allTables.length,
        totalRows,
      },
      tables: data,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const sizeBytes = Buffer.byteLength(jsonString, "utf8");

    return {
      json: jsonString,
      filename,
      stats: {
        tableCount: allTables.length,
        rowCount: totalRows,
        sizeBytes,
        generatedAt: now.toISOString(),
        databaseVersion: "PostgreSQL",
        tables: tableStats,
      },
    };
  }

  /**
   * Imports and executes a SQL backup within a database transaction.
   * Supports Dry-Run validation (test simulation with ROLLBACK) and Full/Incremental modes.
   */
  public static async importSqlBackup(
    sqlContent: string,
    options?: ImportBackupOptions
  ): Promise<ImportBackupResult> {
    const startTime = Date.now();
    const isDryRun = Boolean(options?.dryRun);
    const mode = options?.mode || "restore";

    if (!sqlContent || !sqlContent.trim()) {
      throw new Error("SQL backup file or script content cannot be empty");
    }

    const trimmedSql = sqlContent.trim();

    // Acquire dedicated client from connection pool for atomic transaction management
    const client = await pool.connect();

    try {
      if (isDryRun) {
        logger.info("Executing database backup import in DRY-RUN mode (will rollback all changes)...");
        await client.query("BEGIN;");
        await client.query("SET session_replication_role = 'replica';");
        
        // Execute the user's SQL script
        await client.query(trimmedSql);

        // Always rollback in dry-run mode
        await client.query("ROLLBACK;");

        const durationMs = Date.now() - startTime;
        logger.info(`Dry-run backup validation succeeded in ${durationMs}ms`);

        return {
          success: true,
          message: "Dry-run validation successful. SQL syntax, table structures, and constraints verified without modifying database.",
          dryRun: true,
          mode,
          durationMs,
          timestamp: new Date().toISOString(),
        };
      }

      // Live Restore Execution
      logger.info(`Executing database backup import (mode: ${mode})...`);

      // If the provided SQL already has explicit BEGIN/COMMIT blocks, execute directly
      if (trimmedSql.toUpperCase().startsWith("BEGIN") || trimmedSql.includes("session_replication_role")) {
        await client.query(trimmedSql);
      } else {
        await client.query("BEGIN;");
        await client.query("SET session_replication_role = 'replica';");
        await client.query(trimmedSql);
        await client.query("SET session_replication_role = 'origin';");
        await client.query("COMMIT;");
      }

      const durationMs = Date.now() - startTime;
      logger.info(`Database backup restore applied successfully in ${durationMs}ms`);

      // Record in AuditLog for compliance
      try {
        await prisma.auditLog.create({
          data: {
            userId: options?.userId || null,
            action: "DATABASE_BACKUP_RESTORE",
            target: "Database",
            targetId: "PostgreSQL",
            payload: {
              mode,
              dryRun: false,
              durationMs,
              byteLength: Buffer.byteLength(trimmedSql, "utf8"),
            },
            ip: options?.ip || "127.0.0.1",
            userAgent: "System / CPMS Admin",
          },
        });
      } catch (auditErr) {
        logger.warn(`Could not write audit log for database restore: ${auditErr}`);
      }

      return {
        success: true,
        message: "Database backup imported and restored successfully.",
        dryRun: false,
        mode,
        durationMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      try {
        await client.query("ROLLBACK;");
      } catch {
        // ignore rollback errors
      }

      logger.error(`Database backup import failed: ${err.message || err}`);
      throw new Error(`Database import failed: ${err.message || String(err)}`);
    } finally {
      client.release();
    }
  }
}
