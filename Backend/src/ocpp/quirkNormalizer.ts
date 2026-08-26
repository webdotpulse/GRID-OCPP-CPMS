import { prisma } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { MeterValuePayload } from "../services/MeterValueService.js";

export async function normalizeMeterValues(
  chargerId: number,
  payload: MeterValuePayload,
  rules?: any
): Promise<MeterValuePayload> {
  try {
    if (!rules) {
      return payload;
    }

    let { energyValue, powerValue, voltageValue, currentValue, timestamp, transactionId } = payload;

    // Apply calculatePowerFromVoltageAndCurrent
    if (rules.calculatePowerFromVoltageAndCurrent && (!powerValue || powerValue === 0)) {
      if (
        payload.voltage_L1 != null && payload.current_L1 != null &&
        payload.voltage_L2 != null && payload.current_L2 != null &&
        payload.voltage_L3 != null && payload.current_L3 != null
      ) {
        // 3-phase calculation
        powerValue = (payload.voltage_L1 * payload.current_L1) +
                     (payload.voltage_L2 * payload.current_L2) +
                     (payload.voltage_L3 * payload.current_L3);
        logger.debug(`[Quirk] Calculated 3-phase power: ${powerValue}W for charger ${chargerId}`);
      } else if (voltageValue != null && currentValue != null) {
        // Single phase fallback
        powerValue = voltageValue * currentValue;
        logger.debug(`[Quirk] Calculated single-phase power: ${powerValue}W for charger ${chargerId}`);
      }
    }

    // Apply energyMultiplier
    if (rules.energyMultiplier && energyValue) {
      energyValue = energyValue * rules.energyMultiplier;
    }

    // Apply estimateEnergyFromPower
    if (rules.estimateEnergyFromPower) {
      const redisKeyLastTime = `quirk:last_time:${transactionId}`;
      const redisKeyTotalEnergy = `quirk:total_energy:${transactionId}`;

      const lastTimeStr = await redisClient.get(redisKeyLastTime);
      const totalEnergyStr = await redisClient.get(redisKeyTotalEnergy);

      let totalEnergy = totalEnergyStr ? parseFloat(totalEnergyStr) : (energyValue || 0);

      if (lastTimeStr) {
        const lastTime = new Date(lastTimeStr);
        const currentTime = new Date(timestamp);
        const elapsedHours = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

        if (elapsedHours > 0 && powerValue) {
          // Estimate energy consumed in this interval (powerValue is usually in Watts, energy in Wh)
          // If powerValue is W, elapsedHours * powerValue gives Wh.
          const energyIncrement = powerValue * elapsedHours;
          totalEnergy += energyIncrement;
          energyValue = totalEnergy;
          logger.debug(`[Quirk] Estimated energy increment: ${energyIncrement}Wh, total: ${totalEnergy}Wh for charger ${chargerId}`);
        }
      } else {
        // First reading
        if (!totalEnergy) totalEnergy = energyValue || 0;
      }

      await redisClient.set(redisKeyLastTime, new Date(timestamp).toISOString());
      await redisClient.set(redisKeyTotalEnergy, totalEnergy.toString());

      // Expire keys after 24 hours of inactivity
      await redisClient.expire(redisKeyLastTime, 86400);
      await redisClient.expire(redisKeyTotalEnergy, 86400);
    }

    return {
      ...payload,
      energyValue,
      powerValue,
    };
  } catch (error) {
    logger.error(`Error in normalizeMeterValues for charger ${chargerId}: ${error}`);
    return payload; // Return original payload on error
  }
}

/**
 * Resolves a mapped card ID / idTag based on quirk profile rules.
 * Supports:
 * 1. Object format: rules.cardIdMapping = { "SOLAR_TAG": "REAL_TAG" } or rules.solarCardIdMapping = { ... }
 * 2. Array format: rules.cardMappings = [{ from: "SOLAR_TAG", to: "REAL_TAG" }]
 * 3. Case-insensitive lookup fallback
 * 4. Fallback / Wildcard mapping: rules.cardIdMapping["*"] or rules.defaultForwardCardId
 */
export function resolveMappedCardId(originalCardId: string, rules?: any): string {
  if (!originalCardId || !rules) {
    return originalCardId;
  }

  const rawMappings = rules.cardIdMapping || rules.solarCardIdMapping || rules.cardMappings || rules.idTagMapping;
  if (!rawMappings) {
    return originalCardId;
  }

  // 1. Array of mappings: [{ from: "A", to: "B" }]
  if (Array.isArray(rawMappings)) {
    const match = rawMappings.find(
      (m: any) => m && (m.from === originalCardId || (typeof m.from === "string" && m.from.toUpperCase() === originalCardId.toUpperCase()))
    );
    if (match && match.to) {
      logger.debug(`[Quirk] Resolved card ID from ${originalCardId} to ${match.to}`);
      return match.to;
    }
  }

  // 2. Object of key-value pairs: { "A": "B" }
  if (typeof rawMappings === "object" && !Array.isArray(rawMappings)) {
    // Exact match
    if (rawMappings[originalCardId]) {
      logger.debug(`[Quirk] Resolved card ID from ${originalCardId} to ${rawMappings[originalCardId]}`);
      return rawMappings[originalCardId];
    }
    // Case-insensitive match
    const upperOriginal = originalCardId.toUpperCase();
    for (const key of Object.keys(rawMappings)) {
      if (key.toUpperCase() === upperOriginal && rawMappings[key]) {
        logger.debug(`[Quirk] Resolved card ID (case-insensitive) from ${originalCardId} to ${rawMappings[key]}`);
        return rawMappings[key];
      }
    }
    // Wildcard match
    if (rawMappings["*"]) {
      logger.debug(`[Quirk] Resolved card ID via wildcard from ${originalCardId} to ${rawMappings["*"]}`);
      return rawMappings["*"];
    }
  }

  // 3. Fallback defaultForwardCardId if specified
  if (rules.defaultForwardCardId) {
    logger.debug(`[Quirk] Resolved card ID via defaultForwardCardId from ${originalCardId} to ${rules.defaultForwardCardId}`);
    return rules.defaultForwardCardId;
  }

  return originalCardId;
}

