import { config } from "../../config/index.js";
import { prisma } from "../../config/database.js";
import { chargerRegistry } from "../chargerRegistry.js";
import { MeterValueService } from "../../services/MeterValueService.js";
import { enqueueMeterValue, enqueueStatusEvent, enqueueBillingJob } from "../../queues/queueManager.js";
import { logger } from "../../utils/logger.js";
import { loadManagementService } from "../../services/LoadManagementService.js";
import { logOcppMessage } from "../messageHandlers.js";
import { OcppError } from "../errors/OcppError.js";
import { getTariffForTransaction } from "../../utils/tariffHelpers.js";
import { DynamicTariffService } from "../../services/DynamicTariffService.js";
import { resolveMappedCardId } from "../quirkNormalizer.js";
import {
  handleGetVariables,
  handleSetVariables,
  handleGetBaseReport,
  handleNotifyReport,
} from "./deviceModel/v21DeviceModelHandlers.js";

/**
 * Handle BootNotification from charger
 */
export async function handleBootNotification(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  logger.info(`BootNotification received from charger ${chargerId} using protocol ${protocol || "ocpp2.1"}`, payload);

  let vendor = payload.chargingStation?.vendorName;
  let model = payload.chargingStation?.model;
  let serialNumber = payload.chargingStation?.serialNumber;

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
        manufacturer: vendor,
        model: model,
        serial_number: serialNumber,
        firmware_version: payload.chargingStation?.firmwareVersion || payload.firmwareVersion || "Unknown",
      },
    });

    // Update registry heartbeat
    await chargerRegistry.updateHeartbeat(chargerId);

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

/**
 * Handle Authorize request from charger
 */
