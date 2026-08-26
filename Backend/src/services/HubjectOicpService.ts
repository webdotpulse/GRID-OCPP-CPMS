import axios from "axios";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { isSafeExternalUrl } from "../api/oicp/oicp.controller.js";

export type OicpEvseStatus = "Available" | "Occupied" | "Reserved" | "OutOfService" | "Unknown";

export interface OicpEvseDataRecord {
  EvseId: string;
  ChargingStationId: string;
  ChargingStationNames: Array<{ lang: string; value: string }>;
  Address: {
    Country: string;
    City: string;
    Street: string;
    PostalCode: string;
  };
  GeoCoordinates: {
    Google: {
      Coordinates: string;
    };
  };
  ChargingFacilities: Array<{
    PowerType: string;
    Pow: number;
    Voltage: number;
    Amperage: number;
  }>;
  Plugs: string[];
  IsOpen24Hours: boolean;
  IsSubscribed: boolean;
}

export class HubjectOicpService {
  /**
   * Map standard OCPP 1.6/2.0.1 status to Hubject OICP 2.3 EVSEStatus
   */
  public static mapOcppToOicpStatus(ocppStatus: string): OicpEvseStatus {
    switch (ocppStatus?.toLowerCase()) {
      case "available":
        return "Available";
      case "preparing":
      case "charging":
      case "suspendedev":
      case "suspendedevse":
      case "finishing":
        return "Occupied";
      case "reserved":
        return "Reserved";
      case "unavailable":
      case "faulted":
        return "OutOfService";
      default:
        return "Unknown";
    }
  }

  /**
   * Helper to retrieve active Hubject endpoint from DB
   */
  private static async getActiveHubjectEndpoint(): Promise<{ url: string; token: string } | null> {
    try {
      // 1. Check dedicated OicpEndpoint model
      const endpoint = prisma.oicpEndpoint
        ? await prisma.oicpEndpoint.findFirst({
            where: { status: "active" },
            orderBy: { updatedAt: "desc" },
          })
        : null;

      if (endpoint && endpoint.url) {
        return { url: endpoint.url.replace(/\/+$/, ""), token: endpoint.token };
      }

      // 2. Check RoamingPartner table for Hubject type
      const partner = prisma.roamingPartner
        ? await prisma.roamingPartner.findFirst({
            where: { type: "Hubject/Clearinghouse" },
          })
        : null;

      if (partner?.apiCredentials) {
        try {
          const creds = JSON.parse(partner.apiCredentials);
          return {
            url: (creds.url || creds.hubject_url || "").replace(/\/+$/, ""),
            token: creds.token || creds.api_key || "",
          };
        } catch {
          return { url: partner.apiCredentials.replace(/\/+$/, ""), token: "DEFAULT_OICP_TOKEN" };
        }
      }

      return null;
    } catch (err) {
      logger.error(`Error retrieving Hubject endpoint: ${err}`);
      return null;
    }
  }

  /**
   * Push static EVSE master data for a station to Hubject (eRoamingPushEvseData)
   */
  public static async pushEvseData(stationId: number): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const station = await prisma.chargingStation.findUnique({
        where: { id: stationId },
        include: {
          chargers: {
            include: {
              evses: {
                include: {
                  connectors: true,
                },
              },
            },
          },
        },
      });

      if (!station) {
        logger.warn(`pushEvseData: Station ${stationId} not found`);
        return { success: false, count: 0, error: "Station not found" };
      }

      const countryCode = station.country || "NL";
      const operatorId = `${countryCode}*CPM`;

      const evseDataRecords: OicpEvseDataRecord[] = [];

