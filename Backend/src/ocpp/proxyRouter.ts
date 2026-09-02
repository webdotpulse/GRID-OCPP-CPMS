import { WebSocket } from "ws";
import { logger } from "../utils/logger.js";
import { prisma } from "../config/database.js";
import { chargerRegistry } from "./chargerRegistry.js";
import { handleOcppMessage } from "./messageHandlers.js";
import { pendingRequests, triggerMessage } from "./remoteControl.js";
import { resolveMappedCardId } from "./quirkNormalizer.js";

/**
 * Format and normalize the third-party proxy URL.
 * Handles protocol schemes (http -> ws, https -> wss) and safely appends charger identifier.
 */
export function formatProxyUrl(rawUrl: string, chargerIdentifier?: string): string {
  let urlStr = rawUrl.trim();
  if (urlStr.startsWith("http://")) {
    urlStr = "ws://" + urlStr.slice(7);
  } else if (urlStr.startsWith("https://")) {
    urlStr = "wss://" + urlStr.slice(8);
  } else if (!urlStr.startsWith("ws://") && !urlStr.startsWith("wss://")) {
    urlStr = "wss://" + urlStr;
  }

  if (!chargerIdentifier) return urlStr;

  try {
    const parsed = new URL(urlStr);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];

    // Check if the URL path already ends with this charger identifier or URL-encoded identifier
    if (
      !lastPart ||
      (lastPart !== chargerIdentifier && decodeURIComponent(lastPart) !== chargerIdentifier)
    ) {
      parsed.pathname = parsed.pathname.endsWith("/")
        ? `${parsed.pathname}${encodeURIComponent(chargerIdentifier)}`
        : `${parsed.pathname}/${encodeURIComponent(chargerIdentifier)}`;
    }
    return parsed.toString();
  } catch {
    // Fallback string manipulation if URL parsing fails
    if (!urlStr.endsWith(chargerIdentifier)) {
      return urlStr.endsWith("/")
        ? `${urlStr}${encodeURIComponent(chargerIdentifier)}`
        : `${urlStr}/${encodeURIComponent(chargerIdentifier)}`;
    }
    return urlStr;
  }
}

interface ProxyConfig {
  rawUrl: string;
  targetUrl: string;
  protocol: string;
  chargerName?: string;
  retryCount: number;
  retryTimer?: NodeJS.Timeout;
}

class ProxyRouter {
  private activeProxies: Map<number, WebSocket> = new Map();
  private proxyConfigs: Map<number, ProxyConfig> = new Map();
  // Map of <chargerId> to <Map of MessageId -> Action> to track pending requests for interception
  private pendingStartTransactions: Map<number, Map<string, string>> = new Map();
  // Map of messageId -> { timeout, localFallbackPayload, chargerId } for timeout fallback when remote CSMS hangs
  private pendingForwardedCalls: Map<string, { timeout: NodeJS.Timeout; localFallbackPayload: any; chargerId: number; actionName: string }> = new Map();
  // Cache for charger quirk rules: <chargerId> -> { rules, expiresAt }
  private quirkRulesCache: Map<number, { rules: any; expiresAt: number }> = new Map();

  hasProxy(chargerId: number): boolean {
    return this.activeProxies.has(chargerId);
  }

  isProxyConfigured(chargerId: number): boolean {
    return this.proxyConfigs.has(chargerId);
  }

