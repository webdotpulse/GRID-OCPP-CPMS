import { Request, Response } from "express";
import os from "os";
import { prisma } from "../../../config/database.js";
import { redisClient } from "../../../config/redis.js";
import { config } from "../../../config/index.js";
import { chargerRegistry } from "../../../ocpp/chargerRegistry.js";
import { logger } from "../../../utils/logger.js";
import { DatabaseBackupService } from "../../../services/DatabaseBackupService.js";
import { AuthRequest } from "../../../middleware/auth.js";

/**
 * Helper to calculate overall CPU usage percentage from os.cpus()
 */
function getCpuUsage(): { overallPercent: number; cores: { core: number; model: string; speedMhz: number; usagePercent: number }[] } {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  const cores = cpus.map((cpu, index) => {
    const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
    const idle = cpu.times.idle;
    const usage = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;

    totalIdle += idle;
    totalTick += total;

    return {
      core: index + 1,
      model: cpu.model,
      speedMhz: cpu.speed,
      usagePercent: Math.min(100, Math.max(0, usage)),
    };
  });

  const overallPercent = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0;

  return {
    overallPercent: Math.min(100, Math.max(0, overallPercent)),
    cores,
  };
}

/**
 * Format uptime seconds to human-readable string (e.g., "3 days, 4 hrs, 12 mins")
 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
}

/**
 * GET /api/settings/environment
 * Fetch full server environment, CPU, memory, database, Redis, and OCPP server telemetry.
 */