      for (const charger of station.chargers) {
        for (const evse of charger.evses) {
          for (const conn of evse.connectors) {
            const evseId = `${countryCode}*CPM*E${charger.charger_id}*${conn.connector_id}`;
            const powerType = conn.current_type === "DC" ? "DC" : "AC_3_PHASE";
            const maxPower = conn.max_power || (conn.current_type === "DC" ? 150 : 22);

            evseDataRecords.push({
              EvseId: evseId,
              ChargingStationId: `STA-${station.id}`,
              ChargingStationNames: [{ lang: "en", value: station.station_name }],
              Address: {
                Country: countryCode,
                City: station.city || "Amsterdam",
                Street: station.street_name || "Main Street 1",
                PostalCode: station.postal_code || "1000AA",
              },
              GeoCoordinates: {
                Google: {
                  Coordinates: `${station.latitude || 52.3676} ${station.longitude || 4.9041}`,
                },
              },
              ChargingFacilities: [
                {
                  PowerType: powerType,
                  Pow: Math.round(maxPower * 1000), // in Watts
                  Voltage: Math.round(conn.max_voltage || (conn.current_type === "DC" ? 500 : 400)),
                  Amperage: Math.round(conn.max_current || (conn.current_type === "DC" ? 300 : 32)),
                },
              ],
              Plugs: [conn.current_type === "DC" ? "CCS Combo 2 Plug (Type 2)" : "Type 2 Outlet"],
              IsOpen24Hours: true,
              IsSubscribed: true,
            });
          }
        }
      }

      const payload = {
        OperatorID: operatorId,
        OperatorName: "OCPP-CPMS Network",
        EVSEData: {
          EVSEDataRecord: evseDataRecords,
        },
      };

      const hubject = await this.getActiveHubjectEndpoint();
      if (!hubject || !hubject.url) {
        logger.info(`[Mock OICP] Station ${stationId} EVSE Data compiled (${evseDataRecords.length} EVSEs). No external Hubject URL configured.`);
        return { success: true, count: evseDataRecords.length };
      }

      const urlCheck = isSafeExternalUrl(hubject.url);
      if (!urlCheck.valid) {
        logger.warn(`SSRF Blocked on Hubject pushEvseData: ${urlCheck.reason}`);
        return { success: false, count: 0, error: urlCheck.reason };
      }

