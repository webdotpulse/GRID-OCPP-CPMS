import { WebSocket } from "ws";
import { logger } from "../utils/logger.js";
import { prisma } from "../config/database.js";
import { chargerRegistry } from "./chargerRegistry.js";
import { handleOcppMessage } from "./messageHandlers.js";
import { pendingRequests } from "./remoteControl.js";
import { resolveMappedCardId } from "./quirkNormalizer.js";

class ProxyRouter {
  private activeProxies: Map<number, WebSocket> = new Map();
  // Map of <chargerId> to <Map of MessageId -> Action> to track pending requests for interception
  private pendingStartTransactions: Map<number, Map<string, string>> = new Map();
  // Cache for charger quirk rules: <chargerId> -> { rules, expiresAt }
  private quirkRulesCache: Map<number, { rules: any; expiresAt: number }> = new Map();

  hasProxy(chargerId: number): boolean {
    return this.activeProxies.has(chargerId);
  }

  async getQuirkRulesForCharger(chargerId: number): Promise<any> {
    const cached = this.quirkRulesCache.get(chargerId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.rules;
    }
    try {
      const charger = await prisma.charger.findUnique({
        where: { charger_id: chargerId },
        include: { quirkProfile: true },
      });
      const rules = charger?.quirkProfile?.rules || null;
      this.quirkRulesCache.set(chargerId, { rules, expiresAt: now + 60000 });
      return rules;
    } catch (err) {
      logger.error(`Error fetching quirk rules for proxy router (charger ${chargerId}): ${err}`);
      return null;
    }
  }

  clearQuirkRulesCache(chargerId?: number): void {
    if (chargerId) {
      this.quirkRulesCache.delete(chargerId);
    } else {
      this.quirkRulesCache.clear();
    }
  }

