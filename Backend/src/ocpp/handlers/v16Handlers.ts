import { config } from "../../config/index.js";
import { prisma } from "../../config/database.js";
import { chargerRegistry } from "../chargerRegistry.js";
import { MeterValueService, MeterValuePayload } from "../../services/MeterValueService.js";
import { enqueueMeterValue, enqueueStatusEvent, enqueueBillingJob } from "../../queues/queueManager.js";
import { logger } from "../../utils/logger.js";
import { loadManagementService } from "../../services/LoadManagementService.js";
import { logOcppMessage } from "../messageHandlers.js";
import { OcppError } from "../errors/OcppError.js";
import { normalizeMeterValues, resolveMappedCardId } from "../quirkNormalizer.js";
import { redisClient } from "../../config/redis.js";
import { getTariffForTransaction } from "../../utils/tariffHelpers.js";
import { DynamicTariffService } from "../../services/DynamicTariffService.js";

const ocpp16Reasons = [
  "EmergencyStop", "EVDisconnected", "HardReset", "Local", "Other",
  "PowerLoss", "Reboot", "Remote", "SoftReset", "UnlockCommand", "DeAuthorized"
];

const ocpp16Measurands = [
  "Current.Export", "Current.Import", "Current.Offered",
  "Energy.Active.Export.Register", "Energy.Active.Import.Register",
  "Energy.Reactive.Export.Register", "Energy.Reactive.Import.Register",
  "Energy.Active.Export.Interval", "Energy.Active.Import.Interval",
  "Energy.Reactive.Export.Interval", "Energy.Reactive.Import.Interval",
  "Frequency", "Power.Active.Export", "Power.Active.Import", "Power.Offered",
  "Power.Reactive.Export", "Power.Reactive.Import", "Power.Factor",
  "SoC", "Temperature", "Voltage"
];

const ocpp16ChargePointStatuses = [
  "Available", "Preparing", "Charging", "SuspendedEVSE", "SuspendedEV",
  "Finishing", "Reserved", "Unavailable", "Faulted"
];

function validateAndCoerceEnum(value: string, allowedEnums: string[], enumName: string): string {
  if (!value) return value;

  if (allowedEnums.includes(value)) {
    return value;
  }

  const lowerValue = value.toLowerCase();
  const matchedEnum = allowedEnums.find(e => e.toLowerCase() === lowerValue);

  if (matchedEnum) {
    logger.warn(`OCPP 1.6 ${enumName} case violation: received '${value}', coercing to '${matchedEnum}'`);
    return matchedEnum;
  }

  logger.warn(`Unknown OCPP 1.6 ${enumName}: received '${value}'. Proceeding in observation mode.`);
  return value;
}

/**
 * Handle BootNotification from charger
 */
export async function handleBootNotification(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const { chargePointVendor, chargePointModel, chargePointSerialNumber, firmwareVersion } = payload;

  try {
    // Check if charger exists in database
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) {
      logger.warn(`Charger ${chargerId} not found in database. Rejecting.`);
      await logOcppMessage(chargerId, "in", payload);
      return {
        status: "Rejected",
        currentTime: new Date().toISOString(),
        interval: config.heartbeatInterval,
      };
    }

    // Update charger info if needed
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        status: "active",
        last_heartbeat: new Date(),
        manufacturer: chargePointVendor,
        model: chargePointModel,
        serial_number: chargePointSerialNumber,
        firmware_version: firmwareVersion || "Unknown",
      },
    });

    // Update registry heartbeat
    await chargerRegistry.updateHeartbeat(chargerId);

    // Dispatch Webhook for charger.booted
    import("../../services/WebhookService.js")
      .then(({ WebhookService }) => {
        WebhookService.dispatch("charger.booted", {
          chargerId,
          chargerName: charger.name,
          model: chargePointModel,
          vendor: chargePointVendor,
          firmwareVersion: firmwareVersion || "Unknown",
          stationId: charger.charging_station_id,
          timestamp: new Date().toISOString(),
        }, charger.owner_id || null).catch(() => {});
      })
      .catch(() => {});

    const response = {
      status: "Accepted",
      currentTime: new Date().toISOString(),
      interval: config.heartbeatInterval,
    };

    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling BootNotification: ${error}`);
    return {
      status: "Rejected",
      currentTime: new Date().toISOString(),
      interval: config.heartbeatInterval,
    };
  }
}

/**
 * Handle Heartbeat from charger
 */
export async function handleHeartbeat(
  chargerId: number,
  payload: any
): Promise<any> {
  try {
    // Update charger's last heartbeat in database
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { status: "active", last_heartbeat: new Date() },
    });

    // Update registry heartbeat
    await chargerRegistry.updateHeartbeat(chargerId);

    const response = {
      currentTime: new Date().toISOString(),
    };

    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling Heartbeat: ${error}`);
    return {
      currentTime: new Date().toISOString(),
    };
  }
}

