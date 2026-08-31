import express, { Application } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { isOriginAllowed } from "./utils/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import { authenticateToken } from "./middleware/auth.js";
import { redisClient } from "./config/redis.js";

// Import API routes
import authRoutes from "./api/auth/auth.routes.js";
import chargersRoutes from "./api/chargers/chargers.routes.js";
import stationsRoutes from "./api/stations/stations.routes.js";
import connectorsRoutes from "./api/connectors/connectors.routes.js";
import rfidRoutes from "./api/rfid/rfid.routes.js";
import tariffsRoutes from "./api/tariffs/tariffs.routes.js";
import transactionsRoutes from "./api/transactions/transactions.routes.js";
import ocppRoutes from "./api/ocpp/ocpp.routes.js";
import dashboardRoutes from "./api/dashboard/dashboard.routes.js";
import paymentsRoutes from "./api/payments/payments.routes.js";
import ocpiRoutes from "./api/ocpi/ocpi.routes.js";
import oicpRoutes from "./api/oicp/oicp.routes.js";
import roamingRoutes from "./api/roaming/roaming.routes.js";
import usersRoutes from "./api/users/users.routes.js";
import chargeGroupsRoutes from "./api/chargeGroups/chargeGroups.routes.js";
import companiesRoutes from "./api/companies/companies.routes.js";
import configProfilesRoutes from "./api/config-profiles/config-profiles.routes.js";
import quirkProfilesRoutes from "./api/quirk-profiles/quirk-profiles.routes.js";
import mailRoutes from "./api/mail/mail.routes.js";
import settingsTariffsRoutes from "./api/settings/tariffs/tariffs.routes.js";
import settingsMailRoutes from "./api/settings/mail/mail.routes.js";
import settingsHardwareAtRiskRoutes from "./api/settings/hardware-at-risk/hardwareAtRisk.routes.js";
import settingsPaymentsRoutes from "./api/settings/payments/payments.routes.js";
import diagnosticsRoutes from "./routes/diagnostics.js";
import mediaCampaignsRoutes from "./api/media-campaigns/media-campaigns.routes.js";
import vehiclesRoutes, { energyProfileRouter } from "./api/vehicles/vehicles.routes.js";
import analyticsRoutes from "./api/analytics/analytics.routes.js";
import reimbursementsRoutes from "./api/reimbursements/reimbursements.routes.js";
import auditRoutes from "./api/audit/audit.routes.js";
import invoicesRoutes from "./api/invoices/invoices.routes.js";
import sepaRoutes from "./api/sepa/sepa.routes.js";
import localAuthListRoutes from "./api/localAuthList/localAuthList.routes.js";
import reservationsRoutes from "./api/reservations/reservations.routes.js";
import securityRoutes from "./api/security/security.routes.js";
import rolesRoutes from "./api/roles/roles.routes.js";
import webhooksRoutes from "./api/webhooks/webhooks.routes.js";
import scheduledChargingRoutes from "./api/scheduled-charging/scheduledCharging.routes.js";
import simulatorRoutes from "./api/simulator/simulator.routes.js";
import firmwareRoutes from "./api/firmware/firmware.routes.js";
import productsRoutes from "./api/products/products.routes.js";
import eichrechtRoutes from "./api/eichrecht/eichrecht.routes.js";
import pushRoutes from "./api/push/push.routes.js";
import autoHealPlaybooksRoutes from "./api/auto-heal-playbooks/autoHealPlaybooks.routes.js";

