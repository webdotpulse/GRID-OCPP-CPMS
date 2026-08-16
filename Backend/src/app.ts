import express, { Application } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
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
import emsGatewaysRoutes from "./api/ems-gateways/ems-gateways.routes.js";
import configProfilesRoutes from "./api/config-profiles/config-profiles.routes.js";
import quirkProfilesRoutes from "./api/quirk-profiles/quirk-profiles.routes.js";
import mailRoutes from "./api/mail/mail.routes.js";
import settingsTariffsRoutes from "./api/settings/tariffs/tariffs.routes.js";
import settingsMailRoutes from "./api/settings/mail/mail.routes.js";
import settingsHardwareAtRiskRoutes from "./api/settings/hardware-at-risk/hardwareAtRisk.routes.js";
import settingsPaymentsRoutes from "./api/settings/payments/payments.routes.js";
import diagnosticsRoutes from "./routes/diagnostics.js";
import mediaCampaignsRoutes from "./api/media-campaigns/media-campaigns.routes.js";
import vehiclesRoutes from "./api/vehicles/vehicles.routes.js";
import vccRoutes from "./api/vcc/vcc.routes.js";
import analyticsRoutes from "./api/analytics/analytics.routes.js";

// Import OCPP servers
import { ocppServer } from "./ocpp/ocppServer.js";
import { ocppLogsServer } from "./ocpp/logsWebSocket.js";
import { setupRealtimeSocket } from "./ocpp/realtime.socket.js";
import { startTelemetrySyncCron } from "./cron/telemetrySyncCron.js";
import { startAutoHealCron } from "./cron/autoHealCron.js";
import "./cron/predictiveBalancingCron.js";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(cors());

  // Rate Limiting
  const limiter = rateLimit({
    store: new RedisStore({
      // @ts-expect-error - Known typing issue with rate-limit-redis and ioredis
      sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  app.use(limiter);

  // Serve uploaded media files
  app.use("/uploads", express.static("uploads"));

  // Body parser
  app.use(express.json());
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
  app.use("/api/ems-gateways", emsGatewaysRoutes);
  app.use("/api/payments", paymentsRoutes); // Auth handled within router to permit public webhooks
  app.use("/api/ocpi", ocpiRoutes); // Removed auth for initial testing
  app.use("/api/oicp", authenticateToken, oicpRoutes);
  app.use("/api/roaming", authenticateToken, roamingRoutes);
  app.use("/api/config-profiles", authenticateToken, configProfilesRoutes);
  app.use("/api/quirk-profiles", authenticateToken, quirkProfilesRoutes);
  app.use("/api/mail", authenticateToken, mailRoutes);
  app.use("/api/settings/tariffs", authenticateToken, settingsTariffsRoutes);
  app.use("/api/settings/mail", authenticateToken, settingsMailRoutes);
  app.use("/api/settings/hardware-at-risk", authenticateToken, settingsHardwareAtRiskRoutes);
  app.use("/api/settings/payments", authenticateToken, settingsPaymentsRoutes);
  app.use("/api/diagnostics", diagnosticsRoutes);
  app.use("/api/media-campaigns", authenticateToken, mediaCampaignsRoutes);
  app.use("/api/vehicles", authenticateToken, vehiclesRoutes);
  app.use("/api/vcc", vccRoutes);
  app.use("/api/analytics", analyticsRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start all servers
 */
export function startServers(): void {
  // Start OCPP WebSocket server
  ocppServer.start();

  // Create and start Express app
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`Express API server listening on port ${config.port}`);
    logger.info(`OCPP WebSocket server on port ${config.ocppPort}`);
    logger.info("All servers started successfully");
  });

  // Start OCPP logs WebSocket server
  ocppLogsServer.start(server);

  // Setup Socket.IO realtime server
  setupRealtimeSocket(server);

  // Start background crons
  startTelemetrySyncCron();
  startAutoHealCron();

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    ocppServer.stop();
    ocppLogsServer.stop();

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