      const targetUrl = `${hubject.url}/api/oicp/evse-data`;
      const response = await axios.post(targetUrl, payload, {
        headers: {
          Authorization: `Bearer ${hubject.token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      logger.info(`Successfully pushed ${evseDataRecords.length} EVSE records to Hubject for station ${stationId}`);
      return { success: true, count: evseDataRecords.length, error: undefined };
    } catch (error: any) {
      logger.error(`Error in HubjectOicpService.pushEvseData: ${error.message}`);
      return { success: false, count: 0, error: error.message };
    }
  }

  /**
   * Broadcast dynamic EVSE status change to Hubject (eRoamingPushEvseStatus)
   */
  public static async pushEvseStatus(
    chargerId: number,
    connectorId: number,
    ocppStatus: string,
    errorCode?: string
  ): Promise<{ success: boolean; status: OicpEvseStatus; error?: string }> {
    try {
      const oicpStatus = this.mapOcppToOicpStatus(ocppStatus);
      const evseId = `NL*CPM*E${chargerId}*${connectorId || 1}`;

      const payload = {
        OperatorID: "NL*CPM",
        EVSEStatuses: {
          EVSEStatusRecord: [
            {
              EvseId: evseId,
              EVSEStatus: oicpStatus,
            },
          ],
        },
      };

      const hubject = await this.getActiveHubjectEndpoint();
      if (!hubject || !hubject.url) {
        logger.debug(`[Mock OICP] Broadcasted EVSE status for ${evseId}: ${oicpStatus}`);
        return { success: true, status: oicpStatus };
      }

      const urlCheck = isSafeExternalUrl(hubject.url);
      if (!urlCheck.valid) {
        return { success: false, status: oicpStatus, error: urlCheck.reason };
      }

      const targetUrl = `${hubject.url}/api/oicp/evse-status`;
      await axios.post(targetUrl, payload, {
        headers: {
          Authorization: `Bearer ${hubject.token}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });

      logger.info(`Broadcasted EVSE status ${oicpStatus} to Hubject for ${evseId}`);
      return { success: true, status: oicpStatus };
    } catch (error: any) {
      logger.warn(`Failed to push EVSE status to Hubject: ${error.message}`);
      return { success: false, status: this.mapOcppToOicpStatus(ocppStatus), error: error.message };
    }
  }

  /**
   * Real-time Driver Authorization against Hubject (eRoamingAuthorizeStart)
   */
  public static async authorizeStart(
    idTag: string,
    evseId?: string
  ): Promise<{ authorized: boolean; authorizationStatus: "Authorized" | "NotAuthorized"; message?: string }> {
    try {
      const payload = {
        OperatorID: "NL*CPM",
        Identification: {
          RFIDMifareFamilyCredentials: {
            UID: idTag,
          },
        },
        EVSEID: evseId || "NL*CPM*E001*1",
      };

      const hubject = await this.getActiveHubjectEndpoint();
      if (!hubject || !hubject.url) {
        logger.info(`[Mock OICP] Authorize request for tag ${idTag}: Authorized`);
        return { authorized: true, authorizationStatus: "Authorized", message: "Mock Hubject Authorized" };
      }

      const urlCheck = isSafeExternalUrl(hubject.url);
      if (!urlCheck.valid) {
        return { authorized: false, authorizationStatus: "NotAuthorized", message: urlCheck.reason };
      }

      const targetUrl = `${hubject.url}/api/oicp/authorize-start`;
      const response = await axios.post(targetUrl, payload, {
        headers: {
          Authorization: `Bearer ${hubject.token}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });

      const isAuth =
        response.data?.AuthorizationStatus === "Authorized" ||
        response.data?.authorization_status === "Authorized" ||
        response.data?.StatusCode?.Code === "000";

      return {
        authorized: isAuth,
        authorizationStatus: isAuth ? "Authorized" : "NotAuthorized",
        message: response.data?.StatusCode?.Description || "Hubject response processed",
      };
    } catch (error: any) {
      logger.error(`Error in Hubject authorizeStart: ${error.message}`);
      return { authorized: false, authorizationStatus: "NotAuthorized", message: error.message };
    }
  }

  /**
   * Submit Charge Detail Record (CDR) to Hubject upon session end (eRoamingChargeDetailRecord)
   */
  public static async sendChargeDetailRecord(
    transactionId: string | number
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
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

      if (!tx) {
        logger.warn(`sendChargeDetailRecord: Transaction ${transactionId} not found`);
        return { success: false, error: "Transaction not found" };
      }

      const startTime = tx.startTime || new Date();
      const endTime = tx.endTime || new Date();
      const energyConsumed = Math.max(0, tx.energyConsumed || 0);

      const oicpCdrPayload = {
        EVSEID: `NL*CPM*E${tx.charger_id}*1`,
        SessionID: String(tx.transactionId),
        Identification: {
          RFIDMifareFamilyCredentials: {
            UID: tx.idTag || "FOREIGN_TAG",
          },
        },
        SessionStart: startTime.toISOString(),
        SessionEnd: endTime.toISOString(),
        ChargingStart: startTime.toISOString(),
        ChargingEnd: endTime.toISOString(),
        ConsumedEnergy: Math.round(energyConsumed * 100) / 100,
        MeterValueStart: tx.initialMeterValue || 0,
        MeterValueEnd: tx.finalMeterValue || energyConsumed,
      };

      const hubject = await this.getActiveHubjectEndpoint();
      if (!hubject || !hubject.url) {
        logger.info(`[Mock OICP] Hubject CDR prepared for session ${tx.transactionId} (${energyConsumed} kWh).`);
        return { success: true, sessionId: String(tx.transactionId) };
      }

      const urlCheck = isSafeExternalUrl(hubject.url);
      if (!urlCheck.valid) {
        return { success: false, error: urlCheck.reason };
      }

      const targetUrl = `${hubject.url}/api/oicp/cdr`;
      await axios.post(targetUrl, oicpCdrPayload, {
        headers: {
          Authorization: `Bearer ${hubject.token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      logger.info(`Successfully submitted OICP CDR for session ${tx.transactionId} to Hubject`);
      return { success: true, sessionId: String(tx.transactionId) };
    } catch (error: any) {
      logger.error(`Error submitting Hubject CDR: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