export async function handleAuthorize(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const rawIdTag = payload.idToken?.idToken;
  const hashData = payload.iso15118CertificateHashData || payload["15118CertificateHashData"] || payload.certificateHashData;

  try {
    const { AuthorizationService } = await import("../../services/AuthorizationService.js");
    const authResult = await AuthorizationService.validateAuthorization({
      chargerId,
      rawIdTag,
      hashData,
    });

    const status = authResult.isAuthorized ? "Accepted" : (authResult.status || "Invalid");
    const response = { idTokenInfo: { status } };

    if (!authResult.isAuthorized) {
      logger.warn(`Authorize rejected: Identifier ${rawIdTag || "ISO15118"} not authorized (status: ${status}, reason: ${authResult.reason})`);
    } else {
      logger.info(`Authorize accepted: Identifier ${rawIdTag || "ISO15118"} (${authResult.userName || "Authorized"})`);
    }

    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling Authorize: ${error}`);
    const errResponse = { idTokenInfo: { status: "Invalid" } };
    return errResponse;
  }
}

/**
 * Handle StatusNotification from charger
 */
export async function handleStatusNotification(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const { connectorId, connectorStatus, evseId, timestamp } = payload;
  const targetConnectorId = connectorId ?? evseId ?? 1;

  try {
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      select: { isCombined: true, pairedRole: true, pairedChargerId: true }
    });

    let effectiveConnectorId = targetConnectorId;
    if (charger?.isCombined && charger?.pairedRole === "secondary" && targetConnectorId === 1) {
      effectiveConnectorId = 2;
    }

    const connectorName = `Channel ${effectiveConnectorId}`;

    const evse = await prisma.evse.upsert({
      where: {
        charger_id_evse_id: {
          charger_id: chargerId,
          evse_id: effectiveConnectorId,
        },
      },
      update: {},
      create: {
        charger_id: chargerId,
        evse_id: effectiveConnectorId,
      },
    });

    let existingConnector = await prisma.connector.findFirst({
      where: {
        evse_id: evse.id,
        OR: [
          { connector_name: connectorName },
          { connector_name: `Connector ${effectiveConnectorId}` },
          { connector_name: { startsWith: `Channel ${effectiveConnectorId}` } },
          { connector_name: { startsWith: `CH ${effectiveConnectorId}` } },
        ],
      },
    });

    if (!existingConnector) {
      existingConnector = await prisma.connector.findFirst({
        where: {
          evse_id: evse.id,
        },
      });
    }

    if (existingConnector) {
      await prisma.connector.update({
        where: { connector_id: existingConnector.connector_id },
        data: {
          status: connectorStatus,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.connector.create({
        data: {
          connector_name: connectorName,
          status: connectorStatus,
          current_type: "AC",
          evse_id: evse.id,
        },
      });
    }

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
          data: { status: connectorStatus, updatedAt: new Date() },
        });
      }
    }

    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { status: "active", last_heartbeat: new Date() },
    });

    await chargerRegistry.updateHeartbeat(chargerId);

    await enqueueStatusEvent({
      chargerId,
      connectorId: effectiveConnectorId,
      status: connectorStatus,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    const response = {};
    await logOcppMessage(chargerId, "out", response);
    return response;
  } catch (error) {
    logger.error(`Error handling StatusNotification: ${error}`);
    return {};
  }
}

/**
 * Handle TransactionEvent from charger (OCPP 2.0.1 / 2.1)
 */
export async function handleTransactionEvent(
  chargerId: number,
  payload: any,
  protocol?: string
): Promise<any> {
  const { eventType, timestamp, meterValue, transactionInfo, idToken, evse } = payload;
  const transactionId = transactionInfo?.transactionId;
  const connectorId = evse?.id;
  const rawIdTag = idToken?.idToken;
  const chargingState = transactionInfo?.chargingState;

  const isV2GDischarging = chargingState === "Discharging";

  try {
    // Handle Quirk rules & card ID translation
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { quirkProfile: true },
    });
    const rules = charger?.quirkProfile?.rules as any;
    const idTag = rawIdTag ? resolveMappedCardId(rawIdTag, rules) : rawIdTag;

    // Determine effective connector ID and name
    let effectiveConnectorId = connectorId || 1;
    if (charger?.isCombined && charger?.pairedRole === "secondary" && effectiveConnectorId === 1) {
      effectiveConnectorId = 2;
    }
    const connectorName = `Channel ${effectiveConnectorId}`;

    if (eventType === "Started") {
      let meterStart = 0;
      if (meterValue && meterValue.length > 0 && meterValue[0].sampledValue && meterValue[0].sampledValue.length > 0) {
        meterStart = parseFloat(meterValue[0].sampledValue[0].value) || 0;
      }

      let rfidUserId: number | undefined;
      if (rawIdTag || idTag) {
        const { AuthorizationService } = await import("../../services/AuthorizationService.js");
        const authResult = await AuthorizationService.validateAuthorization({
          chargerId,
          rawIdTag: rawIdTag || idTag,
        });

        if (!authResult.isAuthorized) {
          logger.warn(
            `TransactionEvent (Started) rejected: RFID tag ${rawIdTag || idTag} not authorized: ${authResult.reason || authResult.status}`
          );
          let response: any = {};
          response.idTokenInfo = { status: authResult.status || "Invalid" };
          await logOcppMessage(chargerId, "out", response);
          return response;
        }
        rfidUserId = authResult.rfidUser?.rfid_user_id;
      }

      const newTransaction = await prisma.transaction.create({
        data: {
          transactionId: String(transactionId),
          charger_id: chargerId,
          connectorName,
          rfidUserId: rfidUserId || null,
          startTime: new Date(timestamp || new Date()),
          initialMeterValue: meterStart,
          status: "charging",
          idTag,
        },
        include: { charger: true }
      });

      if (rfidUserId) {
        await prisma.rfidSession.create({
          data: {
            transactionId: String(transactionId),
            charger_id: chargerId,
            connectorName,
            rfidUserId: rfidUserId,
            startTime: new Date(timestamp || new Date()),
            initialMeterValue: meterStart,
            status: "charging",
          },
        });
        logger.info(`Started RfidSession for tag ${idTag} on charger ${chargerId}`);
      }

      await chargerRegistry.startTransaction(chargerId, transactionId, connectorName, idTag);

      let existingConnector = await prisma.connector.findFirst({
        where: {
          evse: { charger_id: chargerId, evse_id: effectiveConnectorId },
        }
      });

      if (!existingConnector) {
        existingConnector = await prisma.connector.findFirst({
          where: {
            evse: { charger_id: chargerId },
            OR: [
              { connector_name: connectorName },
              { connector_name: { startsWith: `Channel ${effectiveConnectorId}` } },
              { connector_name: { startsWith: `CH ${effectiveConnectorId}` } },
            ]
          }
        });
      }

      if (!existingConnector) {
        existingConnector = await prisma.connector.findFirst({
          where: {
            evse: { charger_id: chargerId },
          }
        });
      }

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

      logger.info(`Transaction ${transactionId} started on charger ${chargerId}, channel ${effectiveConnectorId}`);

      if (newTransaction.charger.charging_station_id) {
        loadManagementService.balanceSiteLoad(newTransaction.charger.charging_station_id)
          .catch(err => logger.error(`Error balancing site load: ${err}`));
      }
      if (newTransaction.charger.chargeGroupId) {
        loadManagementService.balanceChargeGroupLoad(newTransaction.charger.chargeGroupId)
          .catch(err => logger.error(`Error balancing charge group load: ${err}`));
      }

      // Consume active reservation
      import("../../services/ReservationService.js")
        .then(({ ReservationService }) => ReservationService.consumeReservation(chargerId, connectorId, idTag))
        .catch(() => {});

      let response: any = { idTokenInfo: { status: "Accepted" } };
      await logOcppMessage(chargerId, "out", response, transactionId);
      return response;

} else if (eventType === "Updated") {
      if (meterValue && meterValue.length > 0) {
        let energyValue: number | undefined = undefined;
        let powerValue: number | undefined = undefined;
        let socValue: number | null = null;
        let currentValue: number | null = null;
        let voltageValue: number | null = null;
        let current_L1: number | null = null;
        let current_L2: number | null = null;
        let current_L3: number | null = null;
        let voltage_L1: number | null = null;
        let voltage_L2: number | null = null;
        let voltage_L3: number | null = null;

        let mvTimestamp = new Date();

        for (const mv of meterValue) {
          if (mv.timestamp) {
            mvTimestamp = new Date(mv.timestamp);
          }
          if (mv.sampledValue && Array.isArray(mv.sampledValue)) {
            for (const sv of mv.sampledValue) {
              const measurand = sv.measurand || "Energy.Active.Import.Register";
              const phase = sv.phase;
              // we parse but don't strictly use location for db schema yet unless specified, but user requested to extract it
              const location = sv.location;
              let val = parseFloat(sv.value);

              if (measurand === "Energy.Active.Import.Register" || measurand === "Energy") {
                energyValue = isV2GDischarging ? -Math.abs(val) : Math.abs(val);
              } else if (measurand === "Energy.Active.Export.Register") {
                energyValue = -Math.abs(val); // V2G export
              } else if (measurand === "Power.Active.Import" || measurand === "Power") {
                powerValue = isV2GDischarging ? -Math.abs(val) : Math.abs(val);
              } else if (measurand === "Power.Active.Export") {
                powerValue = -Math.abs(val); // V2G export
              } else if (measurand === "SoC") {
                socValue = val;
              } else if (measurand === "Current.Import" || measurand === "Current.Offered") {
                currentValue = val;
                if (phase === "L1") {
                  current_L1 = val;
                } else if (phase === "L2") {
                  current_L2 = val;
                } else if (phase === "L3") {
                  current_L3 = val;
                }
              } else if (measurand === "Current.Export") {
                currentValue = -Math.abs(val); // V2G export
                if (phase === "L1") {
                  current_L1 = -Math.abs(val);
                } else if (phase === "L2") {
                  current_L2 = -Math.abs(val);
                } else if (phase === "L3") {
                  current_L3 = -Math.abs(val);
                }
              } else if (measurand === "Voltage") {
                voltageValue = val;
                if (phase === "L1-N" || phase === "L1") {
                  voltage_L1 = val;
                } else if (phase === "L2-N" || phase === "L2") {
                  voltage_L2 = val;
                } else if (phase === "L3-N" || phase === "L3") {
                  voltage_L3 = val;
                }
              }
            }
          }
        }

        await MeterValueService.addMeterValue({
          transactionId: String(transactionId),
          chargerId,
          connectorId,
          energyValue,
          powerValue,
          socValue,
          currentValue,
          voltageValue,
          current_L1,
          current_L2,
          current_L3,
          voltage_L1,
          voltage_L2,
          voltage_L3,
          timestamp: mvTimestamp,
        });
      }

      let response: any = { idTokenInfo: { status: "Accepted" } };
      await logOcppMessage(chargerId, "out", response, transactionId);
      return response;

    } else if (eventType === "Ended") {
      let meterStop = 0;
      if (meterValue && meterValue.length > 0 && meterValue[0].sampledValue && meterValue[0].sampledValue.length > 0) {
        meterStop = parseFloat(meterValue[0].sampledValue[0].value) || 0;
      }

      await chargerRegistry.endTransaction(chargerId, transactionId);

      // Enqueue billing and cost computation to BullMQ background worker
      await enqueueBillingJob({
        chargerId,
        transactionId: String(transactionId),
        meterStop,
        timestamp: timestamp ? (timestamp instanceof Date ? timestamp.toISOString() : timestamp) : new Date().toISOString(),
        idTag,
        isV2GDischarging,
      });

      let response: any = { idTokenInfo: { status: "Accepted" } };
      await logOcppMessage(chargerId, "out", response, transactionId);
      return response;
    }

  } catch (error) {
    logger.error(`Error handling TransactionEvent: ${error}`);
    return {};
  }
  return {};
}


/**
 * Handle NotifyEvent from charger
 */
export async function handleNotifyEvent(
  chargerId: number,
  payload: any
): Promise<any> {
  try {
    const eventData = payload.eventData;
    if (Array.isArray(eventData)) {
      for (const event of eventData) {
        // According to the problem description, severity should be an Int.
        // We will default it to 1 if it's not present or not parseable, but try to parse it if it is.
        // wait, let's just make it a number.
        const severityStr = event.severity ?? (event.eventNotificationType === 'HardwareStatusChange' ? 1 : 2);
        let severity = 1;
        if (typeof severityStr === 'number') {
            severity = severityStr;
        } else if (typeof severityStr === 'string' && !isNaN(parseInt(severityStr))) {
            severity = parseInt(severityStr);
        } else {
            severity = 1; // default fallback
        }

        const componentName = event.component?.name || "Unknown";
        const variableName = event.variable?.name || "Unknown";
        const actualValue = event.actualValue || "Unknown";

        await prisma.chargerAlert.create({
          data: {
            chargerId,
            eventId: event.eventId,
            timestamp: new Date(event.timestamp),
            severity: severity,
            component: componentName,
            variable: variableName,
            actualValue: actualValue
          }
        });
      }
    }

    return {};
  } catch (error) {
    logger.error(`Error handling NotifyEvent: ${error}`);
    return {};
  }
}

/**
 * Handle SignCertificate from charger (CSR certificate issuance)
 */
export async function handleSignCertificate(
  chargerId: number,
  payload: any
): Promise<any> {
  const csrPem = payload.csr;
  const certificateType = payload.certificateType || "V2GCertificate";

  try {
    if (!csrPem) {
      logger.warn(`SignCertificate from charger ${chargerId} missing CSR payload`);
      return { status: "Rejected" };
    }

    const { PkiCertificateService } = await import("../../services/PkiCertificateService.js");
    const signed = PkiCertificateService.signCsr(csrPem, undefined, undefined, 365, { certificateType });

    // Store in installed certificates database
    await prisma.installedCertificate.create({
      data: {
        chargerId,
        certificateType,
        certificatePem: signed.certificatePem,
        serialNumber: signed.serialNumber,
        validFrom: signed.validFrom,
        validTo: signed.validTo,
        status: "Accepted",
        certificateHashData: signed.certificateHashData as any,
      },
    });

    logger.info(
      `SignCertificate processed for charger ${chargerId} (${certificateType}, SN: ${signed.serialNumber})`
    );

    // Asynchronously dispatch CertificateSigned frame to the charger
    import("../remoteControl.js")
      .then(({ certificateSigned }) => {
        if (typeof certificateSigned === "function") {
          certificateSigned(chargerId, certificateType, signed.certificateChain).catch((err) => {
            logger.error(`Error sending CertificateSigned to charger ${chargerId}: ${err}`);
          });
        }
      })
      .catch((err) => logger.error(`Error importing remoteControl: ${err}`));

    return { status: "Accepted" };
  } catch (error) {
    logger.error(`Error handling SignCertificate for charger ${chargerId}: ${error}`);
    return { status: "Rejected" };
  }
}

/**
 * Handle GetInstalledCertificateIds query
 */
export async function handleGetInstalledCertificateIds(
  chargerId: number,
  payload: any
): Promise<any> {
  const certificateTypes: string[] | undefined = payload.certificateType;

  try {
    const whereClause: any = { chargerId };
    if (certificateTypes && certificateTypes.length > 0) {
      whereClause.certificateType = { in: certificateTypes };
    }

    const installed = await prisma.installedCertificate.findMany({
      where: whereClause,
    });

    if (!installed || installed.length === 0) {
      return {
        status: "NotFound",
        certificateHashDataChain: [],
      };
    }

    const certificateHashDataChain = installed.map((cert) => ({
      certificateType: cert.certificateType,
      certificateHashData: cert.certificateHashData,
    }));

    return {
      status: "Accepted",
      certificateHashDataChain,
    };
  } catch (error) {
    logger.error(`Error handling GetInstalledCertificateIds for charger ${chargerId}: ${error}`);
    return { status: "NotFound", certificateHashDataChain: [] };
  }
}

/**
 * Handle InstallCertificate confirmation or ingestion
 */
export async function handleInstallCertificate(
  chargerId: number,
  payload: any
): Promise<any> {
  const certificateType = payload.certificateType || "CSMSRootCertificate";
  const certificatePem = payload.certificate;

  try {
    if (!certificatePem) {
      return { status: "Rejected" };
    }

    const { PkiCertificateService } = await import("../../services/PkiCertificateService.js");
    const hashData = PkiCertificateService.compute15118CertificateHashData(certificatePem);

    await prisma.installedCertificate.create({
      data: {
        chargerId,
        certificateType,
        certificatePem,
        serialNumber: hashData.serialNumber,
        status: "Accepted",
        certificateHashData: hashData as any,
      },
    });

    logger.info(`InstallCertificate processed for charger ${chargerId} (${certificateType})`);
    return { status: "Accepted" };
  } catch (error) {
    logger.error(`Error handling InstallCertificate for charger ${chargerId}: ${error}`);
    return { status: "Failed" };
  }
}

/**
 * Handle DeleteCertificate
 */
export async function handleDeleteCertificate(
  chargerId: number,
  payload: any
): Promise<any> {
  const hashData = payload.certificateHashData;

  try {
    if (!hashData || !hashData.serialNumber) {
      return { status: "NotFound" };
    }

    const serialNumber = hashData.serialNumber.replace(/[:\s-]/g, "").trim().toUpperCase();

    const deleted = await prisma.installedCertificate.deleteMany({
      where: {
        chargerId,
        serialNumber,
      },
    });

    if (deleted.count > 0) {
      logger.info(`Deleted certificate ${serialNumber} for charger ${chargerId}`);
      return { status: "Accepted" };
    }

    return { status: "NotFound" };
  } catch (error) {
    logger.error(`Error handling DeleteCertificate for charger ${chargerId}: ${error}`);
    return { status: "Failed" };
  }
}

export async function handleGet15118EVCertificate(chargerId: number, payload: any): Promise<any> {
  const emaid = payload.exiRequest || payload.emaid;

  try {
    if (emaid) {
      const vcc = await prisma.vehicleContractCertificate.findFirst({
        where: {
          OR: [
            { emaid: emaid as string },
            { serialNumber: emaid as string },
          ],
        },
      });

      if (vcc && vcc.status === "Valid" && new Date(vcc.expirationDate) >= new Date()) {
        return {
          status: "Accepted",
          exiResponse: vcc.contractCertChain || vcc.contractCert || "dummy_cert_data",
        };
      } else {
        return {
          status: "Failed",
          exiResponse: "Invalid or expired certificate",
        };
      }
    } else {
      return {
        status: "Failed",
        exiResponse: "No EMAID provided",
      };
    }
  } catch (error) {
    logger.error(`Error in handleGet15118EVCertificate: ${error}`);
    return { status: "Failed", exiResponse: "Error fetching EV certificate" };
  }
}

export async function handleOcppMessage21(
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
    case "StatusNotification":
      logger.debug(`Routing action ${actionName} -> handleStatusNotification`);
      response = await handleStatusNotification(chargerId, payload);
      break;
    case "TransactionEvent":
      logger.debug(`Routing action ${actionName} -> handleTransactionEvent`);
      response = await handleTransactionEvent(chargerId, payload, protocol);
      break;
    case "GetVariables":
      logger.debug(`Routing action ${actionName} -> handleGetVariables`);
      response = await handleGetVariables(chargerId, payload);
      break;
    case "SetVariables":
      logger.debug(`Routing action ${actionName} -> handleSetVariables`);
      response = await handleSetVariables(chargerId, payload);
      break;
    case "GetBaseReport":
      logger.debug(`Routing action ${actionName} -> handleGetBaseReport`);
      response = await handleGetBaseReport(chargerId, payload);
      break;
    case "NotifyReport":
      logger.debug(`Routing action ${actionName} -> handleNotifyReport`);
      response = await handleNotifyReport(chargerId, payload);
      break;
    case "NotifyEvent":
      logger.debug(`Routing action ${actionName} -> handleNotifyEvent`);
      response = await handleNotifyEvent(chargerId, payload);
      break;
    case "SignCertificate":
      logger.debug(`Routing action ${actionName} -> handleSignCertificate`);
      response = await handleSignCertificate(chargerId, payload);
      break;
    case "GetInstalledCertificateIds":
      logger.debug(`Routing action ${actionName} -> handleGetInstalledCertificateIds`);
      response = await handleGetInstalledCertificateIds(chargerId, payload);
      break;
    case "InstallCertificate":
      logger.debug(`Routing action ${actionName} -> handleInstallCertificate`);
      response = await handleInstallCertificate(chargerId, payload);
      break;
    case "DeleteCertificate":
      logger.debug(`Routing action ${actionName} -> handleDeleteCertificate`);
      response = await handleDeleteCertificate(chargerId, payload);
      break;
    case "Get15118EVCertificate":
      logger.debug(`Routing action ${actionName} -> handleGet15118EVCertificate`);
      response = await handleGet15118EVCertificate(chargerId, payload);
      break;
    default:
      logger.warn(`Unknown action name: ${actionName}`);
      throw new OcppError("NotImplemented", `Unknown action name: ${actionName}`);
  }

  return response;
}
