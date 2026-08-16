import { prisma } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { randomBytes } from "crypto";
import { getIO } from "../ocpp/realtime.socket.js";
import { logger } from "../utils/logger.js";

export class EmsGatewayService {
  static async createGateway(clientId: number) {
    const token = randomBytes(32).toString("hex");

    const gateway = await prisma.emsGateway.create({
      data: {
        client_id: clientId,
        auth_token: token,
      },
    });

    return gateway;
  }

  static async updateGateway(gatewayId: string, clientId: number) {
    return prisma.emsGateway.update({
      where: { gateway_id: gatewayId },
      data: { client_id: clientId },
    });
  }

  static async updateSettings(gatewayId: string, settings: any) {
    const updated = await prisma.emsGateway.update({
      where: { gateway_id: gatewayId },
      data: {
        maxGridImport: settings.maxGridImport !== undefined ? Number(settings.maxGridImport) : undefined,
        maxGridExport: settings.maxGridExport !== undefined ? Number(settings.maxGridExport) : undefined,
        strategy: settings.strategy,
        v2gEnabled: settings.v2gEnabled,
        batteryReserveLimit: settings.batteryReserveLimit !== undefined ? Number(settings.batteryReserveLimit) : undefined,
        autoUpdate: settings.autoUpdate,
      },
    });

    // Push the updated settings to the connected NEMS device via WebSocket
    const io = getIO();
    if (io) {
      // By default in this system real-time clients join a room matching their gateway ID
      io.to(gatewayId).emit("EMS_SETTINGS_UPDATE", {
        gateway_id: gatewayId,
        settings: {
          maxGridImport: updated.maxGridImport,
          maxGridExport: updated.maxGridExport,
          strategy: updated.strategy,
          v2gEnabled: updated.v2gEnabled,
          batteryReserveLimit: updated.batteryReserveLimit,
          autoUpdate: updated.autoUpdate,
        }
      });
      logger.info(`Emitted EMS_SETTINGS_UPDATE to room ${gatewayId}`);
    } else {
      logger.warn(`Could not emit EMS_SETTINGS_UPDATE to room ${gatewayId}: Socket.IO not initialized`);
    }

    return updated;
  }

  static async getGateways(clientId: number, userRole: string) {
    if (userRole === "admin") {
      return prisma.emsGateway.findMany({
        include: { client: { select: { name: true, email: true } } },
      });
    }

    return prisma.emsGateway.findMany({
      where: { client_id: clientId },
    });
  }

  static async validateGatewayToken(authToken: string) {
    const gateway = await prisma.emsGateway.findUnique({
      where: { auth_token: authToken },
    });

    if (!gateway) {
      throw new Error("Unauthorized: Invalid EMS gateway token.");
    }

    return gateway;
  }

  static async processTelemetry(authToken: string, telemetryData: { solar_kw?: number; battery_kw?: number; grid_kw?: number; house_kw?: number }) {
    // 1. Authenticate gateway
    const gateway = await EmsGatewayService.validateGatewayToken(authToken);

    // 2. Update heartbeat and status in DB (async, non-blocking for performance ideally, but await here for simplicity)
    await prisma.emsGateway.update({
      where: { id: gateway.id },
      data: {
        last_heartbeat: new Date(),
        status: "online",
      },
    });

    // 3. Cache telemetry in Redis for dashboard consumption
    const redisKey = `ems_telemetry:${gateway.gateway_id}`;

    // Store as hash with expiration (e.g. 5 minutes) so stale data drops
    await redisClient.hset(redisKey, {
      solar_kw: (telemetryData.solar_kw ?? 0).toString(),
      battery_kw: (telemetryData.battery_kw ?? 0).toString(),
      grid_kw: (telemetryData.grid_kw ?? 0).toString(),
      house_kw: (telemetryData.house_kw ?? 0).toString(),
      timestamp: Date.now().toString(),
    });

    await redisClient.expire(redisKey, 300); // 5 minutes TTL

    // 4. Trigger real-time V2G evaluation if V2G is enabled or if grid import is high
    if (gateway.v2gEnabled !== false && telemetryData.grid_kw !== undefined) {
      import("./V2GOrchestrationService.js").then(({ V2GOrchestrationService }) => {
        V2GOrchestrationService.evaluateAndDispatchV2G(
          gateway.gateway_id,
          telemetryData.grid_kw,
          gateway.maxGridImport || 5.0
        ).catch(err => {
          logger.error(`Error triggering real-time V2G evaluation: ${err}`);
        });
      }).catch(err => {
        logger.error(`Error importing V2GOrchestrationService: ${err}`);
      });
    }

    return { success: true, gateway_id: gateway.gateway_id };
  }
}
