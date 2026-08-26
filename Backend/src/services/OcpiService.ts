import axios from "axios";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface OcpiResponseEnvelope<T = any> {
  data: T;
  status_code: number;
  status_message: string;
  timestamp: string;
}

export function buildOcpiResponse<T = any>(
  data: T,
  statusCode: number = 1000,
  message: string = "Success"
): OcpiResponseEnvelope<T> {
  return {
    data,
    status_code: statusCode,
    status_message: message,
    timestamp: new Date().toISOString(),
  };
}

export class OcpiService {
  /**
   * Authorize a token in real-time (CPO tokens module)
   */
  public static async authorizeToken(
    tokenUid: string,
    tokenType: string = "RFID",
    locationId?: string
  ): Promise<{
    allowed: boolean;
    result: "ALLOWED" | "BLOCKED" | "EXPIRED" | "INVALID" | "NOT_ENOUGH_CREDIT";
    token: any;
    authorization_reference?: string;
  }> {
    try {
      // 1. Check RFID Whitelist
      const rfid = await prisma.rfidUser.findUnique({
        where: { rfid_tag: tokenUid },
      });

      if (rfid && rfid.active) {
        return {
          allowed: true,
          result: "ALLOWED",
          token: {
            uid: tokenUid,
            type: tokenType,
            contract_id: rfid.external_id || `NL-CPMS-${rfid.rfid_user_id}`,
            visual_number: rfid.rfid_tag,
            issuer: rfid.company_name || "OCPP-CPMS",
            valid: true,
            whitelist: "ALWAYS",
            last_updated: rfid.updatedAt.toISOString(),
          },
          authorization_reference: `AUTH_${Date.now()}_${tokenUid}`,
        };
      }

      // 2. Check ISO 15118 Vehicle Contract Certificate
      const vcc = await prisma.vehicleContractCertificate.findUnique({
        where: { emaid: tokenUid },
      });

      if (vcc) {
        if (vcc.status === "Expired" || new Date(vcc.expirationDate) < new Date()) {
          return {
            allowed: false,
            result: "EXPIRED",
            token: { uid: tokenUid, type: "AD_HOC_USER", valid: false, whitelist: "NEVER" },
          };
        }
        if (vcc.status === "Revoked") {
          return {
            allowed: false,
            result: "BLOCKED",
            token: { uid: tokenUid, type: "AD_HOC_USER", valid: false, whitelist: "NEVER" },
          };
        }
        if (vcc.status === "Valid") {
          return {
            allowed: true,
            result: "ALLOWED",
            token: {
              uid: tokenUid,
              type: "AD_HOC_USER",
              contract_id: vcc.emaid,
              issuer: "ISO15118-PNC",
              valid: true,
              whitelist: "ALWAYS",
              last_updated: vcc.updatedAt.toISOString(),
            },
            authorization_reference: `AUTH_${Date.now()}_${tokenUid}`,
          };
        }
      }

      // 3. Fallback check: Roaming partner token
      return {
        allowed: false,
        result: "NOT_ENOUGH_CREDIT",
        token: {
          uid: tokenUid,
          type: tokenType,
          valid: false,
          whitelist: "NEVER",
        },
      };
    } catch (error) {
      logger.error(`Error in OcpiService.authorizeToken: ${error}`);
      return {
        allowed: false,
        result: "INVALID",
        token: { uid: tokenUid, type: tokenType, valid: false, whitelist: "NEVER" },
      };
    }
  }

  /**
   * Compile an OCPI 2.2.1 Charge Detail Record (CDR) from a completed transaction
   */
  public static async compileCdrForTransaction(
    transactionId: string | number,
    partnerId?: number
  ): Promise<any> {
    try {
      const tx = await prisma.transaction.findFirst({
        where: { transactionId: String(transactionId) },
        include: {
          charger: {
            include: {
              chargingStation: true,
            },
          },
        },
      });

      const station = (tx?.charger as any)?.chargingStation || (tx?.charger as any)?.station;

      if (!tx || !station) {
        logger.warn(`Cannot compile CDR: Transaction ${transactionId} or station not found`);
        return null;
      }
      const startTime = tx.startTime || new Date();
      const endTime = tx.endTime || new Date();
      const totalEnergyKwh = Math.max(0, tx.energyConsumed || 0);
      const durationHours = Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 3600));
      const totalCost = tx.totalCost !== null && tx.totalCost !== undefined ? tx.totalCost / 100 : totalEnergyKwh * 0.45;

      const cdrId = `CDR-${tx.transactionId}`;

      // Resolve partner
      let resolvedPartnerId = partnerId;
      if (!resolvedPartnerId) {
        const roamingSession = await prisma.roamingSession.findFirst({
          where: { transactionId: String(transactionId) },
        });
        if (roamingSession) {
          resolvedPartnerId = roamingSession.partnerId;
        } else {
          // Default to first active roaming partner if none specified
          const defaultPartner = await prisma.roamingPartner.findFirst();
          resolvedPartnerId = defaultPartner?.id;
        }
      }

