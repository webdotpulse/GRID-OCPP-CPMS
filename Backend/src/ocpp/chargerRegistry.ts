import { logger } from "../utils/logger.js";
import type { ChargerConnection, ActiveTransaction } from "../types/index.js";
import { redisClient, redisSubscriber, redisPublisher } from "../config/redis.js";
import { config } from "../config/index.js";

class ChargerRegistry {
  private chargers: Map<number, ChargerConnection> = new Map();
  private offlineMonitorInterval: NodeJS.Timeout | null = null;
  private offlineThreshold: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(offlineThresholdSeconds: number = 60) {
    this.offlineThreshold = offlineThresholdSeconds * 1000;
    this.startOfflineMonitor();
    this.setupRedisSubscriber();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    // Send a heartbeat for all locally connected chargers to keep their Redis session active
    this.heartbeatInterval = setInterval(async () => {
      const now = new Date();
      for (const [chargerId, connection] of this.chargers.entries()) {
        try {
          // If we haven't received a heartbeat from the charger recently, the offline monitor will handle it.
          // This just keeps the Redis key alive for instances that we hold the connection for.
          await redisClient.hset(this.getRedisKey(chargerId), "lastHeartbeat", now.toISOString());
          await redisClient.expire(this.getRedisKey(chargerId), this.offlineThreshold / 1000 * 2);
        } catch (error) {
          logger.error(`Error updating heartbeat for charger ${chargerId} in Redis: ${error}`);
        }
      }
    }, this.offlineThreshold / 2); // Run twice as fast as the threshold
  }

  private setupRedisSubscriber(): void {
    redisSubscriber.subscribe("ocpp_commands", (err) => {
      if (err) logger.error(`Failed to subscribe to ocpp_commands: ${err}`);
      else logger.info("Subscribed to ocpp_commands Redis channel");
    });

    redisSubscriber.on("message", async (channel, message) => {
      if (channel === "ocpp_commands") {
        try {
          const { chargerId, payload } = JSON.parse(message);
          // Only send if this instance holds the active connection
          if (this.isConnected(chargerId)) {
            await this.sendToCharger(chargerId, payload);
          }
        } catch (error) {
          logger.error(`Error processing Redis pub/sub command: ${error}`);
        }
      }
    });
  }

  public getRedisKey(chargerId: number): string {
    return `charger:${chargerId}:session`;
  }

  private getTransactionKey(chargerId: number, transactionId: string | number): string {
    return `charger:${chargerId}:transaction:${transactionId}`;
  }

  /**
   * Register a new charger connection
   */
  async register(chargerId: number, chargerName: string, ws: any): Promise<void> {
    const protocol = ws.protocol || "ocpp1.6";
    const connection: ChargerConnection = {
      chargerId,
      ws,
      chargerName,
      protocol,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      transactions: new Map(),
    };

    this.chargers.set(chargerId, connection);
    logger.info(`Charger registered locally: ${chargerName} (ID: ${chargerId}) with protocol: ${protocol} on instance: ${config.instanceId}`);

    // Cache connection metadata in Redis
    try {
      await redisClient.hset(
        this.getRedisKey(chargerId),
        "chargerName", chargerName,
        "connectedAt", connection.connectedAt.toISOString(),
        "lastHeartbeat", connection.lastHeartbeat.toISOString(),
        "status", "connected",
        "protocol", protocol,
        "instanceId", config.instanceId
      );
      // Expire session data slightly longer than offline threshold to avoid premature cleanup
      await redisClient.expire(this.getRedisKey(chargerId), this.offlineThreshold / 1000 * 2);
    } catch (error) {
      logger.error(`Error caching charger session in Redis: ${error}`);
    }
  }

  /**
   * Unregister a charger (disconnected)
   */
  async unregister(chargerId: number): Promise<void> {
    const connection = this.chargers.get(chargerId);
    if (connection) {
      this.chargers.delete(chargerId);
      logger.info(`Charger unregistered locally: ${connection.chargerName} (ID: ${chargerId}) on instance: ${config.instanceId}`);

      try {
        // Only delete the session from Redis if this instance actually owns it
        // (prevents race conditions during rapid reconnects to different instances)
        const cachedSession = await redisClient.hgetall(this.getRedisKey(chargerId));
        if (cachedSession && cachedSession.instanceId === config.instanceId) {
          await redisClient.del(this.getRedisKey(chargerId));
        }
      } catch (error) {
        logger.error(`Error removing cached charger session in Redis: ${error}`);
      }
    }
  }

  /**
   * Get a charger connection by ID
   */
  getConnection(chargerId: number): ChargerConnection | undefined {
    return this.chargers.get(chargerId);
  }

  /**
   * Check if a charger is connected locally
   */
  isConnected(chargerId: number): boolean {
    return this.chargers.has(chargerId);
  }

  /**
   * Check if a charger is connected anywhere in the cluster
   */
  async isConnectedGlobally(chargerId: number): Promise<boolean> {
    if (this.isConnected(chargerId)) return true;
    const exists = await redisClient.exists(this.getRedisKey(chargerId));
    return exists === 1;
  }

  /**
   * Update charger's last heartbeat timestamp
   */
  async updateHeartbeat(chargerId: number): Promise<void> {
    const connection = this.chargers.get(chargerId);
    if (connection) {
      connection.lastHeartbeat = new Date();
      try {
        await redisClient.hset(this.getRedisKey(chargerId), "lastHeartbeat", connection.lastHeartbeat.toISOString());
        await redisClient.expire(this.getRedisKey(chargerId), this.offlineThreshold / 1000 * 2);
      } catch (error) {
        logger.error(`Error updating cached heartbeat in Redis: ${error}`);
      }
    } else {
      // Just in case it's another instance holding the socket, let's just refresh the key if it exists
      try {
        await redisClient.hset(this.getRedisKey(chargerId), "lastHeartbeat", new Date().toISOString());
        await redisClient.expire(this.getRedisKey(chargerId), this.offlineThreshold / 1000 * 2);
      } catch (error) {
         // ignore
      }
    }
  }

