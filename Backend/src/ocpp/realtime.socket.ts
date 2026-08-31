import { Server as SocketIOServer } from "socket.io";
import * as http from "http";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { redisSubscriber } from "../config/redis.js";
import { logger } from "../utils/logger.js";

let io: SocketIOServer | null = null;

export function setupRealtimeSocket(server: http.Server): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [
        process.env.FRONTEND_URL || "http://localhost:3002",
        "http://localhost:3000",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3000",
      ];

  io = new SocketIOServer(server, {
    path: "/api/realtime",
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        return callback(new Error("CORS policy violation on realtime socket"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authenticate socket connections using JWT token
  io.use((socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

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

    socket.on("disconnect", () => {
      logger.info(`Realtime client disconnected: ${socket.id}`);
    });
  });

  // Setup Redis Subscription for charger status updates
  redisSubscriber.subscribe("charger_status_updates", (err) => {
    if (err) {
      logger.error(`Failed to subscribe to charger_status_updates: ${err}`);
    } else {
      logger.info("Subscribed to charger_status_updates Redis channel");
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
    }
  });

  logger.info("Socket.IO realtime server attached to HTTP server at /api/realtime");
}

export function getIO(): SocketIOServer | null {
  return io;
}
