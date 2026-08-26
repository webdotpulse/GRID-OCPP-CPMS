import { chargerRegistry } from "./chargerRegistry.js";
import { logger } from "../utils/logger.js";
import { redisSubscriber, redisPublisher, redisClient } from "../config/redis.js";

// Distributed pending requests map
export interface DistributedPendingRequest {
  resolve: (val: any) => void;
  timeout: NodeJS.Timeout;
  chargerId: number;
}

export const distributedPendingRequests = new Map<string, DistributedPendingRequest>();

let messageIdCounter = 0;
export function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

// Global subscription for distributed CALLRESULT / CALLERROR responses
redisSubscriber.subscribe("ocpp_callresults", (err) => {
  if (err) logger.error(`Failed to subscribe to ocpp_callresults: ${err}`);
  else logger.info("Subscribed to ocpp_callresults Redis channel");
});

redisSubscriber.on("message", (channel, message) => {
  if (channel.startsWith("ocpp:res:")) {
    const messageId = channel.substring("ocpp:res:".length);
    const pending = distributedPendingRequests.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      distributedPendingRequests.delete(messageId);
      try {
        const data = JSON.parse(message);
        pending.resolve(data);
      } catch {
        pending.resolve({ status: "Accepted" });
      }
      redisSubscriber.unsubscribe(channel).catch(() => {});
    }
  } else if (channel === "ocpp_callresults") {
    try {
      const { messageId, payload, error, status } = JSON.parse(message);
      const pending = distributedPendingRequests.get(messageId);
      if (pending) {
        clearTimeout(pending.timeout);
        distributedPendingRequests.delete(messageId);
        if (error) {
          pending.resolve({ status: status || "Rejected", error, ...(payload || {}) });
        } else {
          pending.resolve({ status: status || "Accepted", ...(payload || {}) });
        }
      }
    } catch (err) {
      logger.error(`Error processing ocpp_callresults in distributedRemoteControl: ${err}`);
    }
  }
});

/**
 * Get protocol for a charger (local or cached in Redis)
 */
export async function getChargerProtocol(chargerId: number): Promise<string | undefined> {
  const connection = chargerRegistry.getConnection(chargerId);
  if (connection) return connection.protocol;
  const cached = await redisClient.hget(chargerRegistry.getRedisKey(chargerId), "protocol");
  return cached || undefined;
}

/**
 * Send an arbitrary distributed OCPP CALL frame over Redis RPC and await response
 */
export async function sendDistributedOcppCall(
  chargerId: number,
  action: string,
  payload: any,
  timeoutMs: number = 15000
): Promise<{ status: string; error?: string; [key: string]: any }> {
  try {
    if (!(await chargerRegistry.isConnectedGlobally(chargerId))) {
      return { status: "Rejected", error: "Charger not connected" };
    }

    const messageId = generateMessageId();
    const commandChannel = `ocpp:cmd:${chargerId}`;
    const responseChannel = `ocpp:res:${messageId}`;

    const ocppFrame = [2, messageId, action, payload];

    const resultPromise = new Promise<{ status: string; error?: string; [key: string]: any }>((resolve) => {
      const timeout = setTimeout(() => {
        distributedPendingRequests.delete(messageId);
        redisSubscriber.unsubscribe(responseChannel).catch(() => {});
        resolve({
          status: "Rejected",
          error: `Timeout waiting for ${action} response after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      distributedPendingRequests.set(messageId, { resolve, timeout, chargerId });
    });

    // Subscribe to response channel before publishing
    await redisSubscriber.subscribe(responseChannel).catch((err) => {
      logger.error(`Failed to subscribe to ${responseChannel}: ${err}`);
    });

    const messageStr = JSON.stringify(ocppFrame);
    await redisPublisher.publish(commandChannel, messageStr);
    await redisPublisher.publish(
      "ocpp_commands",
      JSON.stringify({ chargerId, payload: ocppFrame })
    );

    logger.info(`[Distributed RPC] Sent ${action} (${messageId}) to charger ${chargerId}`);

    const result = await resultPromise;
    return result;
  } catch (error: any) {
    logger.error(`Error in sendDistributedOcppCall for ${action}: ${error}`);
    return { status: "Rejected", error: error.message || `Failed to send ${action}` };
  }
}

/**
 * Send a high-level command (e.g. "Start", "Stop") across protocols via distributed RPC
 */
export async function sendDistributedRemoteCommand(
  chargerId: number,
  command: string,
  params: any,
  timeoutMs: number = 15000
): Promise<{ status: string; error?: string; [key: string]: any }> {
  try {
    if (!(await chargerRegistry.isConnectedGlobally(chargerId))) {
      return { status: "Rejected", error: "Charger not connected" };
    }

    const protocol = await getChargerProtocol(chargerId);
    let action = "";
    let payload: any = {};

    if (protocol === "ocpp2.1" || protocol === "ocpp2.0.1") {
      switch (command) {
        case "Start":
          action = "RequestStartTransaction";
          payload = {
            idToken: { idToken: params.idTag || "12345", type: "ISO14443" },
            remoteStartId: Math.floor(Math.random() * 1000000),
            evseId: params.connectorId,
          };
          break;
        case "Stop":
          action = "RequestStopTransaction";
          payload = { transactionId: params.transactionId };
          break;
        default:
          return {
            status: "Rejected",
            error: `Command ${command} not supported for protocol ${protocol}`,
          };
      }
    } else {
      switch (command) {
        case "Start":
          action = "RemoteStartTransaction";
          payload = {
            connectorId: params.connectorId,
            idTag: params.idTag,
          };
          break;
        case "Stop":
          action = "RemoteStopTransaction";
          payload = { transactionId: params.transactionId };
          break;
        default:
          return {
            status: "Rejected",
            error: `Command ${command} not supported for protocol ${protocol}`,
          };
      }
    }

    return await sendDistributedOcppCall(chargerId, action, payload, timeoutMs);
  } catch (error: any) {
    logger.error(`Error in sendDistributedRemoteCommand for ${command}: ${error}`);
    return { status: "Rejected", error: error.message || `Failed to send ${command}` };
  }
}