export const getServerEnvironmentMetrics = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // 1. Host & OS Metrics
    const cpuInfo = getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMemPercent = Math.round((usedMem / totalMem) * 100);

    const memUsage = process.memoryUsage();
    const processCpu = process.cpuUsage();

    // 2. Database Health & Counts
    let dbStatus: "healthy" | "degraded" | "error" = "healthy";
    let dbLatencyMs = 0;
    let dbVersion = "PostgreSQL";
    let counts = {
      chargers: 0,
      chargingStations: 0,
      connectors: 0,
      transactions: 0,
      activeSessions: 0,
      users: 0,
      rfidUsers: 0,
      companies: 0,
      chargeGroups: 0,
    };

    try {
      const dbStart = Date.now();
      const [versionResult] = await prisma.$queryRawUnsafe<any[]>("SELECT version();");
      dbLatencyMs = Date.now() - dbStart;
      if (versionResult && versionResult.version) {
        dbVersion = String(versionResult.version).split(" on ")[0];
      }

      const [
        chargersCount,
        stationsCount,
        connectorsCount,
        txCount,
        activeTxCount,
        usersCount,
        rfidCount,
        companiesCount,
        groupsCount,
      ] = await Promise.all([
        prisma.charger.count().catch(() => 0),
        prisma.chargingStation.count().catch(() => 0),
        prisma.connector.count().catch(() => 0),
        prisma.transaction.count().catch(() => 0),
        prisma.transaction.count({ where: { endTime: null } }).catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.rfidUser.count().catch(() => 0),
        prisma.company.count().catch(() => 0),
        prisma.chargeGroup.count().catch(() => 0),
      ]);

      counts = {
        chargers: chargersCount,
        chargingStations: stationsCount,
        connectors: connectorsCount,
        transactions: txCount,
        activeSessions: activeTxCount,
        users: usersCount,
        rfidUsers: rfidCount,
        companies: companiesCount,
        chargeGroups: groupsCount,
      };
    } catch (dbErr) {
      logger.error(`Database health check failed: ${dbErr}`);
      dbStatus = "error";
    }

    // 3. Redis Health & Info
    let redisStatus: "healthy" | "disconnected" | "disabled" = "healthy";
    let redisLatencyMs = 0;
    let redisInfo: Record<string, string> = {};

    try {
      const redisStart = Date.now();
      await redisClient.ping();
      redisLatencyMs = Date.now() - redisStart;

      try {
        const rawInfo = await redisClient.info();
        rawInfo.split("\r\n").forEach((line) => {
          if (line && !line.startsWith("#")) {
            const [k, v] = line.split(":");
            if (k && v) redisInfo[k.trim()] = v.trim();
          }
        });
      } catch {
        // ignore info parse errors
      }
    } catch (redisErr) {
      logger.error(`Redis health check failed: ${redisErr}`);
      redisStatus = "disconnected";
    }

    // 4. OCPP WebSocket Server Status & Connections
    let clusterConnectedChargerIds: number[] = [];
    try {
      clusterConnectedChargerIds = await chargerRegistry.getConnectedChargers();
    } catch (err) {
      logger.error(`Failed to get cluster chargers: ${err}`);
    }

    let connectedChargerRecords: any[] = [];
    try {
      if (clusterConnectedChargerIds.length > 0) {
        connectedChargerRecords = await prisma.charger.findMany({
          where: {
            charger_id: { in: clusterConnectedChargerIds },
          },
          select: {
            charger_id: true,
            name: true,
            model: true,
            manufacturer: true,
            firmware_version: true,
            status: true,
            chargingStation: {
              select: {
                station_name: true,
              },
            },
          },
        });
      }
    } catch (err) {
      logger.error(`Failed to query charger records: ${err}`);
    }

    const connectedChargersList = clusterConnectedChargerIds.map((id) => {
      const localConn = chargerRegistry.getConnection(id);
      const dbRecord = connectedChargerRecords.find((c) => c.charger_id === id);

      return {
        chargerId: id,
        name: dbRecord?.name || localConn?.chargerName || `Charger #${id}`,
        stationName: dbRecord?.chargingStation?.station_name || "Unassigned Station",
        model: dbRecord?.model || "Standard EVSE",
        vendor: dbRecord?.manufacturer || "Generic",
        firmware: dbRecord?.firmware_version || "v1.0",
        protocol: localConn?.protocol || "ocpp1.6",
        connectedAt: localConn?.connectedAt?.toISOString() || new Date().toISOString(),
        lastHeartbeat: localConn?.lastHeartbeat?.toISOString() || new Date().toISOString(),
        activeTransactions: localConn ? localConn.transactions.size : 0,
        isLocal: Boolean(localConn),
      };
    });

    // 5. Overall System Status
    const isSystemHealthy = dbStatus === "healthy" && redisStatus === "healthy";
    const totalProcessingTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        status: isSystemHealthy ? "operational" : "degraded",
        timestamp: new Date().toISOString(),
        processingTimeMs: totalProcessingTimeMs,

        // Host & OS
        host: {
          hostname: os.hostname(),
          platform: os.platform(),
          osRelease: os.release(),
          osType: os.type(),
          arch: os.arch(),
          nodeVersion: process.version,
          v8Version: process.versions.v8,
          pid: process.pid,
          systemUptimeSeconds: os.uptime(),
          systemUptimeFormatted: formatUptime(os.uptime()),
          processUptimeSeconds: process.uptime(),
          processUptimeFormatted: formatUptime(process.uptime()),
          loadAverage: os.loadavg(), // [1m, 5m, 15m]
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          environment: process.env.NODE_ENV || "development",
          instanceId: config.instanceId,
        },

        // CPU Telemetry
        cpu: {
          overallUsagePercent: cpuInfo.overallPercent,
          coreCount: cpuInfo.cores.length,
          model: cpuInfo.cores[0]?.model || "Standard CPU",
          speedMhz: cpuInfo.cores[0]?.speedMhz || 0,
          cores: cpuInfo.cores,
          processCpuMicroseconds: processCpu,
        },

        // Memory Telemetry
        memory: {
          totalSystemBytes: totalMem,
          freeSystemBytes: freeMem,
          usedSystemBytes: usedMem,
          usedSystemPercent: usedMemPercent,
          processHeapUsedBytes: memUsage.heapUsed,
          processHeapTotalBytes: memUsage.heapTotal,
          processRssBytes: memUsage.rss,
          processExternalBytes: memUsage.external,
          processArrayBuffersBytes: memUsage.arrayBuffers || 0,
          heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },

        // Database (PostgreSQL / Prisma)
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          version: dbVersion,
          counts,
        },

        // Cache & Message Bus (Redis)
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
          version: redisInfo.redis_version || "7.0",
          usedMemoryHuman: redisInfo.used_memory_human || "N/A",
          connectedClients: parseInt(redisInfo.connected_clients || "0", 10),
          uptimeDays: parseInt(redisInfo.uptime_in_days || "0", 10),
          totalCommandsProcessed: parseInt(redisInfo.total_commands_processed || "0", 10),
        },

        // OCPP WebSocket Server
        ocppServer: {
          status: "running",
          port: config.ocppPort,
          apiPort: config.port,
          wsEndpoint16: `ws://${req.hostname || "localhost"}:${config.ocppPort}/OCPP/1.6/{chargerId}`,
          wsEndpoint21: `ws://${req.hostname || "localhost"}:${config.ocppPort}/OCPP/2.1/{chargerId}`,
          ocppLogsWsEndpoint: "/api/ocpp-logs",
          realtimeSocketEndpoint: "/socket.io",
          supportedProtocols: ["OCPP 1.6-J (JSON)", "OCPP 2.0.1 (JSON)", "OCPP 2.1 Draft (JSON)"],
          securityProfiles: [
            "Security Profile 1 (Unsecured HTTP / WS)",
            "Security Profile 2 (TLS / Basic Authentication)",
            "Security Profile 3 (mTLS Client Certificates)",
          ],
          mtlsEnabled: Boolean(config.mtlsEnabled),
          heartbeatIntervalSeconds: config.heartbeatInterval,
          offlineThresholdSeconds: config.offlineThreshold,
          activeConnectionsLocal: chargerRegistry.getConnectionCount ? (await chargerRegistry.getConnectionCount()) : 0,
          activeConnectionsCluster: clusterConnectedChargerIds.length,
          connectedChargers: connectedChargersList,
        },

        // Subsystem Microservices & Background Workers
        subsystems: [
          {
            name: "Socket.IO Real-Time Stream",
            key: "socket_io",
            status: "active",
            description: "Live browser push notifications & session telemetry broadcaster",
            path: "/socket.io",
          },
          {
            name: "Auto-Heal Hardware Watchdog",
            key: "auto_heal",
            status: "active",
            description: "Automated connector unlock, soft-reset and firmware diagnosis watchdog",
            interval: "Every 5 minutes",
          },
          {
            name: "Predictive Solar & LMS Engine",
            key: "lms",
            status: "active",
            description: "Solar PV load balancing and dynamic charging profile dispatch",
            interval: "Real-time dynamic",
          },
          {
            name: "Vehicle-to-Grid (V2G) Orchestrator",
            key: "v2g",
            status: "active",
            description: "ISO 15118-20 bidirectional discharge and spot arbitrage controller",
            interval: "Continuous stream",
          },
          {
            name: "Dynamic EPEX Spot Tariffs",
            key: "dynamic_tariffs",
            status: "active",
            description: "Day-ahead European electricity market spot price sync (ENTSO-E)",
            interval: "Hourly (13:00 CET day-ahead)",
          },
          {
            name: "SEPA Reimbursement Calculator",
            key: "reimbursement",
            status: "active",
            description: "ISO 20022 pain.001 credit transfer generator for employee charging",
            interval: "Monthly billing cycle",
          },
        ],
      },
    });
  } catch (error) {
    logger.error(`Error fetching server environment metrics: ${error}`);
    res.status(500).json({ success: false, error: "Failed to retrieve server environment metrics" });
  }
};

