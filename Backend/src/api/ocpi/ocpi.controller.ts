import { Request, Response } from "express";
import axios from "axios";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { isSafeExternalUrl } from "../oicp/oicp.controller.js";

// Standard OCPI 2.2.1 Response Envelope Helper
function buildOcpiResponse(data: any, statusCode: number = 1000, message: string = "Success") {
  return {
    data,
    status_code: statusCode,
    status_message: message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * OCPI 2.2.1 GET Locations (CPO interface)
 */
export const getOcpiLocations = async (req: Request, res: Response) => {
  try {
    const stations = await prisma.chargingStation.findMany({
      where: { status: "active" },
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

    const ocpiLocations = stations.map((station) => ({
      id: String(station.id),
      type: "ON_STREET",
      name: station.station_name,
      address: station.street_name,
      city: station.city,
      postal_code: station.postal_code,
      country: station.country || "NLD",
      coordinates: {
        latitude: String(station.latitude),
        longitude: String(station.longitude),
      },
      evses: station.chargers.flatMap((charger) =>
        charger.evses.map((evse) => ({
          uid: String(evse.evse_id),
          evse_id: `${station.country || "NL"}-CPO-E${evse.evse_id}`,
          status: (evse.connectors[0]?.status || "AVAILABLE").toUpperCase(),
          connectors: evse.connectors.map((c) => ({
            id: String(c.connector_id),
            standard: c.current_type === "DC" ? "IEC_62196_T2_COMBO" : "IEC_62196_T2",
            format: c.format || "SOCKET",
            power_type: c.current_type === "DC" ? "DC" : "AC_3_PHASE",
            max_voltage: Math.round(c.max_voltage || 400),
            max_amperage: Math.round(c.max_current || 32),
            max_electric_power: Math.round((c.max_power || 22) * 1000),
          })),
        }))
      ),
      last_updated: station.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiLocations));
  } catch (error) {
    logger.error("Error fetching OCPI locations:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch locations"));
  }
};

/**
 * OCPI 2.2.1 GET Tariffs (CPO interface)
 */
export const getOcpiTariffs = async (req: Request, res: Response) => {
  try {
    const tariffs = await prisma.tariff.findMany();

    const ocpiTariffs = tariffs.map((tariff) => ({
      id: String(tariff.tariff_id),
      currency: "EUR",
      elements: [
        {
          price_components: [
            {
              type: "ENERGY",
              price: tariff.electricity_rate,
              vat: 21.0,
              step_size: 1,
            },
          ],
        },
      ],
      last_updated: tariff.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiTariffs));
  } catch (error) {
    logger.error("Error fetching OCPI tariffs:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch tariffs"));
  }
};

/**
 * OCPI 2.2.1 GET Sessions (CPO interface)
 */
export const getOcpiSessions = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.roamingSession.findMany({
      include: {
        station: true,
        partner: true,
      },
    });

    const ocpiSessions = sessions.map((s) => ({
      id: String(s.id),
      start_date_time: s.startTime.toISOString(),
      end_date_time: s.endTime ? s.endTime.toISOString() : null,
      kwh: s.energyConsumed,
      auth_id: s.transactionId,
      location_id: String(s.stationId),
      currency: "EUR",
      total_cost: s.wholesaleCost,
      status: s.status.toUpperCase(),
      last_updated: s.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiSessions));
  } catch (error) {
    logger.error("Error fetching OCPI sessions:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch sessions"));
  }
};

/**
 * OCPI 2.2.1 GET CDRs (CPO interface)
 */
export const getOcpiCdrs = async (req: Request, res: Response) => {
  try {
    const cdrs = await prisma.cDR.findMany({
      include: {
        station: true,
        partner: true,
      },
    });

    const ocpiCdrs = cdrs.map((cdr) => ({
      id: cdr.cdrId,
      start_date_time: cdr.startTime.toISOString(),
      end_date_time: cdr.endTime.toISOString(),
      cdr_token: {
        uid: cdr.transactionId,
        type: "RFID",
        contract_id: `CTR-${cdr.partnerId}`,
      },
      auth_method: "AUTH_REQUEST",
      location_id: String(cdr.stationId),
      total_energy: cdr.totalEnergy,
      total_time: cdr.totalTime,
      total_cost: cdr.totalCost,
      currency: cdr.currency,
      last_updated: cdr.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiCdrs));
  } catch (error) {
    logger.error("Error fetching OCPI CDRs:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch CDRs"));
  }
};

/**
 * Retrieve all OCPI endpoints
 */
export const getOcpiEndpoints = async (req: Request, res: Response) => {
  try {
    const endpoints = await prisma.ocpiEndpoint.findMany();
    return res.json({ success: true, data: endpoints });
  } catch (error: any) {
    logger.error(`Failed to fetch OCPI endpoints: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch OCPI endpoints." });
  }
};

/**
 * Create a new OCPI endpoint
 */
export const createOcpiEndpoint = async (req: Request, res: Response) => {
  try {
    const { name, url, token, version, status } = req.body;

    if (!name || !url || !token) {
      return res.status(400).json({
        success: false,
        message: "name, url, and token are required fields.",
      });
    }

    const urlCheck = isSafeExternalUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid endpoint URL: ${urlCheck.reason}`,
      });
    }

    const endpoint = await prisma.ocpiEndpoint.create({
      data: {
        name,
        url: url.trim(),
        token,
        version: version || "2.2.1",
        status: status || "active",
      },
    });

    logger.info(`Created OCPI endpoint ${endpoint.name} (${endpoint.id})`);
    return res.status(201).json({ success: true, data: endpoint });
  } catch (error: any) {
    logger.error(`Failed to create OCPI endpoint: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to create OCPI endpoint." });
  }
};

/**
 * Update an OCPI endpoint
 */
export const updateOcpiEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    if (req.body.url) {
      const urlCheck = isSafeExternalUrl(req.body.url);
      if (!urlCheck.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid endpoint URL: ${urlCheck.reason}`,
        });
      }
      req.body.url = req.body.url.trim();
    }

    const endpoint = await prisma.ocpiEndpoint.update({
      where: { id },
      data: req.body,
    });

    return res.json({ success: true, data: endpoint });
  } catch (error: any) {
    logger.error(`Failed to update OCPI endpoint: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to update OCPI endpoint." });
  }
};

/**
 * Delete an OCPI endpoint
 */
export const deleteOcpiEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    await prisma.ocpiEndpoint.delete({
      where: { id },
    });

    return res.json({ success: true, message: "OCPI endpoint deleted." });
  } catch (error: any) {
    logger.error(`Failed to delete OCPI endpoint: ${error.message}`);
    return res.status(500).json({ success: false, message: "Failed to delete OCPI endpoint." });
  }
};

/**
 * Test an OCPI endpoint connection safely
 */
export const testOcpiEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    const endpoint = await prisma.ocpiEndpoint.findUnique({
      where: { id },
    });

    if (!endpoint) {
      return res.status(404).json({ success: false, message: "OCPI endpoint not found." });
    }

    const urlCheck = isSafeExternalUrl(endpoint.url);
    if (!urlCheck.valid) {
      logger.warn(`SSRF Blocked on OCPI testEndpoint for endpoint ${id} (${endpoint.url}): ${urlCheck.reason}`);
      return res.status(400).json({
        success: false,
        message: `Connection aborted: ${urlCheck.reason}`,
      });
    }

    const response = await axios.get(endpoint.url, {
      headers: {
        Authorization: `Token ${endpoint.token}`,
      },
      timeout: 5000,
      maxContentLength: 1024 * 1024, // 1MB
      maxBodyLength: 1024 * 1024,
      maxRedirects: 3,
    });

    return res.json({ success: true, message: "Connection successful.", data: response.data });
  } catch (error: any) {
    logger.error(`OCPI Test Endpoint Connection failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Connection failed.",
      error: error.message || "Unknown error occurred",
    });
  }
};
