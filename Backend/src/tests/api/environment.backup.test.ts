import { jest } from "@jest/globals";
import { formatSqlLiteral, DatabaseBackupService } from "../../services/DatabaseBackupService.js";
import * as environmentController from "../../api/settings/environment/environment.controller.js";
import { prisma, pool } from "../../config/database.js";

describe("Database/SQL Backup Service & Controller Tests", () => {
  describe("formatSqlLiteral helper", () => {
    it("formats null and undefined as NULL", () => {
      expect(formatSqlLiteral(null)).toBe("NULL");
      expect(formatSqlLiteral(undefined)).toBe("NULL");
    });

    it("formats booleans as TRUE/FALSE", () => {
      expect(formatSqlLiteral(true)).toBe("TRUE");
      expect(formatSqlLiteral(false)).toBe("FALSE");
    });

    it("formats numbers and handles NaN/Infinity", () => {
      expect(formatSqlLiteral(42)).toBe("42");
      expect(formatSqlLiteral(3.14159)).toBe("3.14159");
      expect(formatSqlLiteral(NaN)).toBe("NULL");
      expect(formatSqlLiteral(Infinity)).toBe("NULL");
    });

    it("formats Date as ISO timestamptz literal", () => {
      const d = new Date("2026-09-02T12:00:00.000Z");
      expect(formatSqlLiteral(d)).toBe("'2026-09-02T12:00:00.000Z'::timestamptz");
    });

    it("escapes single quotes in strings", () => {
      expect(formatSqlLiteral("It's a test string")).toBe("'It''s a test string'");
      expect(formatSqlLiteral("O'Connor and Sons")).toBe("'O''Connor and Sons'");
    });

    it("formats objects and arrays as jsonb literals", () => {
      const obj = { key: "value", text: "it's working" };
      const formatted = formatSqlLiteral(obj);
      expect(formatted).toContain("::jsonb");
      expect(formatted).toContain("it''s working");
    });
  });

  describe("DatabaseBackupService.exportSqlBackup", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("generates structured SQL dump with transaction, table truncates, and sequence sync", async () => {
      jest.spyOn(prisma, "$queryRawUnsafe").mockImplementation((query: string, ..._args: any[]): any => {
        if (query.includes("information_schema.tables")) {
          return Promise.resolve([{ table_name: "User" }, { table_name: "Charger" }]);
        }
        if (query.includes("information_schema.columns")) {
          return Promise.resolve([{ column_name: "id" }, { column_name: "name" }]);
        }
        if (query.includes("SELECT version()")) {
          return Promise.resolve([{ version: "PostgreSQL 16.1" }]);
        }
        if (query.includes('FROM "public"."User"')) {
          return Promise.resolve([{ id: 1, name: "Admin's Account" }]);
        }
        if (query.includes('FROM "public"."Charger"')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const result = await DatabaseBackupService.exportSqlBackup();

      expect(result.sql).toContain("BEGIN;");
      expect(result.sql).toContain("SET session_replication_role = 'replica';");
      expect(result.sql).toContain('TRUNCATE TABLE "public"."User" CASCADE;');
      expect(result.sql).toContain('TRUNCATE TABLE "public"."Charger" CASCADE;');
      expect(result.sql).toContain('INSERT INTO "public"."User" ("id", "name") VALUES');
      expect(result.sql).toContain("'Admin''s Account'");
      expect(result.sql).toContain("SET session_replication_role = 'origin';");
      expect(result.sql).toContain("COMMIT;");
      expect(result.filename).toMatch(/GRID_CPMS_Database_Backup_\d{4}-\d{2}-\d{2}/);
      expect(result.stats.tableCount).toBe(2);
      expect(result.stats.rowCount).toBe(1);
    });
  });

  describe("DatabaseBackupService.importSqlBackup", () => {
    let mockClient: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockClient = {
        query: jest.fn<any>().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn(),
      };
      jest.spyOn(pool, "connect").mockResolvedValue(mockClient as any);
      jest.spyOn(prisma.auditLog, "create").mockResolvedValue({ id: 1 } as any);
    });

    it("rejects empty SQL content", async () => {
      await expect(DatabaseBackupService.importSqlBackup("   ")).rejects.toThrow(
        "SQL backup file or script content cannot be empty"
      );
    });

    it("executes in dry-run mode and rolls back", async () => {
      const sql = 'INSERT INTO "User" ("name") VALUES (\'Test\');';
      const res = await DatabaseBackupService.importSqlBackup(sql, { dryRun: true });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN;");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK;");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("executes live restore transaction and commits", async () => {
      const sql = 'INSERT INTO "User" ("name") VALUES (\'Live\');';
      const res = await DatabaseBackupService.importSqlBackup(sql, { dryRun: false });

      expect(res.success).toBe(true);
      expect(res.dryRun).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT;");
      expect(mockClient.release).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "DATABASE_BACKUP_RESTORE",
          }),
        })
      );
    });

    it("rolls back transaction on execution error", async () => {
      mockClient.query.mockImplementation((q: string) => {
        if (q.includes("FAILING_QUERY")) {
          throw new Error("Syntax error at FAILING_QUERY");
        }
        return Promise.resolve({ rowCount: 1 });
      });

      await expect(
        DatabaseBackupService.importSqlBackup("FAILING_QUERY;", { dryRun: false })
      ).rejects.toThrow("Database import failed: Syntax error at FAILING_QUERY");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK;");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("Environment Controller Handlers", () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockReq = {
        params: {},
        query: {},
        body: {},
        userId: 1,
        userRole: "admin",
        get: jest.fn().mockReturnValue("Mozilla/5.0"),
        ip: "127.0.0.1",
      };
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        setHeader: jest.fn(),
      };
    });

    it("exportDatabaseBackup sends SQL attachment", async () => {
      jest.spyOn(DatabaseBackupService, "exportSqlBackup").mockResolvedValue({
        sql: "-- SQL DUMP",
        filename: "backup.sql",
        stats: {
          tableCount: 10,
          rowCount: 50,
          sizeBytes: 1024,
          generatedAt: new Date().toISOString(),
          databaseVersion: "PostgreSQL 16",
          tables: [],
        },
      });
      jest.spyOn(prisma.auditLog, "create").mockResolvedValue({ id: 1 } as any);

      await environmentController.exportDatabaseBackup(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/sql; charset=utf-8");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="backup.sql"');
      expect(mockRes.send).toHaveBeenCalledWith("-- SQL DUMP");
    });

    it("importDatabaseBackup handles uploaded file and returns json response", async () => {
      mockReq.file = {
        buffer: Buffer.from("BEGIN; TRUNCATE \"User\"; COMMIT;"),
      };
      mockReq.body = { mode: "restore", dryRun: "false" };

      jest.spyOn(DatabaseBackupService, "importSqlBackup").mockResolvedValue({
        success: true,
        message: "Restored",
        dryRun: false,
        mode: "restore",
        durationMs: 15,
        timestamp: new Date().toISOString(),
      });

      await environmentController.importDatabaseBackup(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          success: true,
          mode: "restore",
        }),
      });
    });

    it("importDatabaseBackup returns 400 when no content is supplied", async () => {
      mockReq.file = undefined;
      mockReq.body = {};

      await environmentController.importDatabaseBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("No SQL backup content provided"),
        })
      );
    });

    it("getDatabaseBackupStats returns inventory counts", async () => {
      jest.spyOn(DatabaseBackupService, "getDatabaseStats").mockResolvedValue({
        tableCount: 15,
        rowCount: 320,
        sizeBytes: 0,
        generatedAt: new Date().toISOString(),
        databaseVersion: "PostgreSQL 16",
        tables: [{ name: "User", rowCount: 5 }],
      });

      await environmentController.getDatabaseBackupStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          tableCount: 15,
          rowCount: 320,
        }),
      });
    });
  });
});
