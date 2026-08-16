import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { EmsGatewayService } from "../../services/EmsGatewayService.js";
import { setChargingProfile } from "../../ocpp/remoteControl.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import type { SetChargingProfileRequest } from "../../types/index.js";

export const createGateway = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Admins can create for other clients, otherwise default to self
    const targetClientId = req.body.client_id || userId;

    const gateway = await EmsGatewayService.createGateway(targetClientId);

    res.status(201).json({ success: true, data: gateway });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateGateway = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (userRole !== "admin" && userRole !== "superadmin") {
      res.status(403).json({ success: false, error: "Only admins can edit EMS Gateways" });
      return;
    }

    const { client_id } = req.body;

    if (!client_id) {
      res.status(400).json({ success: false, error: "Missing client_id" });
      return;
    }

    const updatedGateway = await EmsGatewayService.updateGateway(id as string, Number(client_id));
    res.json({ success: true, data: updatedGateway });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateGatewaySettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    // Authorization check: User must own the gateway or be an admin
    const gateways = await EmsGatewayService.getGateways(userId, userRole || "");
    const ownsGateway = gateways.some(g => g.gateway_id === id);

    if (!ownsGateway && userRole !== "admin" && userRole !== "superadmin") {
      res.status(403).json({ success: false, error: "Unauthorized to modify this gateway's settings" });
      return;
    }

    // Settings fields
    const { maxGridImport, maxGridExport, strategy, v2gEnabled, batteryReserveLimit, autoUpdate } = req.body;

    const updatedGateway = await EmsGatewayService.updateSettings(id as string, {
      maxGridImport,
      maxGridExport,
      strategy,
      v2gEnabled,
      batteryReserveLimit,
      autoUpdate
    });

    res.json({ success: true, data: updatedGateway });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getGateways = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const gateways = await EmsGatewayService.getGateways(userId, userRole || "");

    res.json({ success: true, data: gateways });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const pushTelemetry = async (req: Request, res: Response): Promise<void> => {
  try {
    // Expect Authorization: Bearer <token> or a custom token header
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace(/^Bearer\s+/i, "").trim();
    } else {
      res.status(401).json({ success: false, error: "Missing Bearer token" });
      return;
    }

    const { solar_kw, battery_kw, grid_kw, house_kw } = req.body;

    const result = await EmsGatewayService.processTelemetry(token, {
      solar_kw: solar_kw !== undefined ? Number(solar_kw) : undefined,
      battery_kw: battery_kw !== undefined ? Number(battery_kw) : undefined,
      grid_kw: grid_kw !== undefined ? Number(grid_kw) : undefined,
      house_kw: house_kw !== undefined ? Number(house_kw) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      res.status(401).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

export const throttleChargerFromEms = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      res.status(401).json({ success: false, error: "Missing Bearer token" });
      return;
    }

    // Authenticate the EMS gateway using its hardware token
    const gateway = await EmsGatewayService.validateGatewayToken(token);

    const { id } = req.params;
    if (gateway.gateway_id !== id) {
      res.status(403).json({ success: false, error: "Gateway ID mismatch" });
      return;
    }

    const { charger_id, connector_id, max_amperage } = req.body;

    if (charger_id === undefined || connector_id === undefined || max_amperage === undefined) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: charger_id, connector_id, max_amperage",
      });
      return;
    }

    // Verify charger exists and belongs to the owner of this EMS gateway
    const charger = await prisma.charger.findUnique({
      where: { charger_id: Number(charger_id) },
    });

    if (!charger) {
      res.status(404).json({
        success: false,
        error: "Charger not found",
      });
      return;
    }

    if (charger.owner_id !== gateway.client_id) {
      logger.warn(
        `Cross-tenant EMS authorization violation: Gateway client ${gateway.client_id} attempted to throttle charger ${charger_id} owned by client ${charger.owner_id}`
      );
      res.status(403).json({
        success: false,
        error: "Forbidden: You do not have permission to control this charger",
      });
      return;
    }

    const csChargingProfiles: SetChargingProfileRequest["csChargingProfiles"] = {
      chargingProfileId: Math.floor(Math.random() * 1000000),
      stackLevel: 0,
      chargingProfilePurpose: "TxDefaultProfile",
      chargingProfileKind: "Relative",
      chargingSchedule: {
        chargingRateUnit: "A",
        chargingSchedulePeriod: [
          {
            startPeriod: 0,
            limit: Number(max_amperage),
          },
        ],
      },
    };

    const result = await setChargingProfile({
      chargerId: Number(charger_id),
      connectorId: Number(connector_id),
      csChargingProfiles,
    });

    if (result.status === "Rejected") {
      res.status(400).json({
        success: false,
        error: result.error || "Throttle command rejected",
      });
      return;
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      res.status(401).json({ success: false, error: error.message });
    } else {
      logger.error(`Error throttling charger from EMS: ${error.message}`);
      res.status(500).json({ success: false, error: "Failed to throttle charger" });
    }
  }
};

export const setChargingProfileFromEms = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      res.status(401).json({ success: false, error: "Missing Bearer token" });
      return;
    }

    // Authenticate the EMS gateway using its hardware token
    const gateway = await EmsGatewayService.validateGatewayToken(token);

    const { chargerId, connectorId, csChargingProfiles } = req.body as SetChargingProfileRequest;

    if (chargerId === undefined || connectorId === undefined || !csChargingProfiles) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId, csChargingProfiles",
      });
      return;
    }

    // Verify charger exists and belongs to the owner of this EMS gateway
    const charger = await prisma.charger.findUnique({
      where: { charger_id: Number(chargerId) },
    });

    if (!charger) {
      res.status(404).json({
        success: false,
        error: "Charger not found",
      });
      return;
    }

    if (charger.owner_id !== gateway.client_id) {
      logger.warn(
        `Cross-tenant EMS authorization violation: Gateway client ${gateway.client_id} attempted to set profile on charger ${chargerId} owned by client ${charger.owner_id}`
      );
      res.status(403).json({
        success: false,
        error: "Forbidden: You do not have permission to control this charger",
      });
      return;
    }

    // Forward the SetChargingProfile command to the target charger via OCPP
    const result = await setChargingProfile({ chargerId: Number(chargerId), connectorId: Number(connectorId), csChargingProfiles });

    if (result.status === "Rejected") {
      res.status(400).json({
        success: false,
        error: result.error || "Set charging profile rejected",
      });
      return;
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      res.status(401).json({ success: false, error: error.message });
    } else {
      logger.error(`Error setting charging profile from EMS: ${error.message}`);
      res.status(500).json({ success: false, error: "Failed to set charging profile" });
    }
  }
};