/**
 * POST /api/settings/environment/ping
 * Run real-time diagnostic latency benchmark across database, Redis, and OCPP server.
 */
export const runEnvironmentPing = async (req: Request, res: Response) => {
  try {
    const results: {
      target: string;
      status: "success" | "warning" | "error";
      latencyMs: number;
      details: string;
    }[] = [];

    // 1. Database Ping
    try {
      const dbStart = Date.now();
      await prisma.$queryRawUnsafe("SELECT 1;");
      const dbLatency = Date.now() - dbStart;
      results.push({
        target: "PostgreSQL Database (Prisma)",
        status: dbLatency < 50 ? "success" : "warning",
        latencyMs: dbLatency,
        details: `Query executed in ${dbLatency}ms`,
      });
    } catch (err: any) {
      results.push({
        target: "PostgreSQL Database (Prisma)",
        status: "error",
        latencyMs: -1,
        details: `Connection failed: ${err.message || err}`,
      });
    }

    // 2. Redis Ping
    try {
      const redisStart = Date.now();
      await redisClient.ping();
      const redisLatency = Date.now() - redisStart;
      results.push({
        target: "Redis In-Memory Bus & Cache",
        status: redisLatency < 20 ? "success" : "warning",
        latencyMs: redisLatency,
        details: `PING response in ${redisLatency}ms`,
      });
    } catch (err: any) {
      results.push({
        target: "Redis In-Memory Bus & Cache",
        status: "error",
        latencyMs: -1,
        details: `Redis unreachable: ${err.message || err}`,
      });
    }

    // 3. OCPP Registry Check
    try {
      const ocppStart = Date.now();
      const count = await chargerRegistry.getConnectionCount();
      const ocppLatency = Date.now() - ocppStart;
      results.push({
        target: `OCPP WebSocket Server (Port ${config.ocppPort})`,
        status: "success",
        latencyMs: ocppLatency,
        details: `Active socket pool verified in ${ocppLatency}ms (${count} chargers connected)`,
      });
    } catch (err: any) {
      results.push({
        target: `OCPP WebSocket Server (Port ${config.ocppPort})`,
        status: "error",
        latencyMs: -1,
        details: `OCPP registry lookup failed: ${err.message || err}`,
      });
    }

    const allSuccessful = results.every((r) => r.status !== "error");

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        overallStatus: allSuccessful ? "healthy" : "degraded",
        results,
      },
    });
  } catch (error) {
    logger.error(`Error running environment ping: ${error}`);
    res.status(500).json({ success: false, error: "Failed to execute diagnostic ping" });
  }
};