  setupProxy(chargerId: number, url: string, protocol: string): void {
    if (this.hasProxy(chargerId)) {
      logger.warn(`Proxy already exists for charger ${chargerId}, cleaning up before creating new one.`);
      this.removeProxy(chargerId);
    }

    try {
      const chargerConnection = chargerRegistry.getConnection(chargerId);
      if (!chargerConnection || !chargerConnection.ws) {
        logger.error(`Cannot setup proxy for charger ${chargerId}: Local connection not found in registry.`);
        return;
      }

      // Enforce secure websocket for 3rd-party connection if specified or needed
      const secureUrl = url.startsWith("ws://") ? url.replace("ws://", "wss://") : url;

      logger.info(`Setting up proxy for charger ${chargerId} to ${secureUrl}`);

      const remoteWs = new WebSocket(secureUrl, [protocol]);

      remoteWs.on("open", () => {
        logger.info(`Proxy connection established for charger ${chargerId} to ${url}`);
      });

      remoteWs.on("message", async (data: Buffer) => {
        // Forward message from 3rd party backend to the charger
        try {
          const messageStr = data.toString();
          const message = JSON.parse(messageStr);

          // Check if this is a CALL from 3rd party backend targeted at Channel 2 of a combined charger
          if (message[0] === 2) {
            const action = message[2];
            const payload = message[3] || {};
            const targetConnectorId = payload.connectorId ?? payload.evseId;

            const charger = await prisma.charger.findUnique({
              where: { charger_id: chargerId },
              select: { isCombined: true, pairedRole: true, pairedChargerId: true }
            });

            if (charger?.isCombined && charger.pairedRole === "primary" && charger.pairedChargerId && targetConnectorId === 2) {
              const secondaryConnection = chargerRegistry.getConnection(charger.pairedChargerId);
              if (secondaryConnection?.ws && secondaryConnection.ws.readyState === WebSocket.OPEN) {
                const translatedPayload = { ...payload };
                if (translatedPayload.connectorId !== undefined) translatedPayload.connectorId = 1;
                if (translatedPayload.evseId !== undefined) translatedPayload.evseId = 1;
                const translatedMessage = [message[0], message[1], message[2], translatedPayload];
                logger.info(`🔄 [PROXY] Forwarding remote command for Channel 2 to secondary charger ${charger.pairedChargerId}: ${JSON.stringify(translatedMessage)}`);
                secondaryConnection.ws.send(JSON.stringify(translatedMessage));
                return;
              } else {
                logger.warn(`Secondary charger ${charger.pairedChargerId} connection not available for Channel 2 command`);
              }
            }
          }

          if (chargerConnection.ws.readyState === WebSocket.OPEN) {
             logger.info(`🔄 [PROXY] Forwarding remote message to charger ${chargerId}: ${messageStr}`);
             chargerConnection.ws.send(messageStr);
          } else {
             logger.warn(`Cannot forward message to charger ${chargerId}, local socket not open.`);
          }

          // Intercept StartTransaction CALLRESULT to sync transaction ID
          if (message[0] === 3) { // CALLRESULT
            const messageId = message[1];
            const payload = message[2];

            const chargerPending = this.pendingStartTransactions.get(chargerId);
            if (chargerPending && chargerPending.has(messageId)) {
               const action = chargerPending.get(messageId);
               if (action === "StartTransaction" && payload.transactionId) {
                  const thirdPartyTransactionId = payload.transactionId;
                  logger.info(`🔄 [PROXY] Intercepted StartTransaction response for charger ${chargerId}, attempting to sync local Transaction to third-party ID: ${thirdPartyTransactionId}`);

                  // Use a retry mechanism to wait for local handleOcppMessage to create the transaction
                  let retries = 0;
                  const maxRetries = 5;

                  const syncTransactionId = async () => {
                     try {
                        // Try to find the latest transaction for this charger that is either initiated or recently started charging
                        const recentTransactions = await prisma.transaction.findMany({
                           where: {
                              charger_id: chargerId,
                              status: { in: ["initiated", "charging"] }
                           },
                           orderBy: {
                              startTime: "desc"
                           },
                           take: 1
                        });

                        let updatedCount = 0;
                        if (recentTransactions.length > 0) {
                           const latestTx = recentTransactions[0];
                           // Only sync if it doesn't match the third party one
                           if (latestTx.transactionId !== String(thirdPartyTransactionId)) {
                               const oldTransactionId = latestTx.transactionId;
                               await prisma.transaction.update({
                                   where: { id: latestTx.id },
                                   data: { transactionId: String(thirdPartyTransactionId) }
                               });

                               // Also update RfidSession if it exists
                               await prisma.rfidSession.updateMany({
                                   where: {
                                      charger_id: chargerId,
                                      transactionId: oldTransactionId
                                   },
                                   data: { transactionId: String(thirdPartyTransactionId) }
                               });

                               // Update registry
                               try {
                                   const connection = chargerRegistry.getConnection(chargerId);
                                   if (connection && connection.transactions.has(oldTransactionId)) {
                                      const txData = connection.transactions.get(oldTransactionId)!;
                                      txData.transactionId = String(thirdPartyTransactionId);
                                      connection.transactions.delete(oldTransactionId);
                                      connection.transactions.set(String(thirdPartyTransactionId), txData);
                                   }
                               } catch (regErr) {
                                   logger.warn(`Failed to update charger registry transaction id: ${regErr}`);
                               }

                               updatedCount = 1;
                           } else {
                               // Already synced
                               updatedCount = 1;
                           }
                        }

                        if (updatedCount > 0) {
                           logger.info(`🔄 [PROXY] Successfully synced local Transaction to third-party ID: ${thirdPartyTransactionId}`);
                        } else if (retries < maxRetries) {
                           retries++;
                           logger.debug(`🔄 [PROXY] Local Transaction not found yet for charger ${chargerId}. Retrying (${retries}/${maxRetries}) in 500ms...`);
                           setTimeout(syncTransactionId, 500);
                        } else {
                           logger.warn(`🔄 [PROXY] Failed to sync transaction ID for charger ${chargerId} after ${maxRetries} retries. Initial local transaction may not have been created.`);
                        }
                     } catch (err) {
                        logger.error(`🔄 [PROXY] Error syncing intercepted transaction ID: ${err}`);
                     }
                  };

                  // Initial execution after brief delay
                  setTimeout(syncTransactionId, 500);
               }
               chargerPending.delete(messageId);
            }
          }
        } catch (err) {
          logger.error(`Error forwarding message to charger ${chargerId}: ${err}`);
        }
      });

      remoteWs.on("close", () => {
        logger.info(`Proxy connection closed for charger ${chargerId}. Forcing local disconnect to sync.`);
        this.activeProxies.delete(chargerId);

        // Disconnect local socket if upstream disconnects to force a clean reconnect
        if (chargerConnection.ws && chargerConnection.ws.readyState === WebSocket.OPEN) {
          chargerConnection.ws.terminate();
        }
      });

      remoteWs.on("error", (error) => {
        logger.error(`Proxy connection error for charger ${chargerId}: ${error}. Forcing local disconnect.`);

        // Disconnect local socket if upstream errors to force a clean reconnect
        if (chargerConnection.ws && chargerConnection.ws.readyState === WebSocket.OPEN) {
          chargerConnection.ws.terminate();
        }
      });

      this.activeProxies.set(chargerId, remoteWs);

    } catch (error) {
      logger.error(`Failed to establish proxy connection for charger ${chargerId}: ${error}`);
    }
  }