export { resolveMappedCardId } from "../quirkNormalizer.js";

/**
 * Handle Authorize request from charger
 */
export async function handleAuthorize(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const rawIdTag = payload.idToken?.idToken || payload.idTag;

  try {
    const { AuthorizationService } = await import("../../services/AuthorizationService.js");
    const authResult = await AuthorizationService.validateAuthorization({
      chargerId,
      rawIdTag,
    });

    const status = authResult.isAuthorized ? "Accepted" : (authResult.status || "Invalid");
    let response: any = {
      idTagInfo: { status },
    };

    if (!authResult.isAuthorized) {
      logger.warn(`Authorize rejected: RFID/EMAID tag ${rawIdTag} not authorized (${authResult.reason || status})`);
    } else {
      logger.info(`Authorize accepted: RFID/EMAID tag ${rawIdTag} (${authResult.userName || "Authorized"})`);
    }

    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling Authorize: ${error}`);
    let errResponse: any = {};
    errResponse.idTagInfo = { status: "Invalid" };
    return errResponse;
  }
}

/**
 * Handle StartTransaction request from charger
 */
export async function handleStartTransaction(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const { idTag, meterStart, timestamp } = payload;
  const rawConnectorId = payload.connectorId;
  const parsedConnectorId = typeof rawConnectorId === 'number'
    ? rawConnectorId
    : (typeof rawConnectorId === 'string' ? (parseInt(rawConnectorId.replace(/\D/g, ""), 10) || 1) : 1);
  const connectorId = isNaN(parsedConnectorId) || parsedConnectorId < 1 ? 1 : parsedConnectorId;

  try {
    // Use transaction ID from payload if provided (OCPP 2.1), else generate (OCPP 1.6)
    const transactionId = payload.transactionId ? String(payload.transactionId) : String(Math.floor(Date.now() / 1000));

    // Handle Quirks
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { quirkProfile: true },
    });

    const rules = charger?.quirkProfile?.rules as any;
    if ((rules && rules.ignoreMeterStart) || !meterStart) {
       const ignoreMeterStartKey = `tx_ignore_meter_start:${transactionId}`;
       await redisClient.set(ignoreMeterStartKey, "true", "EX", 86400); // 24h expiration
       logger.debug(`[Quirk] Will ignore meterStart for transaction ${transactionId} and retroactively set via first MeterValue`);
    }

    // Resolve mapped card ID for solar/quirk translation
    const effectiveIdTag = idTag ? resolveMappedCardId(idTag, rules) : idTag;

    // Determine effective connector ID and name (handling paired secondary charger mapping to Channel 2)
    let effectiveConnectorId = connectorId;
    if (charger?.isCombined && charger?.pairedRole === "secondary" && connectorId === 1) {
      effectiveConnectorId = 2;
    }
    const connectorName = `Channel ${effectiveConnectorId}`;

    // Check if RFID tag is valid (if provided)
    let rfidUserId: number | undefined;
    if (idTag) {
      const { AuthorizationService } = await import("../../services/AuthorizationService.js");
      const authResult = await AuthorizationService.validateAuthorization({
        chargerId,
        rawIdTag: idTag,
      });

      if (!authResult.isAuthorized) {
        logger.warn(`StartTransaction rejected: RFID tag ${idTag} (effective: ${effectiveIdTag}) not authorized: ${authResult.reason || authResult.status}`);
        let response: any = {};
        response.idTagInfo = { status: authResult.status || "Invalid" };
        await logOcppMessage(chargerId, "out", response);
        return response;
      }
      rfidUserId = authResult.rfidUser?.rfid_user_id;
    }

    // Always create a system Transaction record
    const newTransaction = await prisma.transaction.create({
      data: {
        transactionId: String(transactionId),
        charger_id: chargerId,
        connectorName,
        rfidUserId: rfidUserId || null,
        startTime: new Date(timestamp || new Date()),
        initialMeterValue: meterStart,
        status: "charging",
        idTag: effectiveIdTag || idTag,
      },
      include: { charger: true }
    });

    // Create RfidSession if an RFID tag was used
    if (rfidUserId) {
      await prisma.rfidSession.create({
        data: {
          transactionId: String(transactionId),
          charger_id: chargerId, connectorName,
          rfidUserId: rfidUserId,
          startTime: new Date(timestamp || new Date()),
          initialMeterValue: meterStart,
          status: "charging",
        },
      });
      logger.info(`Started RfidSession for tag ${idTag} on charger ${chargerId}`);
    }

    // Start transaction in registry memory/Redis
    await chargerRegistry.startTransaction(chargerId, transactionId, connectorName, idTag);

    // Update channel status
    const existingConnector = await prisma.connector.findFirst({
        where: {
          evse: { charger_id: chargerId },
          connector_name: connectorName
        }
      });

    if (existingConnector) {
      await prisma.connector.update({
        where: { connector_id: existingConnector.connector_id },
        data: { status: "Charging", updatedAt: new Date() },
      });
    }

    // If paired secondary charger, also update primary charger's Channel 2 connector
    if (charger?.isCombined && charger?.pairedRole === "secondary" && charger?.pairedChargerId) {
      const primaryConnector = await prisma.connector.findFirst({
        where: {
          evse: { charger_id: charger.pairedChargerId },
          connector_name: "Channel 2"
        }
      });
      if (primaryConnector) {
        await prisma.connector.update({
          where: { connector_id: primaryConnector.connector_id },
          data: { status: "Charging", updatedAt: new Date() },
        });
      }
    }

    logger.info(
      `Transaction ${transactionId} started on charger ${chargerId}, channel ${effectiveConnectorId}`
    );

    // Consume any active reservation on this connector
    import("../../services/ReservationService.js")
      .then(({ ReservationService }) => ReservationService.consumeReservation(chargerId, connectorId, idTag))
      .catch(() => {});

    // Trigger Load Balancing to recalculate capacity with new session
    if (newTransaction.charger.charging_station_id) {
      loadManagementService.balanceSiteLoad(newTransaction.charger.charging_station_id)
        .catch(err => logger.error(`Error balancing site load: ${err}`));
    }
    if (newTransaction.charger.chargeGroupId) {
      loadManagementService.balanceChargeGroupLoad(newTransaction.charger.chargeGroupId)
        .catch(err => logger.error(`Error balancing charge group load: ${err}`));
    }

    // Dispatch Webhook for transaction.started
    import("../../services/WebhookService.js")
      .then(({ WebhookService }) => {
        WebhookService.dispatch("transaction.started", {
          transactionId: String(transactionId),
          chargerId,
          chargerName: newTransaction.charger.name,
          connectorId: effectiveConnectorId,
          idTag: effectiveIdTag || idTag,
          meterStart,
          timestamp: new Date(timestamp || new Date()).toISOString(),
        }, newTransaction.charger.owner_id || null).catch(() => {});
      })
      .catch(() => {});

    let response: any = {
      transactionId: parseInt(transactionId, 10) || 0,
    };
    response.idTagInfo = { status: "Accepted" };

    await logOcppMessage(chargerId, "out", response, transactionId);
    return response;
  } catch (error) {
    logger.error(`Error handling StartTransaction: ${error}`);
    let errResponse: any = { transactionId: 0 };
    errResponse.idTagInfo = { status: "Invalid" };
    return errResponse;
  }
}

/**
 * Handle StopTransaction request from charger
 */
export async function handleStopTransaction(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  let { transactionId, meterStop, timestamp, idTag, reason, transactionData } = payload;

  reason = reason ? validateAndCoerceEnum(reason, ocpp16Reasons, 'Reason') : reason;

  try {
    // Process optional final meter values
    if (transactionData && Array.isArray(transactionData)) {
      const tempTransaction = await prisma.transaction.findFirst({
        where: { transactionId: String(transactionId) },
      });
      const match = tempTransaction?.connectorName?.match(/\d+/);
      const parsedId = match ? parseInt(match[0], 10) : 1;
      const connectorId = isNaN(parsedId) || parsedId < 1 ? 1 : parsedId;

      await handleMeterValues(chargerId, {
        connectorId: connectorId,
        transactionId: transactionId,
        meterValue: transactionData,
      });
    }

    // Handle Quirk card ID resolution
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { quirkProfile: true },
    });
    const rules = charger?.quirkProfile?.rules as any;
    const effectiveIdTag = idTag ? resolveMappedCardId(idTag, rules) : idTag;

    // End transaction in registry memory/Redis immediately
    await chargerRegistry.endTransaction(chargerId, transactionId);

    // Enqueue billing and cost computation to BullMQ background worker
    await enqueueBillingJob({
      chargerId,
      transactionId: String(transactionId),
      meterStop: typeof meterStop === "number" ? meterStop : (parseFloat(meterStop) || 0),
      timestamp: timestamp ? (timestamp instanceof Date ? timestamp.toISOString() : timestamp) : new Date().toISOString(),
      idTag: effectiveIdTag || idTag,
      reason,
    });

    const response = {
      idTagInfo: { status: "Accepted" },
    };
    await logOcppMessage(chargerId, "out", response, transactionId);
    return response;
  } catch (error) {
    logger.error(`Error handling StopTransaction: ${error}`);
    return {
      idTagInfo: { status: "Invalid" },
    };
  }
}

/**
 * Handle MeterValues from charger
 */
export async function handleMeterValues(
  chargerId: number,
  payload: any
): Promise<void> {
  const { meterValue, transactionId } = payload;
  const rawConnectorId = payload.connectorId;
  const parsedConnectorId = typeof rawConnectorId === 'number'
    ? rawConnectorId
    : (typeof rawConnectorId === 'string' ? (parseInt(rawConnectorId.replace(/\D/g, ""), 10) || 1) : 1);
  const connectorId = isNaN(parsedConnectorId) || parsedConnectorId < 1 ? 1 : parsedConnectorId;

  try {
    if (!transactionId) return;

    // Fetch the charger and its quirkProfile once per payload
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { quirkProfile: true },
    });
    const rules = charger?.quirkProfile?.rules;

    if (Array.isArray(meterValue)) {
      let energyValue: number | undefined = undefined;
      let powerValue: number | undefined = undefined;
      let socValue: number | null = null;
      let currentValue: number | null = null;
      let voltageValue: number | null = null;
      let temperatureValue: number | null = null;
      let timestamp = new Date();
      let hasReadings = false;

      for (const mv of meterValue) {
        if (mv.timestamp) {
          timestamp = new Date(mv.timestamp);
        }

        if (mv.sampledValue && Array.isArray(mv.sampledValue)) {
          for (const sv of mv.sampledValue) {
            let rawMeasurand = sv.measurand || "Energy.Active.Import.Register";
            const measurand = validateAndCoerceEnum(rawMeasurand, ocpp16Measurands, 'Measurand');
            if (measurand === "Energy.Active.Import.Register" || measurand === "Energy") {
              energyValue = parseFloat(sv.value);
              hasReadings = true;
            } else if (measurand === "Power.Active.Import" || measurand === "Power") {
              powerValue = parseFloat(sv.value);
              hasReadings = true;
            } else if (measurand === "SoC") {
              socValue = parseFloat(sv.value);
              hasReadings = true;
            } else if (measurand === "Current.Import" || measurand === "Current.Offered") {
              currentValue = parseFloat(sv.value);
              hasReadings = true;
            } else if (measurand === "Voltage") {
              voltageValue = parseFloat(sv.value);
              hasReadings = true;
            }
            else if (measurand === "Temperature") {
              temperatureValue = parseFloat(sv.value);
              hasReadings = true;
            }
          }
        } else if (mv.value !== undefined) {
           energyValue = parseFloat(mv.value);
           hasReadings = true;
        }
      }

      if (hasReadings) {
        // Handle secondary paired charger channel 2 mapping
        let effectiveConnectorId = connectorId;
        if (charger?.isCombined && charger?.pairedRole === "secondary" && connectorId === 1) {
          effectiveConnectorId = 2;
        }

        let parsedPayload: MeterValuePayload = {
          transactionId: String(transactionId),
          chargerId,
          connectorId: effectiveConnectorId,
          energyValue: energyValue,
          powerValue: powerValue,
          socValue: socValue ?? null,
          currentValue: currentValue ?? null,
          voltageValue: voltageValue ?? null,
          temperatureValue: temperatureValue ?? null,
          timestamp,
        };

        parsedPayload = await normalizeMeterValues(chargerId, parsedPayload, rules);

        const ignoreMeterStartKey = `tx_ignore_meter_start:${transactionId}`;
        const shouldIgnoreMeterStart = await redisClient.get(ignoreMeterStartKey);
        if (shouldIgnoreMeterStart) {
          await prisma.transaction.updateMany({
            where: { transactionId: String(transactionId) },
            data: { initialMeterValue: parsedPayload.energyValue },
          });
          await prisma.rfidSession.updateMany({
             where: { transactionId: String(transactionId) },
             data: { initialMeterValue: parsedPayload.energyValue },
          });
          await redisClient.del(ignoreMeterStartKey);
          logger.debug(`[Quirk] Retroactively updated initialMeterValue to ${parsedPayload.energyValue} for transaction ${transactionId}`);
        }

        // Push aggregated meter value to BullMQ queue
        await enqueueMeterValue({
          ...parsedPayload,
          timestamp: parsedPayload.timestamp instanceof Date ? parsedPayload.timestamp.toISOString() : parsedPayload.timestamp,
        });
      }
    }

    await logOcppMessage(chargerId, "in", payload, transactionId);
  } catch (error) {
    logger.error(`Error handling MeterValues: ${error}`);
  }
}

/**
 * Handle StatusNotification from charger
 */
export async function handleStatusNotification(
  chargerId: number,
  payload: any
): Promise<any> {
  const rawConnector = payload.evseId ?? payload.connectorId;
  const parsedConnectorId = typeof rawConnector === 'number'
    ? rawConnector
    : (typeof rawConnector === 'string' ? (parseInt(rawConnector.replace(/\D/g, ""), 10) || 0) : 0);
  const connectorId = isNaN(parsedConnectorId) || parsedConnectorId < 0 ? 0 : parsedConnectorId;
  let rawStatus = payload.connectorStatus ?? payload.status;
  const status = rawStatus ? validateAndCoerceEnum(rawStatus, ocpp16ChargePointStatuses, 'ChargePointStatus') : rawStatus;
  const errorCode = payload.errorCode;
  const timestamp = payload.timestamp || new Date();
  const info = payload.info;

  try {
    // Update registry heartbeat immediately
    await chargerRegistry.updateHeartbeat(chargerId);

    // Check if this charger is a secondary paired unit -> map connector 1 to connector 2 (Channel 2)
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      select: { isCombined: true, pairedRole: true, pairedChargerId: true }
    });

    let effectiveConnectorId = connectorId;
    if (charger?.isCombined && charger?.pairedRole === "secondary" && connectorId === 1) {
      effectiveConnectorId = 2;
    }

    // Enqueue status event to BullMQ background processor
    await enqueueStatusEvent({
      chargerId,
      connectorId: effectiveConnectorId,
      status,
      errorCode,
      info,
      vendorId: payload.vendorId,
      vendorErrorCode: payload.vendorErrorCode,
      timestamp: timestamp ? (timestamp instanceof Date ? timestamp.toISOString() : timestamp) : new Date().toISOString(),
    });

    // If paired secondary charger, also update primary charger's Channel 2 connector
    if (charger?.isCombined && charger?.pairedRole === "secondary" && charger?.pairedChargerId && effectiveConnectorId === 2) {
      const primaryConnector = await prisma.connector.findFirst({
        where: {
          evse: { charger_id: charger.pairedChargerId },
          connector_name: "Channel 2"
        }
      });
      if (primaryConnector) {
        await prisma.connector.update({
          where: { connector_id: primaryConnector.connector_id },
          data: { status, updatedAt: new Date() },
        });
      }
    }

    logger.info(
      `StatusNotification enqueued for charger ${chargerId}: channel ${effectiveConnectorId} status = ${status}`
    );

    const response = {};
    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling StatusNotification: ${error}`);
    return {};
  }
}


