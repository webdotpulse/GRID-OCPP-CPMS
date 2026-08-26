import { WebSocket, WebSocketServer } from "ws";
import * as http from "http";
import { config } from "../config/index.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { chargerRegistry } from "./chargerRegistry.js";
import { handleOcppMessage } from "./messageHandlers.js";
import { triggerMessage } from "./remoteControl.js";
import { redisPublisher } from "../config/redis.js";
import { pendingRequests } from "./remoteControl.js";
import { proxyRouter } from "./proxyRouter.js";

const ipConnectionCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_UPGRADES_PER_MINUTE = 60;

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipConnectionCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipConnectionCounts.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_UPGRADES_PER_MINUTE;
}

class OcppServer {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  start(): void {
    this.httpServer = http.createServer();
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 1024 * 1024, // 1MB maximum payload per frame for security
      handleProtocols: (protocols, request) => {
        if (protocols.has("ocpp2.1")) return "ocpp2.1";
        if (protocols.has("ocpp2.0.1")) return "ocpp2.0.1";
        if (protocols.has("ocpp1.6")) return "ocpp1.6";
        // Reject the connection if no supported protocol is provided
        return false;
      },
    });

    // Handle the upgrade event to implement optional authentication
    this.httpServer.on("upgrade", async (request, socket, head) => {
      try {
        const clientIp = request.socket.remoteAddress || "unknown";
        if (isIpRateLimited(clientIp)) {
          logger.warn(`Rate limiting WebSocket connection attempt from IP: ${clientIp}`);
          socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
          socket.destroy();
          return;
        }

        const pathParts = request.url?.split("?")[0].split("/").filter(Boolean);
        const chargerIdStr = pathParts?.[pathParts.length - 1];

        if (!chargerIdStr) {
          logger.error("No charger ID in connection path during upgrade");
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
          return;
        }

        const chargerIdNum = Number(chargerIdStr);
        const isNumericId = Number.isInteger(chargerIdNum) && chargerIdStr.trim() !== "";

        const charger = await prisma.charger.findUnique({
          where: isNumericId ? { charger_id: chargerIdNum } : { name: chargerIdStr },
        });

        if (!charger) {
          logger.error(`Charger ${chargerIdStr} not found during upgrade`);

          try {
            const existing = await prisma.unrecognizedConnection.findFirst({
              where: { chargePointId: chargerIdStr },
            });
            if (existing) {
              await prisma.unrecognizedConnection.update({
                where: { id: existing.id },
                data: {
                  ipAddress: request.socket.remoteAddress || "Unknown",
                  reason: "Charger not found in database",
                  timestamp: new Date(),
                },
              });
            } else {
              await prisma.unrecognizedConnection.create({
                data: {
                  chargePointId: chargerIdStr,
                  ipAddress: request.socket.remoteAddress || "Unknown",
                  reason: "Charger not found in database",
                },
              });
            }
          } catch (err: any) {
            logger.error(`Failed to log unrecognized connection during upgrade: ${err}`);
          }

          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        if (charger.requireAuth) {
          const authHeader = request.headers.authorization;
          if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) {
            logger.warn(`Charger ${chargerIdStr} requires auth but no Basic auth provided`);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          const base64Credentials = authHeader.split(' ')[1];
          const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
          const separatorIndex = credentials.indexOf(':');
          const password = separatorIndex !== -1 ? credentials.slice(separatorIndex + 1) : '';

          if (password !== charger.authPassword) {
            logger.warn(`Charger ${chargerIdStr} provided invalid auth password`);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
        }

        if (this.wss) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            if (this.wss) {
              this.wss.emit('connection', ws, request);
            }
          });
        } else {
          socket.destroy();
        }
      } catch (err) {
        logger.error(`Error during websocket upgrade interception: ${err}`);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    // The HTTP server will handle listening and emit listening events
    this.httpServer.listen(config.ocppPort, () => {
      logger.info(`OCPP server listening on port ${config.ocppPort}`);
    });

    this.wss.on("connection", this.handleConnection.bind(this));

    this.wss.on("error", (error) => {
      logger.error(`OCPP WebSocket error: ${error}`);
    });

    this.wss.on("close", () => {
      logger.info("OCPP WebSocket server closed");
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });

    // Start Ping/Pong interval
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as WebSocket & { isAlive: boolean };
        if (extWs.isAlive === false) {
          logger.warn("Terminating dead WebSocket connection");
          return ws.terminate();
        }
        extWs.isAlive = false;
        ws.ping();
      });
    }, config.websocketPingInterval * 1000);
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    try {
      const extWs = ws as WebSocket & { isAlive: boolean };
      extWs.isAlive = true;

      // Extract charger ID from URL path: /{chargerId}
      const pathParts = request.url?.split("?")[0].split("/").filter(Boolean);
      const chargerIdStr = pathParts?.[pathParts.length - 1];

      if (!chargerIdStr) {
        logger.error("No charger ID in connection path");
        ws.close();
        return;
      }

      const chargerIdNum = Number(chargerIdStr);
      const isNumericId = Number.isInteger(chargerIdNum) && chargerIdStr.trim() !== "";

      // Verify charger exists in database by numeric ID or name
      const charger = await prisma.charger.findUnique({
        where: isNumericId ? { charger_id: chargerIdNum } : { name: chargerIdStr },
      });

      if (!charger) {
        logger.error(`Charger ${chargerIdStr} not found in database (after upgrade)`);
        ws.close();
        return;
      }

      const chargerId = charger.charger_id;

      ws.on("pong", () => {
        extWs.isAlive = true;
        // Keep connection alive in registry on pong
        chargerRegistry.updateHeartbeat(chargerId).catch((err) => {
          logger.error(`Error updating heartbeat for charger ${chargerId} on pong: ${err}`);
        });
      });

      if (charger.status === "disabled") {
        logger.error(`Charger ${chargerId} is disabled`);
        // Log unrecognized connection
        try {
          const existing = await prisma.unrecognizedConnection.findFirst({
            where: { chargePointId: chargerIdStr },
          });
          if (existing) {
            await prisma.unrecognizedConnection.update({
              where: { id: existing.id },
              data: {
                ipAddress: request.socket.remoteAddress || "Unknown",
                reason: "Charger is disabled",
                timestamp: new Date(),
              },
            });
          } else {
            await prisma.unrecognizedConnection.create({
              data: {
                chargePointId: chargerIdStr,
                ipAddress: request.socket.remoteAddress || "Unknown",
                reason: "Charger is disabled",
              },
            });
          }
        } catch (err: any) {
          logger.error(`Failed to log unrecognized connection: ${err}`);
        }

        ws.close();
        return;
      }

      logger.info(`New connection from charger ${charger.name} (ID: ${chargerId})`);

      // Update charger status to active in database
      await prisma.charger.update({
        where: { charger_id: chargerId },
        data: { status: "active", last_heartbeat: new Date() },
      });

      // Trigger BootNotification if hardware details are missing
      if (charger.firmware_version === "Unknown" || !charger.manufacturer || !charger.model) {
        logger.info(`Charger ${chargerId} is missing hardware details. Triggering BootNotification in 5s...`);
        setTimeout(async () => {
          try {
            await triggerMessage(chargerId, "BootNotification");
          } catch (e) {
            logger.error(`Failed to trigger BootNotification for charger ${chargerId}: ${e}`);
          }
        }, 5000);
      }

      // Register charger connection
      chargerRegistry.register(chargerId, charger.name, ws);

      if (charger.thirdPartyBackendUrl) {
        let thirdPartyUrl = charger.thirdPartyBackendUrl;
        if (thirdPartyUrl && !thirdPartyUrl.endsWith(charger.name)) {
            thirdPartyUrl = thirdPartyUrl.endsWith('/') ? thirdPartyUrl + charger.name : thirdPartyUrl + '/' + charger.name;
        }
        proxyRouter.setupProxy(chargerId, thirdPartyUrl, ws.protocol);
      }

      ws.on("message", async (data: Buffer) => {
        try {
          // Update registry heartbeat on any incoming message
          chargerRegistry.updateHeartbeat(chargerId).catch((err) => {
             logger.error(`Error updating heartbeat for charger ${chargerId} on message: ${err}`);
          });

          const message = JSON.parse(data.toString());
          // Log incoming message
          logger.info(`📩 [OCPP IN] Charger ${chargerId} [${ws.protocol}]: ${JSON.stringify(message)}`);

          if (proxyRouter.hasProxy(chargerId)) {
            await proxyRouter.handleMessageFromCharger(chargerId, message, ws.protocol);
          } else {
            await this.handleOcppMessage(chargerId, message, ws.protocol);
          }
        } catch (error) {
          logger.error(`Error parsing OCPP message: ${error}`);
        }
      });

      ws.on("close", () => {
        // Prevent race condition: if the active connection in the registry isn't this closing websocket,
        // it means the charger quickly reconnected with a new socket. Do not mark as offline.
        const currentConnection = chargerRegistry.getConnection(chargerId);
        if (currentConnection && currentConnection.ws !== ws) {
          logger.info(`Charger ${charger.name} (ID: ${chargerId}) disconnected (stale connection ignored)`);
          return;
        }

        proxyRouter.removeProxy(chargerId);
        logger.info(`Charger ${charger.name} (ID: ${chargerId}) disconnected`);

        // Clear any pending requests for this charger
        for (const [messageId, request] of pendingRequests.entries()) {
          if (request.chargerId === chargerId) {
            clearTimeout(request.timeout);
            request.reject(new Error("Charger disconnected"));
            pendingRequests.delete(messageId);
          }
        }
        chargerRegistry.unregister(chargerId).then(async () => {
          // Verify it is truly offline before marking offline in DB (might have reconnected elsewhere)
          if (!(await chargerRegistry.isConnectedGlobally(chargerId))) {
            // Update charger status to offline and all its connectors to Unavailable
            Promise.all([
              prisma.charger.update({
                where: { charger_id: chargerId },
                data: { status: "offline" },
              }),
              prisma.connector.updateMany({
                where: { evse: { charger_id: chargerId } },
                data: { status: "Unavailable", updatedAt: new Date() },
              })
            ]).catch((err) => logger.error(`Error updating charger/connector status on disconnect: ${err}`));

            redisPublisher.publish("charger_status_updates", JSON.stringify({ chargerId }));
          }
        }).catch(err => logger.error(`Error during unregister: ${err}`));
      });

      ws.on("error", (error) => {
        logger.error(`WebSocket error for charger ${chargerId}: ${error}`);
      });
    } catch (error) {
      logger.error(`Error handling connection: ${error}`);
      ws.close();
    }
  }

  private async handleOcppMessage(
    chargerId: number,
    message: any,
    protocol: string
  ): Promise<void> {
    // OCPP 1.6 message formats:
    //   CALL:       [2, messageId, actionName, payload]
    //   CALLRESULT: [3, messageId, payload]
    //   CALLERROR:  [4, messageId, errorCode, errorDescription, errorDetails]
    const messageType = message[0];
    const messageId = message[1];

    // Handle CALLRESULT (type 3) - response from charger to our requests
    if (messageType === 3) {
      const responsePayload = message[2];
      logger.info(
        `🔌 [OCPP] Received CALLRESULT from charger ${chargerId}, MessageID: ${messageId}: ${JSON.stringify(responsePayload)}`
      );

      // Check local pending requests first
      const pending = pendingRequests.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(responsePayload);
        pendingRequests.delete(messageId);
      }

      // Publish to distributed Redis response channel and cluster channel
      const resultData = {
        messageId,
        status: "Accepted",
        payload: responsePayload,
        chargerId,
        ...responsePayload,
      };
      redisPublisher.publish(`ocpp:res:${messageId}`, JSON.stringify(resultData));
      redisPublisher.publish("ocpp_callresults", JSON.stringify(resultData));
      return;
    }

    // Handle CALLERROR (type 4) - error response from charger
    if (messageType === 4) {
      const [, , errorCode, errorDescription, errorDetails] = message;

      let subCodeInfo = "";
      if (errorDetails && typeof errorDetails === 'object' && errorDetails.SubCode) {
        subCodeInfo = ` (SubCode: ${errorDetails.SubCode})`;
      }

      logger.error(
        `🔌 [OCPP] Received CALLERROR from charger ${chargerId}, MessageID: ${messageId}: ${errorCode}${subCodeInfo} - ${errorDescription}`
      );

      const pending = pendingRequests.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`[${errorCode}${subCodeInfo}] ${errorDescription} - ${JSON.stringify(errorDetails || {})}`));
        pendingRequests.delete(messageId);
      }

      // Publish to distributed Redis response channel and cluster channel
      const errorData = {
        messageId,
        status: "Rejected",
        errorCode,
        error: errorDescription,
        payload: errorDetails,
        chargerId,
      };
      redisPublisher.publish(`ocpp:res:${messageId}`, JSON.stringify(errorData));
      redisPublisher.publish("ocpp_callresults", JSON.stringify(errorData));
      return;
    }

    // Handle CALL (type 2) - request from charger
    const actionName = message[2];
    const payload = message[3];

    const actionDisplayName = actionName || "Unknown";
    logger.info(
      `🔌 [OCPP] Received ${actionDisplayName} from charger ${chargerId}, MessageID: ${messageId}`
    );

    try {
      const responsePayload = await handleOcppMessage(
        chargerId,
        messageType,
        messageId,
        actionName,
        payload,
        protocol
      );

      // Send CALLRESULT: [3, messageId, responsePayload]
      const response = [3, messageId, responsePayload];

      // Log outgoing response
      logger.info(`📤 [OCPP OUT] ${actionName}Response to charger ${chargerId}, MessageID: ${messageId}: ${JSON.stringify(response)}`);

      const connection = chargerRegistry.getConnection(chargerId);
      if (connection?.ws) {
        connection.ws.send(JSON.stringify(response));
      }
    } catch (error: any) {
      logger.error(`Error handling OCPP message: ${error}`);

      const errorCode = error.errorCode || "InternalError";
      const errorDescription = error.errorDescription || error.message || "An internal error occurred";
      const errorDetails = error.errorDetails || {};

      const errorResponse = [4, messageId, errorCode, errorDescription, errorDetails];

      logger.error(`📤 [OCPP ERROR OUT] Sending CALLERROR to charger ${chargerId}, MessageID: ${messageId}: ${JSON.stringify(errorResponse)}`);

      const connection = chargerRegistry.getConnection(chargerId);
      if (connection?.ws) {
        connection.ws.send(JSON.stringify(errorResponse));
      }
    }
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Clear all pending requests
    for (const [messageId, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Server stopping"));
      pendingRequests.delete(messageId);
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    logger.info("OCPP server stopped");
  }
}

// Singleton instance
export const ocppServer = new OcppServer();