// Import OCPP servers
import { ocppServer } from "./ocpp/ocppServer.js";
import { ocppLogsServer } from "./ocpp/logsWebSocket.js";
import { setupRealtimeSocket } from "./ocpp/realtime.socket.js";
import { startAutoHealCron } from "./cron/autoHealCron.js";
import { startReimbursementCron } from "./cron/reimbursementCron.js";
import { startInvoiceCron } from "./cron/invoiceCron.js";
import { startReservationCron } from "./cron/reservationCron.js";
import { startScheduledChargingCron } from "./cron/scheduledChargingCron.js";
import { stopWorkers } from "./workers/workerManager.js";
import "./cron/predictiveBalancingCron.js";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Disable identifying header
  app.disable("x-powered-by");

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // Security CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        logger.warn(`CORS policy blocked REST request from origin: ${origin}`);
        return callback(new Error("CORS policy violation: origin not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "stripe-signature"],
    })
  );

  // General Rate Limiting
  const limiter = rateLimit({
    store: new RedisStore({
      // @ts-expect-error - Known typing issue with rate-limit-redis and ioredis
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { success: false, error: "Too many requests from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Dedicated Brute-force Auth Rate Limiter
  const authLimiter = rateLimit({
    store: new RedisStore({
      // @ts-expect-error - Known typing issue with rate-limit-redis and ioredis
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 authentication attempts per 15 minutes
    message: { success: false, error: "Too many login/auth attempts from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Serve uploaded media files safely
  app.use("/uploads", express.static("uploads", { dotfiles: "ignore", maxAge: "1d" }));

  // Body parser with rawBody capture for webhook HMAC signature verification
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });

  // API Routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/forgot-password", authLimiter);
  app.use("/api/auth/reset-password", authLimiter);
  app.use("/api/auth", authRoutes);

  app.use("/api/chargers", authenticateToken, chargersRoutes);
  app.use("/api/stations", authenticateToken, stationsRoutes);
  app.use("/api/connectors", authenticateToken, connectorsRoutes);
  app.use("/api/rfid", authenticateToken, rfidRoutes);
  app.use("/api/tariffs", authenticateToken, tariffsRoutes);
  app.use("/api/transactions", authenticateToken, transactionsRoutes);
  app.use("/api/ocpp", authenticateToken, ocppRoutes);
  app.use("/api/dashboard", authenticateToken, dashboardRoutes);
  app.use("/api/users", authenticateToken, usersRoutes);
  app.use("/api/companies", authenticateToken, companiesRoutes);
  app.use("/api/charge-groups", authenticateToken, chargeGroupsRoutes);
  app.use("/api/payments", paymentsRoutes); // Auth handled within router to permit public webhooks
  app.use("/api/ocpi", ocpiRoutes); // Handled within router (authenticateOcpiToken on roaming, JWT on admin endpoints)
  app.use("/api/oicp", authenticateToken, oicpRoutes);
  app.use("/api/roaming", authenticateToken, roamingRoutes);
  app.use("/api/config-profiles", authenticateToken, configProfilesRoutes);
  app.use("/api/quirk-profiles", authenticateToken, quirkProfilesRoutes);
  app.use("/api/mail", authenticateToken, mailRoutes);
  app.use("/api/settings/tariffs", authenticateToken, settingsTariffsRoutes);
  app.use("/api/settings/mail", authenticateToken, settingsMailRoutes);
  app.use("/api/settings/hardware-at-risk", authenticateToken, settingsHardwareAtRiskRoutes);
  app.use("/api/settings/payments", authenticateToken, settingsPaymentsRoutes);
  app.use("/api/diagnostics", authenticateToken, diagnosticsRoutes);
  app.use("/api/media-campaigns", authenticateToken, mediaCampaignsRoutes);
  app.use("/api/vehicles", authenticateToken, vehiclesRoutes);
  app.use("/api/energy-profile", authenticateToken, energyProfileRouter);
  app.use("/api/vcc", authenticateToken, vehiclesRoutes);
  app.use("/api/analytics", authenticateToken, analyticsRoutes);
  app.use("/api/reimbursements", authenticateToken, reimbursementsRoutes);
  app.use("/api/audit", authenticateToken, auditRoutes);
  app.use("/api/invoices", authenticateToken, invoicesRoutes);
  app.use("/api/sepa", authenticateToken, sepaRoutes);
  app.use("/api/chargers", authenticateToken, localAuthListRoutes);
  app.use("/api/reservations", authenticateToken, reservationsRoutes);
  app.use("/api/security", authenticateToken, securityRoutes);
  app.use("/api/roles", authenticateToken, rolesRoutes);
  app.use("/api/simulator", authenticateToken, simulatorRoutes);
  app.use("/api/webhooks", authenticateToken, webhooksRoutes);
  app.use("/api/scheduled-charging", authenticateToken, scheduledChargingRoutes);
  app.use("/api/firmware", authenticateToken, firmwareRoutes);
  app.use("/api/products", authenticateToken, productsRoutes);
  app.use("/api/eichrecht", authenticateToken, eichrechtRoutes);
  app.use("/api/push", pushRoutes);
  app.use("/api/auto-heal-playbooks", authenticateToken, autoHealPlaybooksRoutes);

  // Auto-seed default vendor playbooks on boot
  import("./services/AutoHealPlaybookService.js")
    .then(({ AutoHealPlaybookService }) => {
      AutoHealPlaybookService.seedDefaultPlaybooks().catch(() => {});
    })
    .catch(() => {});

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start standalone API & Realtime Socket server pod
 */
export function startApiServer() {
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`🚀 [API Pod] Express API server listening on port ${config.port}`);
  });

  // Start OCPP logs WebSocket server
  ocppLogsServer.start(server);

  // Setup Socket.IO realtime server
  setupRealtimeSocket(server);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down API pod gracefully...`);
    ocppLogsServer.stop();
    server.close(() => {
      logger.info("API server HTTP listener closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((err) => logger.error(`API shutdown error: ${err}`));
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((err) => logger.error(`API shutdown error: ${err}`));
  });

  return { app, server };
}

/**
 * Start standalone OCPP WebSocket ingestion server pod
 */
export function startOcppServer() {
  logger.info(`⚡ [OCPP Pod] Starting OCPP WebSocket server on port ${config.ocppPort}...`);
  ocppServer.start();

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down OCPP pod gracefully...`);
    ocppServer.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return ocppServer;
}

/**
 * Start standalone background Worker server pod
 */
export async function startWorkerServer() {
  logger.info("⚙️ [Worker Pod] Starting background job queues and schedulers...");

  const { startWorkers, stopWorkers } = await import("./workers/index.js");
  const { closeQueues } = await import("./queues/queueManager.js");
  const { MeterValueService } = await import("./services/MeterValueService.js");
  const { EpexSpotService } = await import("./services/EpexSpotService.js");
  const { loadManagementService } = await import("./services/LoadManagementService.js");

  startWorkers();
  MeterValueService.startWorker();
  EpexSpotService.startEpexWorker();
  loadManagementService.startSmartChargingEngine();

  // Start background crons
  startAutoHealCron();
  startReimbursementCron();
  startInvoiceCron();
  startReservationCron();
  startScheduledChargingCron();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down Worker pod gracefully...`);
    try {
      await stopWorkers();
      await closeQueues();
    } catch (err) {
      logger.error(`Error during workers shutdown: ${err}`);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((err) => logger.error(`Worker shutdown error: ${err}`));
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((err) => logger.error(`Worker shutdown error: ${err}`));
  });
}

/**
 * Start all servers (Monolith mode)
 */
export function startServers(): void {
  // Start OCPP WebSocket server
  ocppServer.start();

  // Create and start Express app
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`Express API server listening on port ${config.port}`);
    logger.info(`OCPP WebSocket server on port ${config.ocppPort}`);
    logger.info("All servers started successfully in monolith mode");
  });

  // Start OCPP logs WebSocket server
  ocppLogsServer.start(server);

  // Setup Socket.IO realtime server
  setupRealtimeSocket(server);

  // Start background crons
  startAutoHealCron();
  startReimbursementCron();
  startInvoiceCron();
  startReservationCron();
  startScheduledChargingCron();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      await stopWorkers();
    } catch (err) {
      logger.error(`Error stopping BullMQ workers during shutdown: ${err}`);
    }

    ocppServer.stop();
    ocppLogsServer.stop();
    server.close();

    try {
      const { stopWorkers } = await import("./workers/index.js");
      const { closeQueues } = await import("./queues/queueManager.js");
      await stopWorkers();
      await closeQueues();
    } catch (err) {
      logger.error(`Error during workers shutdown: ${err}`);
    }

    process.exit(0);
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((err) => logger.error(`Shutdown error: ${err}`));
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((err) => logger.error(`Shutdown error: ${err}`));
  });
}