  getActiveProxy(chargerId: number): WebSocket | undefined {
    return this.activeProxies.get(chargerId);
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

  setupProxy(chargerId: number, url: string, protocol: string = "ocpp1.6", chargerName?: string): void {
    // Clear any existing active connection and pending retry timers for this charger
    const existingConfig = this.proxyConfigs.get(chargerId);
    if (existingConfig?.retryTimer) {
      clearTimeout(existingConfig.retryTimer);
    }

    const existingWs = this.activeProxies.get(chargerId);
    if (existingWs) {
      this.activeProxies.delete(chargerId);
      try {
        if (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING) {
          existingWs.close();
        }
      } catch (err) {
        logger.debug(`Error closing existing proxy socket for charger ${chargerId}: ${err}`);
      }
    }

    const targetUrl = formatProxyUrl(url, chargerName);
    const config: ProxyConfig = {
      rawUrl: url,
      targetUrl,
      protocol: protocol || "ocpp1.6",
      chargerName,
      retryCount: 0,
    };
    this.proxyConfigs.set(chargerId, config);

    this.connectProxy(chargerId);
  }

  private connectProxy(chargerId: number): void {
    const config = this.proxyConfigs.get(chargerId);
    if (!config) return;

    try {
      const chargerConnection = chargerRegistry.getConnection(chargerId);
      if (!chargerConnection || !chargerConnection.ws) {
        logger.warn(`Cannot connect proxy for charger ${chargerId}: Local connection not found in registry.`);
        return;
      }

      logger.info(`Setting up upstream proxy for charger ${chargerId} to ${config.targetUrl} [protocol: ${config.protocol}]`);

      const protocols = config.protocol ? [config.protocol] : undefined;
      const remoteWs = new WebSocket(config.targetUrl, protocols);

      remoteWs.on("open", () => {
        logger.info(`✅ [PROXY] Connection established for charger ${chargerId} to ${config.targetUrl}`);
        config.retryCount = 0;

        // Auto-sync charger state with third-party backend
        setTimeout(async () => {
          try {
            logger.info(`🔄 [PROXY] Auto-triggering BootNotification & StatusNotification for charger ${chargerId} to sync upstream.`);
            await triggerMessage(chargerId, "BootNotification");
            await triggerMessage(chargerId, "StatusNotification");
          } catch (e) {
            logger.debug(`Could not auto-trigger initial sync for charger ${chargerId}: ${e}`);
          }
        }, 1000);
      });

      remoteWs.on("message", async (data: Buffer) => {
        // Forward message from 3rd party backend to the charger
        try {
          const messageStr = data.toString();
          const message = JSON.parse(messageStr);
          logger.info(`📥 [PROXY IN] From third-party backend for charger ${chargerId}: ${messageStr}`);

          // Check if this is a CALL from 3rd party backend targeted at Channel 2 of a combined charger
          if (message[0] === 2) {
            const payload = message[3] || {};
            const targetConnectorId = payload.connectorId ?? payload.evseId;

            const charger = await prisma.charger.findUnique({
              where: { charger_id: chargerId },
              select: { isCombined: true, pairedRole: true, pairedChargerId: true },
            });

            if (
              charger?.isCombined &&
              charger.pairedRole === "primary" &&
              charger.pairedChargerId &&
              targetConnectorId === 2
            ) {
              const secondaryConnection = chargerRegistry.getConnection(charger.pairedChargerId);
              if (secondaryConnection?.ws && secondaryConnection.ws.readyState === WebSocket.OPEN) {
                const translatedPayload = { ...payload };
                if (translatedPayload.connectorId !== undefined) translatedPayload.connectorId = 1;
                if (translatedPayload.evseId !== undefined) translatedPayload.evseId = 1;
                const translatedMessage = [message[0], message[1], message[2], translatedPayload];
                logger.info(
                  `🔄 [PROXY] Forwarding remote command for Channel 2 to secondary charger ${charger.pairedChargerId}: ${JSON.stringify(translatedMessage)}`
                );
                secondaryConnection.ws.send(JSON.stringify(translatedMessage));
                return;
              } else {
                logger.warn(
                  `Secondary charger ${charger.pairedChargerId} connection not available for Channel 2 command`
                );
              }
            }
          }

          // Clear any pending timeout fallback for CALLRESULT (3) or CALLERROR (4)
          if (message[0] === 3 || message[0] === 4) {
            const msgId = String(message[1]);
            const pendingFallback = this.pendingForwardedCalls.get(msgId);
            if (pendingFallback) {
              clearTimeout(pendingFallback.timeout);
              this.pendingForwardedCalls.delete(msgId);
            }
          }

          const localConn = chargerRegistry.getConnection(chargerId);
          if (localConn?.ws && localConn.ws.readyState === WebSocket.OPEN) {
            logger.info(`🔄 [PROXY] Forwarding remote message to charger ${chargerId}: ${messageStr}`);
            localConn.ws.send(messageStr);
          } else {
            logger.warn(`Cannot forward message to charger ${chargerId}, local socket not open.`);
          }

          // Intercept StartTransaction CALLRESULT to sync transaction ID
          if (message[0] === 3) {
            const messageId = message[1];
            const payload = message[2];

            const chargerPending = this.pendingStartTransactions.get(chargerId);
            if (chargerPending && chargerPending.has(messageId)) {
              const action = chargerPending.get(messageId);
              if (action === "StartTransaction" && payload.transactionId) {
                const thirdPartyTransactionId = payload.transactionId;
                logger.info(
                  `🔄 [PROXY] Intercepted StartTransaction response for charger ${chargerId}, attempting to sync local Transaction to third-party ID: ${thirdPartyTransactionId}`
                );

                let retries = 0;
                const maxRetries = 5;

                const syncTransactionId = async () => {
                  try {
                    const recentTransactions = await prisma.transaction.findMany({
                      where: {
                        charger_id: chargerId,
                        status: { in: ["initiated", "charging"] },
                      },
                      orderBy: {
                        startTime: "desc",
                      },
                      take: 1,
                    });

                    let updatedCount = 0;
                    if (recentTransactions.length > 0) {
                      const latestTx = recentTransactions[0];
                      if (latestTx.transactionId !== String(thirdPartyTransactionId)) {
                        const oldTransactionId = latestTx.transactionId;
                        await prisma.transaction.update({
                          where: { id: latestTx.id },
                          data: { transactionId: String(thirdPartyTransactionId) },
                        });

                        await prisma.rfidSession.updateMany({
                          where: {
                            charger_id: chargerId,
                            transactionId: oldTransactionId,
                          },
                          data: { transactionId: String(thirdPartyTransactionId) },
                        });

                        await prisma.meterValue.updateMany({
                          where: {
                            chargerId: chargerId,
                            transactionId: oldTransactionId,
                          },
                          data: { transactionId: String(thirdPartyTransactionId) },
                        });

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
                        updatedCount = 1;
                      }
                    }

                    if (updatedCount > 0) {
                      logger.info(
                        `🔄 [PROXY] Successfully synced local Transaction to third-party ID: ${thirdPartyTransactionId}`
                      );
                    } else if (retries < maxRetries) {
                      retries++;
                      logger.debug(
                        `🔄 [PROXY] Local Transaction not found yet for charger ${chargerId}. Retrying (${retries}/${maxRetries}) in 500ms...`
                      );
                      setTimeout(syncTransactionId, 500);
                    } else {
                      logger.warn(
                        `🔄 [PROXY] Failed to sync transaction ID for charger ${chargerId} after ${maxRetries} retries.`
                      );
                    }
                  } catch (err) {
                    logger.error(`🔄 [PROXY] Error syncing intercepted transaction ID: ${err}`);
                  }
                };

                setTimeout(syncTransactionId, 500);
              }
              chargerPending.delete(messageId);
            }
          }
        } catch (err) {
          logger.error(`Error processing message from third-party backend for charger ${chargerId}: ${err}`);
        }
      });

      remoteWs.on("close", (code, reason) => {
        logger.warn(
          `⚠️ [PROXY] Upstream connection closed for charger ${chargerId} (code: ${code}, reason: ${reason?.toString() || "none"}). Local charger connection remains active.`
        );
        this.activeProxies.delete(chargerId);

        // Auto-reconnect upstream in background if charger is still locally connected
        this.scheduleReconnect(chargerId);
      });

      remoteWs.on("error", (error: any) => {
        logger.error(
          `⚠️ [PROXY] Upstream connection error for charger ${chargerId}: ${error?.message || error}. Local charger connection remains active.`
        );
      });

      this.activeProxies.set(chargerId, remoteWs);
    } catch (error) {
      logger.error(`Failed to establish proxy connection for charger ${chargerId}: ${error}`);
      this.scheduleReconnect(chargerId);
    }
  }

  private scheduleReconnect(chargerId: number): void {
    const config = this.proxyConfigs.get(chargerId);
    if (!config) return;

    if (config.retryTimer) {
      clearTimeout(config.retryTimer);
    }

    const chargerConn = chargerRegistry.getConnection(chargerId);
    if (!chargerConn || !chargerConn.ws || chargerConn.ws.readyState !== WebSocket.OPEN) {
      logger.debug(`Skipping upstream proxy reconnect for charger ${chargerId}: local charger is not connected.`);
      return;
    }

    config.retryCount++;
    const delay = Math.min(3000 * Math.pow(1.5, Math.min(config.retryCount, 6)), 60000);
    logger.info(`Scheduling upstream proxy reconnect for charger ${chargerId} in ${Math.round(delay / 1000)}s (attempt ${config.retryCount})`);

    config.retryTimer = setTimeout(() => {
      if (this.proxyConfigs.has(chargerId) && !this.activeProxies.has(chargerId)) {
        this.connectProxy(chargerId);
      }
    }, delay);
  }

  removeProxy(chargerId: number): void {
    const config = this.proxyConfigs.get(chargerId);
    if (config?.retryTimer) {
      clearTimeout(config.retryTimer);
    }
    this.proxyConfigs.delete(chargerId);

    const remoteWs = this.activeProxies.get(chargerId);
    if (remoteWs) {
      try {
        if (remoteWs.readyState === WebSocket.OPEN || remoteWs.readyState === WebSocket.CONNECTING) {
          remoteWs.close();
        }
      } catch (err) {
        logger.debug(`Error closing proxy socket on removal for charger ${chargerId}: ${err}`);
      }
      this.activeProxies.delete(chargerId);
      logger.info(`Removed proxy configuration and connection for charger ${chargerId}`);
    }

    // Clean up any pending StartTransaction mappings
    this.pendingStartTransactions.delete(chargerId);
  }

  async handleMessageFromCharger(chargerId: number, message: any, protocol: string): Promise<void> {
    let remoteWs = this.activeProxies.get(chargerId);

    // Look up charger details for paired combined charger support
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      select: { isCombined: true, pairedRole: true, pairedChargerId: true },
    });

