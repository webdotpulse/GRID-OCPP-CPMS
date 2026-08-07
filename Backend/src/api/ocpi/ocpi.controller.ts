import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

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
          status: evse.status.toUpperCase(),
          connectors: evse.connectors.map((c) => ({
            id: String(c.connector_id),
            standard: c.connector_type.toUpperCase(),
            format: "SOCKET",
            power_type: c.max_power_kw > 22 ? "DC" : "AC_3_PHASE",
            max_voltage: 400,
            max_amperage: 32,
            max_electric_power: Math.round(c.max_power_kw * 1000),
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
