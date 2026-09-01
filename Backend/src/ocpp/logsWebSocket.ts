import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { prisma } from "../config/database.js";
import type { OcppMessage } from "../types/index.js";
import { isOriginAllowed } from "../utils/cors.js";
import { redisSubscriber } from "../config/redis.js";
import http from "http";

class OcppLogsServer {
  private wss: WebSocketServer | null = null;

  start(server: http.Server): void {
    // Instead of binding to a separate port, bind to the existing Express HTTP server
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const urlStr = request.url || "";
      const pathname = urlStr.split("?")[0].replace(/\/+$/, "");

      if (
        pathname === "/api/ocpp-logs" ||
        pathname === "/api/ocpp/logs" ||
        pathname === "/ocpp-logs"
      ) {
        // Verify Origin
        const origin = request.headers.origin;
        if (!isOriginAllowed(origin)) {
          logger.warn(`CORS policy blocked WebSocket connection to ${pathname} from origin: ${origin}`);
          socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }

        try {
          const parsedUrl = new URL(urlStr, `http://${request.headers.host || "localhost"}`);
          let token = parsedUrl.searchParams.get("token");

          if (!token && request.headers.authorization) {
            const authHeader = request.headers.authorization;
            if (authHeader.startsWith("Bearer ")) {
              token = authHeader.substring(7).trim();
            }
          }

          if (!token && request.headers["sec-websocket-protocol"]) {
            const protocols = request.headers["sec-websocket-protocol"].split(",").map((p: string) => p.trim());
            const tokenProtocol = protocols.find((p: string) => p.startsWith("token."));
            if (tokenProtocol) {
              token = tokenProtocol.substring(6);
            }
          }

          if (!token) {
            logger.warn(`Rejected unauthenticated WebSocket connection to ${pathname}: Missing token`);
            socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
          }

          const decoded = jwt.verify(token, config.jwtSecret) as {
            userId: number;
            email: string;
            role: string;
          };

          if (decoded.role !== "admin" && decoded.role !== "superadmin") {
            logger.warn(`Rejected WebSocket connection to ${pathname} for user ${decoded.userId}: Insufficient role (${decoded.role})`);
            socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
          }

          this.wss?.handleUpgrade(request, socket, head, (ws) => {
            (ws as any).user = decoded;
            this.wss?.emit("connection", ws, request);
          });
        } catch (authErr: any) {
          logger.warn(`Failed WebSocket authentication for ${pathname}: ${authErr.message}`);
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }
      }
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    this.wss.on("error", (error) => {
      logger.error(`OCPP logs WebSocket error: ${error}`);
    });

    this.setupRedisSubscription();
    logger.info(`OCPP logs WebSocket attached to main HTTP server at /api/ocpp-logs`);
  }

  private setupRedisSubscription(): void {
    redisSubscriber.subscribe("ocpp_logs", (err) => {
      if (err) logger.error(`Failed to subscribe to ocpp_logs: ${err}`);
      else logger.info("Subscribed to ocpp_logs Redis channel");
    });

    redisSubscriber.on("message", (channel, message) => {
      if (channel === "ocpp_logs") {
        try {
          const log = JSON.parse(message);
          this.broadcast({
            type: "log",
            log,
          });
        } catch (error) {
          logger.error(`Error processing Redis pub/sub log: ${error}`);
        }
      }
    });
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    logger.info(`OCPP logs client connected. Total clients: ${this.getClientCount()}`);

    // Send welcome message
    this.broadcastToClient(ws, {
      type: "welcome",
      message: "Connected to OCPP logs stream",
      clientCount: this.getClientCount(),
    });

    // Send recent logs (last 50)
    const recentLogs = await prisma.ocppLog.findMany({
      take: 50,
      orderBy: { timestamp: "desc" },
      include: { charger: true },
    });

    this.broadcastToClient(ws, {
      type: "history",
      logs: recentLogs.reverse(), // Send in chronological order
    });

    ws.on("close", () => {
      logger.info(`OCPP logs client disconnected. Total clients: ${this.getClientCount() - 1}`);
    });

    ws.on("error", (error) => {
      logger.error(`OCPP logs WebSocket client error: ${error}`);
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data: any): void {
    if (!this.wss) return;

    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private broadcastToClient(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Get current client count
   */
  private getClientCount(): number {
    return this.wss ? this.wss.clients.size : 0;
  }

  /**
   * Broadcast new OCPP log to all clients
   */
  broadcastLog(log: OcppMessage): void {
    this.broadcast({
      type: "log",
      log,
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      logger.info("OCPP logs server stopped");
    }
  }
}

// Singleton instance
export const ocppLogsServer = new OcppLogsServer();