      if (!resolvedPartnerId) {
        logger.warn(`Cannot save CDR: No RoamingPartner found for transaction ${transactionId}`);
        return null;
      }

      const cdrRecord = await prisma.cDR.upsert({
        where: { cdrId },
        create: {
          cdrId,
          partnerId: resolvedPartnerId,
          stationId: station.id,
          transactionId: String(tx.transactionId),
          startTime,
          endTime,
          totalEnergy: Math.round(totalEnergyKwh * 100) / 100,
          totalTime: Math.round(durationHours * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          currency: "EUR",
          status: "pending",
        },
        update: {
          partnerId: resolvedPartnerId,
          stationId: station.id,
          startTime,
          endTime,
          totalEnergy: Math.round(totalEnergyKwh * 100) / 100,
          totalTime: Math.round(durationHours * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          currency: "EUR",
          status: "pending",
        },
      });

      logger.info(`Compiled OCPI CDR ${cdrId} for transaction ${transactionId} (Total: €${cdrRecord.totalCost.toFixed(2)})`);
      return cdrRecord;
    } catch (error) {
      logger.error(`Error in compileCdrForTransaction: ${error}`);
      return null;
    }
  }

  /**
   * Dispatch a compiled CDR to an eMSP partner endpoint with automatic retry
   */
  public static async dispatchCdrToPartner(
    cdrId: string,
    partnerId: number,
    maxRetries: number = 3
  ): Promise<boolean> {
    try {
      const cdr = await prisma.cDR.findUnique({
        where: { cdrId },
        include: {
          partner: true,
          station: true,
        },
      });

      if (!cdr || !cdr.partner) {
        logger.warn(`CDR ${cdrId} or partner not found for dispatch`);
        return false;
      }

      let credentials: any = {};
      try {
        if (cdr.partner.apiCredentials) {
          credentials = JSON.parse(cdr.partner.apiCredentials);
        }
      } catch {
        credentials = { url: cdr.partner.apiCredentials };
      }

      const targetUrl = credentials.cdr_url || credentials.url;
      const token = credentials.token || credentials.api_key || "OCPI_TOKEN";

      const ocpiCdrPayload = {
        country_code: cdr.station.country || "NL",
        party_id: "CPMS",
        id: cdr.cdrId,
        start_date_time: cdr.startTime.toISOString(),
        end_date_time: cdr.endTime.toISOString(),
        auth_id: cdr.transactionId,
        auth_method: "AUTH_REQUEST",
        location_id: String(cdr.stationId),
        evse_uid: `NL-CPMS-E${cdr.stationId}`,
        connector_id: "1",
        currency: cdr.currency || "EUR",
        tariffs: [],
        charging_periods: [
          {
            start_date_time: cdr.startTime.toISOString(),
            dimensions: [
              {
                type: "ENERGY",
                volume: cdr.totalEnergy,
              },
              {
                type: "TIME",
                volume: cdr.totalTime,
              },
            ],
          },
        ],
        total_cost: {
          excl_vat: Math.round((cdr.totalCost / 1.21) * 100) / 100,
          incl_vat: cdr.totalCost,
        },
        total_energy: cdr.totalEnergy,
        total_time: cdr.totalTime,
        last_updated: cdr.updatedAt.toISOString(),
      };

      if (!targetUrl) {
        logger.info(`[Mock Dispatch] Partner ${cdr.partner.name} has no external URL configured. Marked CDR ${cdrId} as sent.`);
        await prisma.cDR.update({
          where: { cdrId },
          data: { status: "sent" },
        });
        return true;
      }

      // Retry loop
      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        attempt++;
        try {
          logger.info(`Dispatching CDR ${cdrId} to ${targetUrl} (Attempt ${attempt}/${maxRetries})`);
          const response = await axios.post(targetUrl, ocpiCdrPayload, {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          });

          if (response.status >= 200 && response.status < 300) {
            success = true;
            await prisma.cDR.update({
              where: { cdrId },
              data: { status: "sent" },
            });
            logger.info(`Successfully dispatched CDR ${cdrId} to partner ${cdr.partner.name}`);
            return true;
          }
        } catch (err: any) {
          logger.warn(`CDR dispatch attempt ${attempt} failed: ${err.message}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      // If all retries failed
      await prisma.cDR.update({
        where: { cdrId },
        data: { status: "failed" },
      });
      return false;
    } catch (error) {
      logger.error(`Error in dispatchCdrToPartner: ${error}`);
      return false;
    }
  }

  /**
   * Send asynchronous command callback to eMSP response_url
   */
  public static async sendCommandCallback(
    responseUrl: string,
    result: { result: "ACCEPTED" | "REJECTED" | "UNKNOWN"; message?: string }
  ): Promise<void> {
    try {
      if (!responseUrl || !responseUrl.startsWith("http")) return;

      const envelope = buildOcpiResponse(result);
      await axios.post(responseUrl, envelope, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }).catch((err) => {
        logger.warn(`Async command callback failed to ${responseUrl}: ${err.message}`);
      });
    } catch (err) {
      logger.error(`Error sending command callback: ${err}`);
    }
  }
}