  /**
   * Start an active transaction for a charger
   */
  async startTransaction(chargerId: number, transactionId: string | number, connectorName: string, idTag?: string): Promise<void> {
    const transactionData: ActiveTransaction = {
      transactionId,
      connectorName,
      idTag,
      startTime: new Date(),
      initialMeterValue: 0,
    };

    const connection = this.chargers.get(chargerId);
    if (connection) {
      connection.transactions.set(transactionId, transactionData);
    }

    try {
      await redisClient.set(
        this.getTransactionKey(chargerId, transactionId),
        JSON.stringify(transactionData)
      );
    } catch (error) {
      logger.error(`Error caching transaction in Redis: ${error}`);
    }
  }

  /**
   * End a transaction for a charger
   */
  async endTransaction(chargerId: number, transactionId: string | number): Promise<ActiveTransaction | undefined> {
    let transaction: ActiveTransaction | undefined;

    const connection = this.chargers.get(chargerId);
    if (connection) {
      transaction = connection.transactions.get(transactionId);
      connection.transactions.delete(transactionId);
    }

    try {
      if (!transaction) {
        const cached = await redisClient.get(this.getTransactionKey(chargerId, transactionId));
        if (cached) transaction = JSON.parse(cached);
      }
      await redisClient.del(this.getTransactionKey(chargerId, transactionId));
    } catch (error) {
      logger.error(`Error removing cached transaction in Redis: ${error}`);
    }

    return transaction;
  }

  /**
   * Get active transaction for a charger
   */
  async getTransaction(chargerId: number, transactionId: string | number): Promise<ActiveTransaction | undefined> {
    const connection = this.chargers.get(chargerId);
    if (connection) {
      const tx = connection.transactions.get(transactionId);
      if (tx) return tx;
    }

    try {
      const cached = await redisClient.get(this.getTransactionKey(chargerId, transactionId));
      if (cached) return JSON.parse(cached) as ActiveTransaction;
    } catch (error) {
      logger.error(`Error getting cached transaction in Redis: ${error}`);
    }

    return undefined;
  }

  /**
   * Publish an OCPP command via Redis to reach the correct instance
   */
  async publishCommand(chargerId: number, message: any): Promise<void> {
    // If we have the local connection, we can just send directly as an optimization
    if (this.isConnected(chargerId)) {
      await this.sendToCharger(chargerId, message);
      return;
    }

    const cachedSession = await redisClient.hgetall(this.getRedisKey(chargerId));
    // hgetall returns empty object {} if key doesn't exist
    if (!cachedSession || Object.keys(cachedSession).length === 0 || cachedSession.status !== "connected") {
      throw new Error(`Charger ${chargerId} is not connected anywhere in cluster`);
    }

    // Publish to cluster
    await redisPublisher.publish("ocpp_commands", JSON.stringify({ chargerId, payload: message }));
  }

  /**
   * Send OCPP message to a charger connected to THIS instance
   */
  async sendToCharger(chargerId: number, message: any): Promise<any> {
    const connection = this.chargers.get(chargerId);
    if (!connection) {
      throw new Error(`Charger ${chargerId} is not connected locally`);
    }

    // Lazily import to avoid circular dependency
    const { logOcppMessage } = await import("./messageHandlers.js");

    return new Promise((resolve, reject) => {
      connection.ws.send(JSON.stringify(message), (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          // Log outgoing message correctly formatted for WebSocket clients
          logOcppMessage(chargerId, "out", message).catch(err => 
            logger.error(`Failed to broadcast logged msg: ${err}`)
          );
          resolve(message);
        }
      });
    });
  }

  /**
   * Get all connected charger IDs (across the cluster)
   */
  async getConnectedChargers(): Promise<number[]> {
    try {
      let cursor = "0";
      const chargerIds: number[] = [];
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", "charger:*:session", "COUNT", 100);
        cursor = nextCursor;
        for (const key of keys) {
          const parts = key.split(":");
          const id = parseInt(parts[1], 10);
          if (!isNaN(id)) {
            chargerIds.push(id);
          }
        }
      } while (cursor !== "0");
      return Array.from(new Set(chargerIds));
    } catch (error) {
      logger.error(`Error getting connected chargers from Redis: ${error}`);
      // Fallback to local connections if Redis fails
      return Array.from(this.chargers.keys());
    }
  }

  /**
   * Get connection count
   */
  async getConnectionCount(): Promise<number> {
    return (await this.getConnectedChargers()).length;
  }

  /**
   * Start monitoring for offline chargers
   */
  private startOfflineMonitor(): void {
    this.offlineMonitorInterval = setInterval(() => {
      const now = Date.now();
      for (const [chargerId, connection] of this.chargers) {
        const timeSinceHeartbeat = now - connection.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > this.offlineThreshold) {
          logger.warn(`Charger ${connection.chargerName} (ID: ${chargerId}) appears to be offline. Last heartbeat: ${connection.lastHeartbeat.toISOString()}`);
          // Terminate local connection forcefully
          connection.ws.terminate();
          // We leave unregistration to the close event handler to avoid race conditions
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop the offline monitor and heartbeat
   */
  stopOfflineMonitor(): void {
    if (this.offlineMonitorInterval) {
      clearInterval(this.offlineMonitorInterval);
      this.offlineMonitorInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.chargers.clear();
  }
}

// Singleton instance
export const chargerRegistry = new ChargerRegistry(config.offlineThreshold);