/**
 * Handle DataTransfer request from charger (used for ISO 15118 PNAC etc)
 */
export async function handleDataTransfer(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const vendorId = payload.vendorId;
  const messageId = payload.messageId;

  logger.info(`Received DataTransfer from charger ${chargerId} [Vendor: ${vendorId}, MessageId: ${messageId}]`);

  // Default response for DataTransfer if not explicitly supported
  let response: any = {
    status: "UnknownVendorId",
    data: ""
  };

  // Here you can handle specific messageIds for ISO 15118 (e.g. Get15118EVCertificate)
  if (messageId === "Get15118EVCertificate" || vendorId === "ISO15118") {
     logger.debug(`Handling ISO 15118 PNAC DataTransfer for charger ${chargerId}`);
     // Try to extract EMAID from data if possible. Usually in OCPP 2.0.1 Get15118EVCertificate is a standard message.
     // In OCPP 1.6 it's sent via DataTransfer. Data may contain EMAID.
     const emaid = payload.data ? (typeof payload.data === "string" ? payload.data : payload.data.emaid || payload.data.exiRequest) : null;

     if (emaid) {
       const vcc = await prisma.vehicleContractCertificate.findUnique({
         where: { emaid: emaid as string }
       });
       if (vcc && vcc.status === "Valid" && vcc.expirationDate >= new Date()) {
          response.status = "Accepted";
          response.data = vcc.contractCert || "dummy_cert_data";
       } else {
          response.status = "Rejected";
          response.data = "Invalid or expired certificate";
       }
     } else {
       // We return accepted status; specific payload data would go here per spec
       response.status = "Accepted";
       response.data = "No EMAID provided";
     }
  } else {
     logger.warn(`Unrecognized DataTransfer vendorId: ${vendorId}, messageId: ${messageId} from charger ${chargerId}`);

     // Log the unrecognized data transfer as a diagnostic event
     try {
       await prisma.diagnosticEvent.create({
         data: {
           chargerId,
           type: "UnknownDataTransfer",
           description: `Received unsupported DataTransfer. Vendor: ${vendorId}, MessageId: ${messageId}`
         }
       });
     } catch(e) {
       logger.error("Error creating diagnostic event for unknown DataTransfer " + e);
     }
  }

  return response;
}