    // If secondary charger doesn't have an active proxy connection of its own, check if primary has one
    if (!remoteWs && charger?.isCombined && charger.pairedRole === "secondary" && charger.pairedChargerId) {
      remoteWs = this.activeProxies.get(charger.pairedChargerId);
    }

    const messageType = message[0];
    const messageId = String(message[1]);
    const actionName = message[2];
    const payload = message[3];

    // Do not forward CALLRESULT/CALLERROR if they are responses to local commands
    let shouldForward = true;
    if (messageType === 3 || messageType === 4) {
      if (pendingRequests.has(messageId)) {
        shouldForward = false;
        logger.info(`🔄 [PROXY] Suppressing forward for local command response: ${messageId}`);
      }
    }

    let messageToForward = message;

    // Check if card ID translation or channel mapping is required before forwarding to third-party backend
    if (messageType === 2 && payload) {
      try {
        const forwardedPayload = JSON.parse(JSON.stringify(payload));
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
              logger.info(
                `🔄 [PROXY] Translated idTag from "${forwardedPayload.idTag}" to "${mappedTag}" for charger ${chargerId} (action: ${actionName})`
              );
              forwardedPayload.idTag = mappedTag;
              modified = true;
            }
          }

          // 2. OCPP 2.0.1 / 2.1 idToken translation (e.g. Authorize, TransactionEvent)
          if (
            forwardedPayload.idToken &&
            typeof forwardedPayload.idToken === "object" &&
            typeof forwardedPayload.idToken.idToken === "string"
          ) {
            const mappedTag = resolveMappedCardId(forwardedPayload.idToken.idToken, rules);
            if (mappedTag !== forwardedPayload.idToken.idToken) {
              logger.info(
                `🔄 [PROXY] Translated idToken from "${forwardedPayload.idToken.idToken}" to "${mappedTag}" for charger ${chargerId} (action: ${actionName})`
              );
              forwardedPayload.idToken.idToken = mappedTag;
              modified = true;
            }
          }

