import { Server as SocketIOServer } from "socket.io";
import * as http from "http";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { redisSubscriber } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { isOriginAllowed } from "../utils/cors.js";

import { prisma } from "../config/database.js";

let io: SocketIOServer | null = null;

export function setupRealtimeSocket(server: http.Server): void {
  io = new SocketIOServer(server, {
    path: "/api/realtime",
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        logger.warn(`CORS policy blocked realtime socket from origin: ${origin}`);
        return callback(null, false);
      },
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
  });

  // Authenticate socket connections using JWT token
  io.use((socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization;

    if (!rawToken) {
      // In non-production, allow unauthenticated for local developer convenience if needed, otherwise reject
      if (process.env.NODE_ENV === "test") {
        return next();
      }
      return next(new Error("Authentication error: Missing token for realtime socket"));
    }

    const token = typeof rawToken === "string" && rawToken.startsWith("Bearer ")
      ? rawToken.substring(7).trim()
      : String(rawToken).trim();

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      (socket as any).user = decoded;
      return next();
    } catch (err: any) {
      logger.warn(`Socket.IO authentication failed for socket ${socket.id}: ${err.message}`);
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Realtime client authenticated and connected: ${socket.id}`);

    socket.on("GET_OCPP_LOGS", async (data, callback) => {
      try {
        const limit = typeof data?.limit === "number" ? Math.min(Math.max(data.limit, 1), 200) : 50;
        const chargerId = data?.chargerId ? Number(data.chargerId) : undefined;
        const user = (socket as any).user;

        const where: any = {};
        if (chargerId && !isNaN(chargerId)) {
          where.chargerId = chargerId;
        }

        if (user && user.role !== "admin" && user.role !== "superadmin") {
          where.charger = {
            owner_id: user.userId,
          };
        }

        const recentLogs = await prisma.ocppLog.findMany({
          where,
          take: limit,
          orderBy: { timestamp: "desc" },
          include: { charger: true },
        });

        if (typeof callback === "function") {
          callback({ success: true, logs: recentLogs.reverse() });
        }
      } catch (err: any) {
        if (typeof callback === "function") {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Realtime client disconnected: ${socket.id}`);
    });
  });

  // Setup Redis Subscription for charger status updates and OCPP logs
  redisSubscriber.subscribe("charger_status_updates", "ocpp_logs", (err) => {
    if (err) {
      logger.error(`Failed to subscribe to realtime Redis channels: ${err}`);
    } else {
      logger.info("Subscribed to charger_status_updates and ocpp_logs Redis channels");
    }
  });

  redisSubscriber.on("message", (channel, message) => {
    if (channel === "charger_status_updates" && io) {
      try {
        const payload = JSON.parse(message);
        // Broadcast the update to all connected clients
        io.emit("CHARGER_STATUS_UPDATE", payload);
      } catch (error) {
        logger.error(`Error processing charger_status_updates message: ${error}`);
      }
    } else if (channel === "ocpp_logs" && io) {
      try {
        const payload = JSON.parse(message);
        // Broadcast OCPP log to all authenticated realtime socket clients
        io.emit("OCPP_LOG", payload);
      } catch (error) {
        logger.error(`Error processing ocpp_logs message in realtime socket: ${error}`);
      }
    }
  });

  logger.info("Socket.IO realtime server attached to HTTP server at /api/realtime");
}

export function getIO(): SocketIOServer | null {
  return io;
}
