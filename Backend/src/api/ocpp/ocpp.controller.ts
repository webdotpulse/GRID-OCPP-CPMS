import { Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import {
  remoteStartTransaction,
  remoteStopTransaction,
  resetCharger,
  unlockConnector,
  getConfiguration,
  changeConfiguration,
  changeAvailability,
  triggerMessage,
  dataTransfer,
  getConnectedChargers as getConnected,
  setChargingProfile,
  clearChargingProfile,
  updateFirmware,
  getDiagnostics,
} from "../../ocpp/remoteControl.js";
import type { RemoteStartRequest, RemoteStopRequest, SetChargingProfileRequest, ClearChargingProfileRequest } from "../../types/index.js";

/**
 * Verifies if the caller has permission to perform remote operations on a charger.
 * - Superadmin has access to all existing chargers.
 * - Admin and regular users have access only to chargers they own.
 */
export async function verifyChargerOwnership(
  chargerId: number,
  userId?: number,
  userRole?: string
): Promise<{ authorized: boolean; exists: boolean }> {
  if (isNaN(chargerId)) {
    return { authorized: false, exists: false };
  }

  const charger = await prisma.charger.findUnique({
    where: { charger_id: chargerId },
    select: { charger_id: true, owner_id: true },
  });

  if (!charger) {
    return { authorized: false, exists: false };
  }

  if (userRole === "superadmin") {
    return { authorized: true, exists: true };
  }

  if (!userId) {
    return { authorized: false, exists: true };
  }

  if (charger.owner_id === userId) {
    return { authorized: true, exists: true };
  }

  return { authorized: false, exists: true };
}

/**
 * POST /api/ocpp/set-charging-profile - Set charging profile on charger
 */
export const setChargingProfileController = async (req: Request, res: Response) => {
  try {
    const { chargerId, connectorId, csChargingProfiles } = req.body as SetChargingProfileRequest;

    if (chargerId === undefined || connectorId === undefined || !csChargingProfiles) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId, csChargingProfiles",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to control this charger" });
    }

    const result = await setChargingProfile({ chargerId: Number(chargerId), connectorId: Number(connectorId), csChargingProfiles });

    if (result.status === "Rejected") {
      return res.status(400).json({
        success: false,
        error: result.error || "Set charging profile rejected",
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error setting charging profile: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to set charging profile",
    });
  }
};

/**
 * POST /api/ocpp/clear-charging-profile - Clear charging profile on charger
 */
export const clearChargingProfileController = async (req: Request, res: Response) => {
  try {
    const request = req.body as ClearChargingProfileRequest;

    if (request.chargerId === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: chargerId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(request.chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to control this charger" });
    }

    const result = await clearChargingProfile(request);

    if (result.status === "Rejected") {
      return res.status(400).json({
        success: false,
        error: result.error || "Clear charging profile rejected",
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error clearing charging profile: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to clear charging profile",
    });
  }
};

/**
 * GET /api/ocpp/connected - Get list of connected chargers
 */
export const getConnectedChargers = async (req: Request, res: Response) => {
  const connectedChargers = await getConnected();
  res.json({
    success: true,
    data: connectedChargers,
    count: connectedChargers.length,
  });
};

/**
 * POST /api/ocpp/remote-start - Start charging remotely
 */
export const remoteStart = async (req: Request, res: Response) => {
  try {
    const { chargerId, connectorId, idTag } = req.body;

    if (!chargerId || !connectorId || !idTag) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId, idTag",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to control this charger" });
    }

    const result = await remoteStartTransaction({
      chargerId: Number(chargerId),
      connectorId: Number(connectorId),
      idTag,
    });

    if (result.status === "Rejected") {
      return res.status(400).json({
        success: false,
        error: result.error || "Remote start rejected by charger",
      });
    }

    logger.info(
      `Remote start successful: charger ${chargerId}, channel ${connectorId}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error in remote start: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to send remote start request",
    });
  }
};

/**
 * POST /api/ocpp/remote-stop - Stop charging remotely
 */
export const remoteStop = async (req: Request, res: Response) => {
  try {
    const { chargerId, transactionId } = req.body;

    if (!chargerId || !transactionId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, transactionId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to control this charger" });
    }

    const result = await remoteStopTransaction({ chargerId: Number(chargerId), transactionId });

    if (result.status === "Rejected") {
      return res.status(400).json({
        success: false,
        error: result.error || "Remote stop rejected by charger",
      });
    }

    logger.info(
      `Remote stop successful: charger ${chargerId}, transaction ${transactionId}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error in remote stop: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to send remote stop request",
    });
  }
};