  removeProxy(chargerId: number): void {
    const remoteWs = this.activeProxies.get(chargerId);
    if (remoteWs) {
      if (remoteWs.readyState === WebSocket.OPEN || remoteWs.readyState === WebSocket.CONNECTING) {
        remoteWs.close();
      }
      this.activeProxies.delete(chargerId);
      logger.info(`Removed proxy for charger ${chargerId}`);
    }
  }

  async handleMessageFromCharger(chargerId: number, message: any, protocol: string): Promise<void> {
    let remoteWs = this.activeProxies.get(chargerId);

    // Look up charger details for paired combined charger support
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      select: { isCombined: true, pairedRole: true, pairedChargerId: true }
    });

    // If secondary charger doesn't have an active proxy connection of its own, check if primary has one
    if (!remoteWs && charger?.isCombined && charger.pairedRole === "secondary" && charger.pairedChargerId) {
      remoteWs = this.activeProxies.get(charger.pairedChargerId);
    }

    // Do not forward CALLRESULT/CALLERROR if they are responses to local commands
    let shouldForward = true;
    if (message[0] === 3 || message[0] === 4) {
      if (pendingRequests.has(message[1])) {
        shouldForward = false;
        logger.info(`🔄 [PROXY] Suppressing forward for local command response: ${message[1]}`);
      }
    }

    let messageToForward = message;

    // Check if card ID translation or channel mapping is required before forwarding to third-party backend
    if (message[0] === 2 && message[3]) {
      try {
        const originalPayload = message[3];
        const forwardedPayload = JSON.parse(JSON.stringify(originalPayload));
        let modified = false;

        // If secondary charger in combined setup, map connector 1 to connector 2 (Channel 2)
        if (charger?.isCombined && charger.pairedRole === "secondary") {
          if (forwardedPayload.connectorId === 1) {
            forwardedPayload.connectorId = 2;
            modified = true;
          }
          if (forwardedPayload.evseId === 1) {
            forwardedPayload.evseId = 2;
            modified = true;
          }
          if (forwardedPayload.evse?.id === 1) {
            forwardedPayload.evse.id = 2;
            modified = true;
          }
        }

        const rules = await this.getQuirkRulesForCharger(chargerId);
        if (rules) {
          // 1. OCPP 1.6 idTag translation (e.g. Authorize, StartTransaction, StopTransaction)
          if (forwardedPayload.idTag && typeof forwardedPayload.idTag === "string") {
            const mappedTag = resolveMappedCardId(forwardedPayload.idTag, rules);
            if (mappedTag !== forwardedPayload.idTag) {
              logger.info(`🔄 [PROXY] Translated idTag from "${forwardedPayload.idTag}" to "${mappedTag}" for charger ${chargerId} (action: ${message[2]})`);
              forwardedPayload.idTag = mappedTag;
              modified = true;
            }
          }

          // 2. OCPP 2.0.1 / 2.1 idToken translation (e.g. Authorize, TransactionEvent)
          if (forwardedPayload.idToken && typeof forwardedPayload.idToken === "object" && typeof forwardedPayload.idToken.idToken === "string") {
            const mappedTag = resolveMappedCardId(forwardedPayload.idToken.idToken, rules);
            if (mappedTag !== forwardedPayload.idToken.idToken) {
              logger.info(`🔄 [PROXY] Translated idToken from "${forwardedPayload.idToken.idToken}" to "${mappedTag}" for charger ${chargerId} (action: ${message[2]})`);
              forwardedPayload.idToken.idToken = mappedTag;
              modified = true;
            }
          }

          // 3. Nested idToken inside transactionInfo / event
          if (forwardedPayload.transactionInfo?.idToken?.idToken && typeof forwardedPayload.transactionInfo.idToken.idToken === "string") {
            const mappedTag = resolveMappedCardId(forwardedPayload.transactionInfo.idToken.idToken, rules);
            if (mappedTag !== forwardedPayload.transactionInfo.idToken.idToken) {
              logger.info(`🔄 [PROXY] Translated transactionInfo idToken from "${forwardedPayload.transactionInfo.idToken.idToken}" to "${mappedTag}" for charger ${chargerId}`);
              forwardedPayload.transactionInfo.idToken.idToken = mappedTag;
              modified = true;
            }
          }
        }

        if (modified) {
          messageToForward = [message[0], message[1], message[2], forwardedPayload];
        }
      } catch (transErr) {
        logger.error(`🔄 [PROXY] Error evaluating message translation for charger ${chargerId}: ${transErr}`);
      }
    }

    // Forward message to 3rd party backend
    if (shouldForward) {
      if (remoteWs && remoteWs.readyState === WebSocket.OPEN) {
        logger.info(`🔄 [PROXY] Forwarding local message from charger ${chargerId} to remote: ${JSON.stringify(messageToForward)}`);
        remoteWs.send(JSON.stringify(messageToForward));
      } else {
        logger.warn(`🔄 [PROXY] Cannot forward message for charger ${chargerId}, remote socket not open`);
      }
    }

    // Track StartTransaction to intercept the response
    if (message[0] === 2 && message[2] === "StartTransaction") {
       if (!this.pendingStartTransactions.has(chargerId)) {
          this.pendingStartTransactions.set(chargerId, new Map());
       }
       this.pendingStartTransactions.get(chargerId)?.set(message[1], "StartTransaction");
    }

    // Mirror traffic locally for data duplication
    try {
      const messageType = message[0];
      const messageId = message[1];
      const actionName = message[2];
      const payload = message[3];

      // Mirror traffic locally for data duplication
      if (messageType === 2) {
         try {
           await handleOcppMessage(chargerId, messageType, messageId, actionName, payload, protocol);
         } catch (err) {
           logger.error(`🔄 [PROXY] Error mirroring local message for charger ${chargerId}: ${err}`);
         }
      } else if (messageType === 3 || messageType === 4) {
         // It's a response to a local command, manually resolve the pending promise
         const pending = pendingRequests.get(messageId);
         if (pending) {
            clearTimeout(pending.timeout);
            if (messageType === 3) {
               pending.resolve(message[2]); // CALLRESULT payload
            } else {
               pending.reject(message.slice(2)); // CALLERROR array
            }
            pendingRequests.delete(messageId);
         }
      }
    } catch (err) {
      logger.error(`🔄 [PROXY] Error preparing mirrored message for charger ${chargerId}: ${err}`);
    }
  }
}

export const proxyRouter = new ProxyRouter();

