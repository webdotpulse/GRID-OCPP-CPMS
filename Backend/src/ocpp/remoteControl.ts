import { chargerRegistry } from "./chargerRegistry.js";
import { logger } from "../utils/logger.js";
import type {
  RemoteStartRequest,
  RemoteStopRequest,
  SetChargingProfileRequest,
  ClearChargingProfileRequest,
} from "../types/index.js";
import {
  sendDistributedOcppCall,
  sendDistributedRemoteCommand,
  getChargerProtocol,
  generateMessageId,
  distributedPendingRequests,
} from "./distributedRemoteControl.js";

// Re-export for compatibility
export const pendingRequests = distributedPendingRequests as any;
export { getChargerProtocol, generateMessageId };

import { prisma } from "../config/database.js";

/**
 * Resolve target physical charger and connector when commanding a combined 2-socket charger
 */
export async function resolveTargetChargerAndConnector(
  chargerId: number,
  connectorId?: number
): Promise<{ targetChargerId: number; targetConnectorId: number }> {
  if (connectorId === 2) {
    try {
      if (prisma?.charger?.findUnique) {
        const charger = await prisma.charger.findUnique({
          where: { charger_id: chargerId },
          select: { isCombined: true, pairedRole: true, pairedChargerId: true }
        });
        if (charger?.isCombined && charger.pairedRole === "primary" && charger.pairedChargerId) {
          return { targetChargerId: charger.pairedChargerId, targetConnectorId: 1 };
        }
      }
    } catch (err) {
      logger.error(`Error resolving paired charger target: ${err}`);
    }
  }
  return { targetChargerId: chargerId, targetConnectorId: connectorId ?? 1 };
}

/**
 * Send Remote command (Start, Stop) via Distributed Redis RPC bridge
 */
export async function sendRemoteCommand(
  chargerId: number,
  command: string,
  params: any
): Promise<{ status: string; error?: string; [key: string]: any }> {
  return await sendDistributedRemoteCommand(chargerId, command, params);
}

/**
 * Send RemoteStartTransaction request to charger
 */
export async function remoteStartTransaction(
  request: RemoteStartRequest
): Promise<{ status: string; transactionId?: number; error?: string }> {
  const { targetChargerId, targetConnectorId } = await resolveTargetChargerAndConnector(request.chargerId, request.connectorId);
  return await sendRemoteCommand(targetChargerId, "Start", { connectorId: targetConnectorId, idTag: request.idTag });
}

/**
 * Send RemoteStopTransaction request to charger
 */
export async function remoteStopTransaction(
  request: RemoteStopRequest
): Promise<{ status: string; error?: string }> {
  let targetChargerId = request.chargerId;
  try {
    if (prisma?.transaction?.findFirst) {
      const tx = await prisma.transaction.findFirst({
        where: { transactionId: String(request.transactionId) },
        select: { charger_id: true }
      });
      if (tx?.charger_id) {
        targetChargerId = tx.charger_id;
      }
    }
  } catch (err) {
    logger.error(`Error resolving transaction owner for remoteStop: ${err}`);
  }
  return await sendRemoteCommand(targetChargerId, "Stop", { transactionId: request.transactionId });
}

/**
 * Send GetConfiguration request to charger
 * OCPP 1.6 CALL format: [2, messageId, "GetConfiguration", payload]
 */
