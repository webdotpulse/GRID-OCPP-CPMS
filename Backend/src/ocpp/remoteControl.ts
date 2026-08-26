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
  const { chargerId, connectorId, idTag } = request;
  return await sendRemoteCommand(chargerId, "Start", { connectorId, idTag });
}

/**
 * Send RemoteStopTransaction request to charger
 */
export async function remoteStopTransaction(
  request: RemoteStopRequest
): Promise<{ status: string; error?: string }> {
  const { chargerId, transactionId } = request;
  return await sendRemoteCommand(chargerId, "Stop", { transactionId });
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
    const result = await sendDistributedOcppCall(
      chargerId,
      "ChangeAvailability",
      { connectorId, type },
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
    const result = await sendDistributedOcppCall(
      chargerId,
      "UnlockConnector",
      { connectorId },
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
    const result = await sendDistributedOcppCall(
      chargerId,
      "SetChargingProfile",
      { connectorId, csChargingProfiles },
      10000
    );
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
    const payload: any = {};
    if (id !== undefined) payload.id = id;
    if (connectorId !== undefined) payload.connectorId = connectorId;
    if (chargingProfilePurpose !== undefined) payload.chargingProfilePurpose = chargingProfilePurpose;
    if (stackLevel !== undefined) payload.stackLevel = stackLevel;

    const result = await sendDistributedOcppCall(
      chargerId,
      "ClearChargingProfile",
      payload,
      10000
    );
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