/**
 * POST /api/ocpp/get-configuration - Get charger configuration
 */
export const getChargerConfiguration = async (req: Request, res: Response) => {
  try {
    const { chargerId, key } = req.body;

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: chargerId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to view configuration on this charger" });
    }

    const result = await getConfiguration(Number(chargerId), key);

    if (result.configurationKey) {
      for (const config of result.configurationKey) {
        await prisma.chargerConfiguration.upsert({
          where: {
            chargerId_key: {
              chargerId: Number(chargerId),
              key: config.key,
            },
          },
          update: {
            value: config.value || "",
            readonly: config.readonly || false,
          },
          create: {
            chargerId: Number(chargerId),
            key: config.key,
            value: config.value || "",
            readonly: config.readonly || false,
          },
        });
      }
    }

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error getting configuration: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to get configuration",
    });
  }
};

/**
 * DELETE /api/ocpp/configuration/:chargerId - Delete all saved configurations for a charger
 */
export const deleteChargerConfigurations = async (req: Request, res: Response) => {
  try {
    const chargerIdStr = Array.isArray(req.params.chargerId) ? req.params.chargerId[0] : req.params.chargerId;
    const chargerId = parseInt(chargerIdStr, 10);

    if (isNaN(chargerId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid chargerId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(chargerId, authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to delete configurations on this charger" });
    }

    await prisma.chargerConfiguration.deleteMany({
      where: { chargerId },
    });

    res.json({ success: true, message: "Configurations deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting configurations: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to delete configurations",
    });
  }
};

/**
 * POST /api/ocpp/set-configuration - Set charger configuration
 */
export const setChargerConfiguration = async (req: Request, res: Response) => {
  try {
    const { chargerId, configurationKey } = req.body;

    if (!chargerId || !configurationKey) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, configurationKey",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to set configuration on this charger" });
    }

    const result = await changeConfiguration(Number(chargerId), configurationKey);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error setting configuration: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to set configuration",
    });
  }
};

/**
 * POST /api/ocpp/change-availability - Change availability of charger/connector
 */
export const changeAvailabilityController = async (req: Request, res: Response) => {
  try {
    const { chargerId, connectorId, type } = req.body;

    if (!chargerId || connectorId === undefined || !type) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId, type",
      });
    }

    if (type !== "Inoperative" && type !== "Operative") {
      return res.status(400).json({
        success: false,
        error: "Invalid type. Must be 'Inoperative' or 'Operative'",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to change availability on this charger" });
    }

    const result = await changeAvailability(Number(chargerId), Number(connectorId), type);

    logger.info(`ChangeAvailability sent to charger ${chargerId}, channel: ${connectorId}, type: ${type}`);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error changing availability: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to change availability",
    });
  }
};

/**
 * POST /api/ocpp/reset - Reset charger
 */
export const resetChargerController = async (req: Request, res: Response) => {
  try {
    const { chargerId, type } = req.body;

    if (!chargerId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: chargerId",
      });
    }

    if (type !== "Soft" && type !== "Hard") {
      return res.status(400).json({
        success: false,
        error: "Invalid reset type. Must be 'Soft' or 'Hard'",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to reset this charger" });
    }

    const result = await resetCharger(Number(chargerId), type);

    logger.info(`Reset sent to charger ${chargerId}: ${type}`);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error resetting charger: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to reset charger",
    });
  }
};

/**
 * POST /api/ocpp/unlock - Unlock connector
 */