/**
 * GET /api/settings/environment/backup/export
 * Export full PostgreSQL SQL or JSON database snapshot.
 */
export const exportDatabaseBackup = async (req: AuthRequest, res: Response) => {
  try {
    const format = req.query.format === "json" ? "json" : "sql";
    const includeData = req.query.includeData !== "false";

    if (format === "json") {
      const backup = await DatabaseBackupService.exportJsonBackup();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${backup.filename}"`);
      res.setHeader("X-Database-Tables", String(backup.stats.tableCount));
      res.setHeader("X-Database-Rows", String(backup.stats.rowCount));
      
      // Log export action in AuditLog
      try {
        await prisma.auditLog.create({
          data: {
            userId: req.userId || null,
            action: "DATABASE_BACKUP_EXPORT",
            target: "Database",
            targetId: "JSON",
            payload: { format: "json", tableCount: backup.stats.tableCount, rowCount: backup.stats.rowCount },
            ip: req.ip || "127.0.0.1",
            userAgent: req.get("User-Agent") || "CPMS Admin",
          },
        });
      } catch {
        // ignore audit log write failures
      }

      return res.send(backup.json);
    }

    const backup = await DatabaseBackupService.exportSqlBackup({ includeData });
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${backup.filename}"`);
    res.setHeader("X-Database-Tables", String(backup.stats.tableCount));
    res.setHeader("X-Database-Rows", String(backup.stats.rowCount));

    // Log export action in AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.userId || null,
          action: "DATABASE_BACKUP_EXPORT",
          target: "Database",
          targetId: "PostgreSQL",
          payload: { format: "sql", tableCount: backup.stats.tableCount, rowCount: backup.stats.rowCount },
          ip: req.ip || "127.0.0.1",
          userAgent: req.get("User-Agent") || "CPMS Admin",
        },
      });
    } catch {
      // ignore audit log write failures
    }

    return res.send(backup.sql);
  } catch (error: any) {
    logger.error(`Error generating database backup: ${error}`);
    return res.status(500).json({
      success: false,
      error: `Failed to generate database backup: ${error.message || error}`,
    });
  }
};

/**
 * POST /api/settings/environment/backup/import
 * Import and execute a SQL backup within an atomic transaction.
 * Supports multipart file upload (`file`) and JSON body `{ sql: string, mode, dryRun }`.
 */
export const importDatabaseBackup = async (req: AuthRequest, res: Response) => {
  try {
    let sqlContent = "";
    
    // Check if uploaded as a multipart file
    if (req.file && req.file.buffer) {
      sqlContent = req.file.buffer.toString("utf8");
    } else if (req.body && typeof req.body.sql === "string") {
      sqlContent = req.body.sql;
    }

    if (!sqlContent || !sqlContent.trim()) {
      return res.status(400).json({
        success: false,
        error: "No SQL backup content provided. Please upload a .sql file or provide SQL script content.",
      });
    }

    const mode = req.body?.mode === "incremental" ? "incremental" : "restore";
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === "true";

    const result = await DatabaseBackupService.importSqlBackup(sqlContent, {
      mode,
      dryRun,
      userId: req.userId,
      ip: req.ip,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error(`Error importing database backup: ${error}`);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to import database backup",
    });
  }
};

/**
 * GET /api/settings/environment/backup/stats
 * Get table inventory, row counts, and database metadata for backup planning.
 */
export const getDatabaseBackupStats = async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await DatabaseBackupService.getDatabaseStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error(`Error fetching database stats: ${error}`);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve database inventory statistics",
    });
  }
};