          // 3. Nested idToken inside transactionInfo / event
          if (
            forwardedPayload.transactionInfo?.idToken?.idToken &&
            typeof forwardedPayload.transactionInfo.idToken.idToken === "string"
          ) {
            const mappedTag = resolveMappedCardId(forwardedPayload.transactionInfo.idToken.idToken, rules);
            if (mappedTag !== forwardedPayload.transactionInfo.idToken.idToken) {
              logger.info(
                `🔄 [PROXY] Translated transactionInfo idToken from "${forwardedPayload.transactionInfo.idToken.idToken}" to "${mappedTag}" for charger ${chargerId}`
              );
              forwardedPayload.transactionInfo.idToken.idToken = mappedTag;
              modified = true;
            }
          }
        }

        if (modified) {
          messageToForward = [messageType, messageId, actionName, forwardedPayload];
        }
      } catch (transErr) {
        logger.error(`🔄 [PROXY] Error evaluating message translation for charger ${chargerId}: ${transErr}`);
      }
    }

    // Handle CALL (type 2) from physical charger
    if (messageType === 2) {
      let localResponsePayload: any = null;
      try {
        // Execute local message handler for DB updates, telemetry, smart charging, and local mirroring
        localResponsePayload = await handleOcppMessage(
          chargerId,
          messageType,
          messageId,
          actionName,
          payload,
          protocol
        );
      } catch (err) {
        logger.error(`🔄 [PROXY] Error executing local message handler for charger ${chargerId}: ${err}`);
      }

      if (remoteWs && remoteWs.readyState === WebSocket.OPEN && shouldForward) {
        // Track StartTransaction to intercept the response and sync IDs
        if (actionName === "StartTransaction") {
          if (!this.pendingStartTransactions.has(chargerId)) {
            this.pendingStartTransactions.set(chargerId, new Map());
          }
          this.pendingStartTransactions.get(chargerId)?.set(messageId, "StartTransaction");
        }

        logger.info(
          `🔄 [PROXY] Forwarding message from charger ${chargerId} to upstream: ${JSON.stringify(messageToForward)}`
        );
        remoteWs.send(JSON.stringify(messageToForward));

        // Safety fallback: If upstream takes > 20s or fails to respond, deliver local response so charger doesn't hang
        const fallbackTimeout = setTimeout(() => {
          this.pendingForwardedCalls.delete(messageId);
          const localConn = chargerRegistry.getConnection(chargerId);
          if (localConn?.ws && localConn.ws.readyState === WebSocket.OPEN && localResponsePayload) {
            const fallbackResponse = [3, messageId, localResponsePayload];
            logger.warn(
              `⏱️ [PROXY TIMEOUT FALLBACK] Delivering local response to charger ${chargerId} for ${actionName} (ID: ${messageId})`
            );
            localConn.ws.send(JSON.stringify(fallbackResponse));
          }
        }, 20000);

        this.pendingForwardedCalls.set(messageId, {
          timeout: fallbackTimeout,
          localFallbackPayload: localResponsePayload,
          chargerId,
          actionName,
        });
      } else {
        // Remote is NOT connected: deliver local response immediately so charger stays online and functioning!
        const localConn = chargerRegistry.getConnection(chargerId);
        if (localConn?.ws && localConn.ws.readyState === WebSocket.OPEN && localResponsePayload) {
          const directResponse = [3, messageId, localResponsePayload];
          logger.info(
            `📤 [OCPP LOCAL RESPONSE] Delivered local response to charger ${chargerId} for ${actionName} (ID: ${messageId}): ${JSON.stringify(directResponse)}`
          );
          localConn.ws.send(JSON.stringify(directResponse));
        }
      }
      return;
    }

    // Handle CALLRESULT (3) or CALLERROR (4) from physical charger
    if (messageType === 3 || messageType === 4) {
      const pending = pendingRequests.get(messageId);
      if (pending) {
        // It's a response to a local command from CPMS
        clearTimeout(pending.timeout);
        if (messageType === 3) {
          pending.resolve(message[2]);
        } else {
          pending.reject(message.slice(2));
        }
        pendingRequests.delete(messageId);
        return;
      }

      // It's a response to a remote command from third-party backend
      if (shouldForward && remoteWs && remoteWs.readyState === WebSocket.OPEN) {
        logger.info(
          `🔄 [PROXY] Forwarding command response from charger ${chargerId} to upstream: ${JSON.stringify(messageToForward)}`
        );
        remoteWs.send(JSON.stringify(messageToForward));
      }
    }
  }
}

export const proxyRouter = new ProxyRouter();
