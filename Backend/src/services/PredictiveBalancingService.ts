import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import { setChargingProfile } from "../ocpp/remoteControl.js";
import { EpexSpotService } from "./EpexSpotService.js";

import { Prisma } from "@prisma/client";

type PredictiveCharger = Prisma.ChargerGetPayload<{
  include: {
    chargingStation: true,
    owner: true
  }
}>;

export class PredictiveBalancingService {
  /**
   * Fetches the shortwave radiation forecast for a location via Open-Meteo
   */
  private static async fetchSolarForecast(latitude: number, longitude: number): Promise<{ time: string[]; radiation: number[] } | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=shortwave_radiation`;
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && response.data.hourly) {
        return {
          time: response.data.hourly.time,
          radiation: response.data.hourly.shortwave_radiation
        };
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching solar forecast from Open-Meteo: ${error}`);
      return null;
    }
  }

  /**
   * Calculates the optimal charging plan for a given charger
   */
  public static async generateScheduleForCharger(chargerOrId: number | PredictiveCharger) {
    try {
      let charger: PredictiveCharger | null = null;
      let chargerId: number;

      if (typeof chargerOrId === 'number') {
        chargerId = chargerOrId;
        charger = await prisma.charger.findUnique({
          where: { charger_id: chargerId },
          include: {
            chargingStation: true,
            owner: true
          }
        });
      } else {
        charger = chargerOrId;
        chargerId = charger.charger_id;
      }

      if (!charger || !charger.isPredictiveBalancingEnabled) return;
      if (!charger.chargingStation?.latitude || !charger.chargingStation?.longitude || !charger.localSolarKwp) {
        logger.warn(`Charger ${chargerId} has predictive balancing enabled but missing location/solar data on its station.`);
        return;
      }

      const forecast = await this.fetchSolarForecast(charger.chargingStation.latitude, charger.chargingStation.longitude);
      if (!forecast) {
        logger.warn(`Could not get solar forecast for charger ${chargerId}`);
        return;
      }

      // Generate a 24-hour plan starting from the next hour
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);

      const plansToCreate = [];
      const chargingSchedule: any = {
        duration: 86400,
        startSchedule: now.toISOString(),
        chargingRateUnit: "A",
        chargingSchedulePeriod: []
      };

      let startPeriodSeconds = 0;

      for (let i = 0; i < 24; i++) {
        const targetTime = new Date(now.getTime() + i * 3600000);

        // Match targetTime with Open-Meteo forecast (format: 2023-10-25T14:00)
        const targetIsoStr = targetTime.toISOString().substring(0, 16);
        const forecastIndex = forecast.time.findIndex(t => t.startsWith(targetIsoStr));
        const radiation = forecastIndex !== -1 ? forecast.radiation[forecastIndex] : 0; // W/m2

        // Solar estimation: SolarKwp * (radiation / 1000)
        const solarKw = charger.localSolarKwp * (radiation / 1000);

        // Get EPEX price for the hour (using Netherlands as default if country unknown)
        const epexPrice = await EpexSpotService.getPriceForTimestamp("NL", targetTime) || 0;

        // Max Amps for charger is based on power_capacity (kW) * 1000 / 230 (Volts) -> approx A
        const maxAmps = Math.min(32, (charger.power_capacity * 1000) / 230); // Cap at 32A per phase
        const minAmps = 6;

        let predictedAmps = minAmps;
        let numberPhases: 1 | 3 = 3;

        // Calculate total available renewable/local power
        const totalAvailableLocalKw = solarKw;

        if (epexPrice < 50) {
          predictedAmps = maxAmps;
          numberPhases = 3;
        } else if (totalAvailableLocalKw >= 4.14) {
          // 3-Phase Solar Surplus Charging (>= 4.14 kW)
          const localAmps = Math.floor((totalAvailableLocalKw * 1000) / (3 * 230));
          predictedAmps = Math.min(maxAmps, Math.max(minAmps, localAmps));
          numberPhases = 3;
        } else if (totalAvailableLocalKw >= 1.38) {
          // 1-Phase Dynamic Commutation Solar Surplus Charging (1.38 kW - 4.14 kW)
          const localAmps = Math.floor((totalAvailableLocalKw * 1000) / 230);
          predictedAmps = Math.min(32, Math.max(minAmps, localAmps));
          numberPhases = 1;
        } else if (epexPrice > 150) {
          predictedAmps = 0;
        }

        plansToCreate.push({
          chargerId,
          timestamp: targetTime,
          predictedAmps,
          solarForecast: solarKw,
          epexPrice
        });

        chargingSchedule.chargingSchedulePeriod.push({
          startPeriod: startPeriodSeconds,
          limit: parseFloat(predictedAmps.toFixed(1)),
          numberPhases: numberPhases
        });

        startPeriodSeconds += 3600; // 1 hour
      }

      // 1. Delete old future plans
      await prisma.chargingSchedulePlan.deleteMany({
        where: {
          chargerId,
          timestamp: { gte: now }
        }
      });

      // 2. Insert new plans
      await prisma.chargingSchedulePlan.createMany({
        data: plansToCreate
      });

      // 3. Send OCPP SetChargingProfile (Assuming Connector 1 for now)
      // Profile ID 200 is used for predictive balancing
      await setChargingProfile({
        chargerId,
        connectorId: 1, // Usually 0 applies to all, but 1 is safe for single connector
        csChargingProfiles: {
          chargingProfileId: 200,
          stackLevel: 2,
          chargingProfilePurpose: "TxDefaultProfile",
          chargingProfileKind: "Absolute",
          validFrom: now.toISOString(),
          chargingSchedule: chargingSchedule
        }
      });

      logger.info(`Successfully generated and dispatched predictive schedule for charger ${chargerId}`);

    } catch (error) {
      const id = typeof chargerOrId === 'number' ? chargerOrId : chargerOrId?.charger_id;
      logger.error(`Error generating predictive schedule for charger ${id}: ${error}`);
    }
  }

  public static async generateSchedulesForAll() {
    const chargers = await prisma.charger.findMany({
      where: { isPredictiveBalancingEnabled: true, status: { not: 'offline' } },
      include: {
        chargingStation: true,
        owner: true
      }
    });

    logger.info(`Found ${chargers.length} chargers with predictive balancing enabled. Generating schedules...`);
    for (const charger of chargers) {
      await this.generateScheduleForCharger(charger);
    }
  }
}