export async function getConfiguration(
  chargerId: number,
  key?: string | string[]
): Promise<{ status: string; configurationKey?: any[]; unknownKey?: string; error?: string }> {
  try {
    const payload: any = {};
    if (key && (Array.isArray(key) ? key.length > 0 : key !== "")) {
      payload.key = Array.isArray(key) ? key : [key];
    }

    const result = await sendDistributedOcppCall(chargerId, "GetConfiguration", payload, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in getConfiguration for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send GetConfiguration" };
  }
}

/**
 * Send ChangeAvailability request to charger
 * OCPP 1.6 CALL format: [2, messageId, "ChangeAvailability", payload]
 */
export async function changeAvailability(
  chargerId: number,
  connectorId: number,
  type: "Inoperative" | "Operative"
): Promise<{ status: string; error?: string }> {
  try {
    const { targetChargerId, targetConnectorId } = await resolveTargetChargerAndConnector(chargerId, connectorId);
    const result = await sendDistributedOcppCall(
      targetChargerId,
      "ChangeAvailability",
      { connectorId: targetConnectorId, type },
      10000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in changeAvailability for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send ChangeAvailability" };
  }
}

/**
 * Send ChangeConfiguration request to charger
 * OCPP 1.6 CALL format: [2, messageId, "ChangeConfiguration", payload]
 */
export async function changeConfiguration(
  chargerId: number,
  configurationKey: Array<{ key: string; value: string }>
): Promise<{ status: string; error?: string }> {
  try {
    let lastStatus = "Accepted";
    for (const item of configurationKey) {
      const result = await sendDistributedOcppCall(
        chargerId,
        "ChangeConfiguration",
        { key: item.key, value: item.value },
        10000
      );
      if (result.status && result.status !== "Accepted") {
        lastStatus = result.status;
      }
    }
    return { status: lastStatus };
  } catch (error) {
    logger.error(`Error in changeConfiguration for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send ChangeConfiguration" };
  }
}

/**
 * Send Reset request to charger
 * OCPP 1.6 CALL format: [2, messageId, "Reset", payload]
 */
export async function resetCharger(
  chargerId: number,
  type: "Soft" | "Hard"
): Promise<{ status: string; error?: string }> {
  try {
    const result = await sendDistributedOcppCall(chargerId, "Reset", { type }, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in resetCharger for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send Reset" };
  }
}

/**
 * Send UnlockConnector request to charger
 * OCPP 1.6 CALL format: [2, messageId, "UnlockConnector", payload]
 */
export async function unlockConnector(
  chargerId: number,
  connectorId: number
): Promise<{ status: string; error?: string }> {
  try {
    const { targetChargerId, targetConnectorId } = await resolveTargetChargerAndConnector(chargerId, connectorId);
    const result = await sendDistributedOcppCall(
      targetChargerId,
      "UnlockConnector",
      { connectorId: targetConnectorId },
      10000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in unlockConnector for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send UnlockConnector" };
  }
}

/**
 * Send SetChargingProfile request to charger
 * OCPP 1.6 CALL format: [2, messageId, "SetChargingProfile", payload]
 */
export async function setChargingProfile(
  request: SetChargingProfileRequest
): Promise<{ status: string; error?: string }> {
  const { chargerId, connectorId, csChargingProfiles } = request;
  try {
    const { targetChargerId, targetConnectorId } = await resolveTargetChargerAndConnector(chargerId, connectorId);
    const result = await sendDistributedOcppCall(
      targetChargerId,
      "SetChargingProfile",
      { connectorId: targetConnectorId, csChargingProfiles },
      10000
    );

    if (result.status === "Accepted" && csChargingProfiles) {
      import("../services/SmartChargingProfileService.js")
        .then(({ SmartChargingProfileService }) => {
          SmartChargingProfileService.saveChargingProfile(chargerId, connectorId, csChargingProfiles).catch(
            (e) => logger.error(`Error persisting charging profile: ${e}`)
          );
        })
        .catch(() => {});
    }

    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in setChargingProfile for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send SetChargingProfile" };
  }
}

/**
 * Send ClearChargingProfile request to charger
 * OCPP 1.6 CALL format: [2, messageId, "ClearChargingProfile", payload]
 */
export async function clearChargingProfile(
  request: ClearChargingProfileRequest
): Promise<{ status: string; error?: string }> {
  const { chargerId, id, connectorId, chargingProfilePurpose, stackLevel } = request;
  try {
    const { targetChargerId, targetConnectorId } = await resolveTargetChargerAndConnector(chargerId, connectorId);
    const payload: any = {};
    if (id !== undefined) payload.id = id;
    if (connectorId !== undefined) payload.connectorId = targetConnectorId;
    if (chargingProfilePurpose !== undefined) payload.chargingProfilePurpose = chargingProfilePurpose;
    if (stackLevel !== undefined) payload.stackLevel = stackLevel;

    const result = await sendDistributedOcppCall(
      targetChargerId,
      "ClearChargingProfile",
      payload,
      10000
    );

    if (result.status === "Accepted") {
      import("../services/SmartChargingProfileService.js")
        .then(({ SmartChargingProfileService }) => {
          SmartChargingProfileService.clearChargingProfiles(chargerId, {
            id,
            connectorId,
            chargingProfilePurpose,
            stackLevel,
          }).catch((e) => logger.error(`Error clearing profile in db: ${e}`));
        })
        .catch(() => {});
    }

    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in clearChargingProfile for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send ClearChargingProfile" };
  }
}

/**
 * Send DataTransfer request to charger
 * OCPP 1.6 CALL format: [2, messageId, "DataTransfer", payload]
 */
export async function dataTransfer(
  chargerId: number,
  vendorId: string,
  messageIdStr?: string,
  data?: string
): Promise<{ status: string; error?: string }> {
  try {
    const payload: any = { vendorId };
    if (messageIdStr !== undefined) payload.messageId = messageIdStr;
    if (data !== undefined) payload.data = data;

    const result = await sendDistributedOcppCall(chargerId, "DataTransfer", payload, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in dataTransfer for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send DataTransfer" };
  }
}

/**
 * Send TriggerMessage request to charger
 * OCPP 1.6 CALL format: [2, messageId, "TriggerMessage", payload]
 */
export async function triggerMessage(
  chargerId: number,
  requestedMessage: string,
  connectorId?: number
): Promise<{ status: string; error?: string }> {
  try {
    const payload: any = { requestedMessage };
    if (connectorId !== undefined) payload.connectorId = connectorId;

    const result = await sendDistributedOcppCall(chargerId, "TriggerMessage", payload, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in triggerMessage for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send TriggerMessage" };
  }
}

/**
 * Send GetDiagnostics request to charger
 * OCPP 1.6 CALL format: [2, messageId, "GetDiagnostics", payload]
 */
export async function getDiagnostics(
  chargerId: number,
  location: string,
  retries?: number,
  retryInterval?: number,
  startTime?: string,
  stopTime?: string
): Promise<{ status: string; error?: string }> {
  try {
    const payload: any = { location };
    if (retries !== undefined) payload.retries = retries;
    if (retryInterval !== undefined) payload.retryInterval = retryInterval;
    if (startTime !== undefined) payload.startTime = startTime;
    if (stopTime !== undefined) payload.stopTime = stopTime;

    const result = await sendDistributedOcppCall(chargerId, "GetDiagnostics", payload, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in getDiagnostics for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send GetDiagnostics" };
  }
}

/**
 * Trigger firmware update
 */
export async function updateFirmware(
  chargerId: number,
  location: string,
  retries?: number,
  retryInterval?: number
): Promise<{ status: string; error?: string }> {
  try {
    const payload: any = {
      location,
      retrieveDate: new Date().toISOString(),
    };
    if (retries !== undefined) payload.retries = retries;
    if (retryInterval !== undefined) payload.retryInterval = retryInterval;

    const result = await sendDistributedOcppCall(chargerId, "UpdateFirmware", payload, 10000);
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in updateFirmware for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send UpdateFirmware" };
  }
}

/**
 * Get list of connected chargers
 */
export async function getConnectedChargers(): Promise<number[]> {
  return await chargerRegistry.getConnectedChargers();
}

/**
 * Check if a charger is connected
 */
export async function isChargerConnected(chargerId: number): Promise<boolean> {
  return chargerRegistry.isConnectedGlobally(chargerId);
}

/**
 * Send CertificateSigned to charger (OCPP 2.0.1/2.1)
 */
export async function certificateSigned(
  chargerId: number,
  certificateType: string,
  certificateChain: string
): Promise<{ status: string; error?: string }> {
  try {
    const result = await sendDistributedOcppCall(
      chargerId,
      "CertificateSigned",
      { certificateType, certificateChain },
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in certificateSigned for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send CertificateSigned" };
  }
}

/**
 * Send InstallCertificate to charger (OCPP 2.0.1/2.1)
 */
export async function installCertificate(
  chargerId: number,
  certificateType: string,
  certificate: string
): Promise<{ status: string; error?: string }> {
  try {
    const result = await sendDistributedOcppCall(
      chargerId,
      "InstallCertificate",
      { certificateType, certificate },
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in installCertificate for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send InstallCertificate" };
  }
}

/**
 * Send DeleteCertificate to charger (OCPP 2.0.1/2.1)
 */
export async function deleteCertificate(
  chargerId: number,
  certificateHashData: any
): Promise<{ status: string; error?: string }> {
  try {
    const result = await sendDistributedOcppCall(
      chargerId,
      "DeleteCertificate",
      { certificateHashData },
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in deleteCertificate for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send DeleteCertificate" };
  }
}

/**
 * Send GetInstalledCertificateIds to charger (OCPP 2.0.1/2.1)
 */
export async function getInstalledCertificateIds(
  chargerId: number,
  certificateType?: string[]
): Promise<{ status: string; certificateHashDataChain?: any[]; error?: string }> {
  try {
    const payload: any = {};
    if (certificateType && certificateType.length > 0) {
      payload.certificateType = certificateType;
    }

    const result = await sendDistributedOcppCall(
      chargerId,
      "GetInstalledCertificateIds",
      payload,
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in getInstalledCertificateIds for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send GetInstalledCertificateIds" };
  }
}

/**
 * Send GetCompositeSchedule request to charger (or calculate locally via SmartChargingProfileService)
 */
export async function getCompositeSchedule(
  chargerId: number,
  connectorId: number,
  duration: number = 86400,
  chargingRateUnit: "A" | "W" = "A"
): Promise<{ status: string; scheduleStart?: string; chargingSchedule?: any; error?: string }> {
  try {
    const isOnline = await chargerRegistry.isConnectedGlobally(chargerId);
    if (isOnline) {
      const payload = { connectorId, duration, chargingRateUnit };
      const result = await sendDistributedOcppCall(chargerId, "GetCompositeSchedule", payload, 15000);
      if (result.status === "Accepted" && result.chargingSchedule) {
        return { ...result, status: "Accepted" };
      }
    }

    // Local calculation via SmartChargingProfileService
    const { SmartChargingProfileService } = await import("../services/SmartChargingProfileService.js");
    const composite = await SmartChargingProfileService.calculateCompositeSchedule(
      chargerId,
      connectorId,
      duration,
      chargingRateUnit
    );

    return {
      status: composite.status,
      scheduleStart: composite.scheduleStart,
      chargingSchedule: {
        duration: composite.duration,
        startSchedule: composite.scheduleStart,
        chargingRateUnit: composite.chargingRateUnit,
        chargingSchedulePeriod: composite.chargingSchedulePeriod,
      },
      error: composite.error,
    };
  } catch (error) {
    logger.error(`Error in getCompositeSchedule for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to get composite schedule" };
  }
}

/**
 * Send SendLocalList request to charger (OCPP 1.6 / 2.0.1)
 */
export async function sendLocalList(
  chargerId: number,
  listVersion: number,
  updateType: "Full" | "Differential",
  localAuthorizationList: Array<{
    idTag: string;
    idTagInfo?: {
      status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
      expiryDate?: string;
      parentIdTag?: string;
    };
  }>
): Promise<{ status: string; error?: string }> {
  try {
    const payload = {
      listVersion,
      updateType,
      localAuthorizationList,
    };

    const result = await sendDistributedOcppCall(
      chargerId,
      "SendLocalList",
      payload,
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in sendLocalList for charger ${chargerId}: ${error}`);
    return { status: "Failed", error: "Failed to send SendLocalList" };
  }
}

/**
 * Send GetLocalListVersion request to charger (OCPP 1.6 / 2.0.1)
 */
export async function getLocalListVersion(
  chargerId: number
): Promise<{ status: string; listVersion?: number; error?: string }> {
  try {
    const result = await sendDistributedOcppCall(
      chargerId,
      "GetLocalListVersion",
      {},
      10000
    );
    return {
      status: result.status || "Accepted",
      listVersion: typeof result.listVersion === "number" ? result.listVersion : 0,
      error: result.error,
    };
  } catch (error) {
    logger.error(`Error in getLocalListVersion for charger ${chargerId}: ${error}`);
    return { status: "Failed", listVersion: 0, error: "Failed to get local list version" };
  }
}

/**
 * Send ReserveNow request to charger (OCPP 1.6 / 2.0.1)
 */
export async function reserveNow(
  chargerId: number,
  connectorId: number,
  expiryDate: string,
  idTag: string,
  reservationId: number,
  parentIdTag?: string
): Promise<{ status: string; error?: string }> {
  try {
    const payload: any = {
      connectorId,
      expiryDate,
      idTag,
      reservationId,
    };
    if (parentIdTag) {
      payload.parentIdTag = parentIdTag;
    }

    const result = await sendDistributedOcppCall(
      chargerId,
      "ReserveNow",
      payload,
      15000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in reserveNow for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send ReserveNow" };
  }
}

/**
 * Send CancelReservation request to charger (OCPP 1.6 / 2.0.1)
 */
export async function cancelReservation(
  chargerId: number,
  reservationId: number
): Promise<{ status: string; error?: string }> {
  try {
    const payload = { reservationId };
    const result = await sendDistributedOcppCall(
      chargerId,
      "CancelReservation",
      payload,
      10000
    );
    return { ...result, status: result.status || "Accepted" };
  } catch (error) {
    logger.error(`Error in cancelReservation for charger ${chargerId}: ${error}`);
    return { status: "Rejected", error: "Failed to send CancelReservation" };
  }
}