export async function handleOcppMessage16(
  chargerId: number,
  actionName: string,
  payload: any,
  protocol: string
): Promise<any> {
  let response: any;

  switch (actionName) {
    case "BootNotification":
      logger.debug(`Routing action ${actionName} -> handleBootNotification`);
      response = await handleBootNotification(chargerId, payload, protocol);
      break;
    case "Heartbeat":
      logger.debug(`Routing action ${actionName} -> handleHeartbeat`);
      response = await handleHeartbeat(chargerId, payload);
      break;
    case "Authorize":
      logger.debug(`Routing action ${actionName} -> handleAuthorize`);
      response = await handleAuthorize(chargerId, payload, protocol);
      break;
    case "StartTransaction":
      logger.debug(`Routing action ${actionName} -> handleStartTransaction`);
      response = await handleStartTransaction(chargerId, payload, protocol);
      break;
    case "StopTransaction":
      logger.debug(`Routing action ${actionName} -> handleStopTransaction`);
      response = await handleStopTransaction(chargerId, payload, protocol);
      break;
    case "MeterValues":
      logger.debug(`Routing action ${actionName} -> handleMeterValues`);
      await handleMeterValues(chargerId, payload);
      response = {};
      break;
    case "StatusNotification":
      logger.debug(`Routing action ${actionName} -> handleStatusNotification`);
      response = await handleStatusNotification(chargerId, payload);
      break;
    case "DataTransfer":
      logger.debug(`Routing action ${actionName} -> handleDataTransfer`);
      response = await handleDataTransfer(chargerId, payload, protocol);
      break;
    default:
      logger.warn(`Unknown action name: ${actionName}`);
      throw new OcppError("NotImplemented", `Unknown action name: ${actionName}`);
  }

  return response;
}