export const unlockConnectorController = async (req: Request, res: Response) => {
  try {
    const { chargerId, connectorId } = req.body;

    if (!chargerId || !connectorId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, connectorId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to unlock this connector" });
    }

    const result = await unlockConnector(Number(chargerId), Number(connectorId));

    logger.info(
      `Unlock sent to charger ${chargerId}, channel ${connectorId}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error unlocking channel: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to unlock channel",
    });
  }
};

/**
 * POST /api/ocpp/test-auth - Test if an RFID tag is valid
 */
export const testAuth = async (req: Request, res: Response) => {
  try {
    const { idTag, chargerId } = req.body;

    if (!idTag) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: idTag",
      });
    }

    const rfidUser = await prisma.rfidUser.findUnique({
      where: { rfid_tag: idTag },
      include: { owner: true }
    });

    if (!rfidUser || !rfidUser.active) {
      return res.json({
        success: true,
        valid: false,
        message: "Tag is invalid or inactive"
      });
    }

    if (rfidUser.owner?.role === "admin") {
      return res.json({
        success: true,
        valid: true,
        message: `Tag is valid and belongs to ${rfidUser.name} (Admin)`
      });
    }

    if (chargerId) {
      const charger = await prisma.charger.findUnique({
        where: { charger_id: Number(chargerId) }
      });

      if (!charger || !charger.chargeGroupId) {
         return res.json({
           success: true,
           valid: false,
           message: "Charger not found or not in a charge group"
         });
      }

      if (!rfidUser.owner_id) {
         return res.json({
           success: true,
           valid: false,
           message: "Tag is not assigned to any user"
         });
      }

      const groupUser = await prisma.chargeGroupUser.findUnique({
        where: {
          chargeGroupId_userId: {
            chargeGroupId: charger.chargeGroupId,
            userId: rfidUser.owner_id
          }
        }
      });

      if (!groupUser) {
        return res.json({
          success: true,
          valid: false,
          message: `Tag belongs to ${rfidUser.name} but user is not in the same charge group as charger`
        });
      }
    }

    return res.json({
      success: true,
      valid: true,
      message: `Tag is valid and belongs to ${rfidUser.name}`
    });
  } catch (error) {
    logger.error(`Error testing auth: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to test auth",
    });
  }
};

/**
 * POST /api/ocpp/get-diagnostics - Get diagnostics from charger
 */
export const getDiagnosticsController = async (req: Request, res: Response) => {
  try {
    const { chargerId, location, retries, retryInterval, startTime, stopTime } = req.body;

    if (!chargerId || !location) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, location",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to get diagnostics from this charger" });
    }

    const result = await getDiagnostics(Number(chargerId), location, retries, retryInterval, startTime, stopTime);

    logger.info(
      `GetDiagnostics triggered for charger ${chargerId} with location: ${location}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error triggering get diagnostics: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to trigger get diagnostics",
    });
  }
};

/**
 * POST /api/ocpp/trigger-message - Trigger message on charger
 */
export const updateFirmwareController = async (req: Request, res: Response) => {
  try {
    const { chargerId, location, retries, retryInterval } = req.body;

    if (!chargerId || !location) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, location",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to update firmware on this charger" });
    }

    const result = await updateFirmware(Number(chargerId), location, retries, retryInterval);

    logger.info(
      `UpdateFirmware triggered for charger ${chargerId} with location: ${location}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error triggering firmware update: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to trigger firmware update",
    });
  }
};

export const dataTransferController = async (req: Request, res: Response) => {
  try {
    const { chargerId, vendorId, messageId, data } = req.body;

    if (!chargerId || !vendorId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, vendorId",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to send data transfer to this charger" });
    }

    const result = await dataTransfer(Number(chargerId), vendorId, messageId, data);

    logger.info(
      `DataTransfer sent to charger ${chargerId}, vendorId: ${vendorId}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error sending data transfer: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to send data transfer",
    });
  }
};

export const triggerMessageController = async (req: Request, res: Response) => {
  try {
    const { chargerId, requestedMessage, connectorId } = req.body;

    if (!chargerId || !requestedMessage) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, requestedMessage",
      });
    }

    const authReq = req as AuthRequest;
    const authCheck = await verifyChargerOwnership(Number(chargerId), authReq.userId, authReq.userRole);
    if (!authCheck.exists) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to trigger messages on this charger" });
    }

    const result = await triggerMessage(Number(chargerId), requestedMessage, connectorId !== undefined ? Number(connectorId) : undefined);

    logger.info(
      `Trigger message sent to charger ${chargerId}: ${requestedMessage}`
    );
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`Error triggering message: ${error}`);
    res.status(500).json({
      success: false,
      error: "Failed to trigger message",
    });
  }
};

