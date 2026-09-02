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
 * 1. Single Universal Card mode: rules.mapAllCardsTo = "TARGET_TAG" (maps all incoming cards to 1 single target card)
 * 2. Object format: rules.cardIdMapping = { "SOLAR_TAG": "REAL_TAG" } or rules.solarCardIdMapping = { ... }
 * 3. Array format: rules.cardMappings = [{ from: "SOLAR_TAG", to: "REAL_TAG" }]
 * 4. Case-insensitive lookup fallback
 * 5. Fallback / Wildcard mapping: rules.cardIdMapping["*"] / ["ALL"] or rules.defaultForwardCardId / rules.singleCardId
 */
export function resolveMappedCardId(originalCardId: string, rules?: any): string {
  if (!originalCardId || !rules) {
    return originalCardId;
  }

  // 1. Check explicit "map all incoming cards to 1 single card" property
  const universalCardId =
    rules.mapAllCardsTo ||
    rules.singleCardId ||
    rules.mapAllTo ||
    rules.allCardsMappedTo ||
    rules.defaultForwardCardId;

  if (typeof universalCardId === "string" && universalCardId.trim()) {
    logger.debug(`[Quirk] Mapped all incoming cards (${originalCardId}) to single card ID: ${universalCardId.trim()}`);
    return universalCardId.trim();
  }

  const rawMappings = rules.cardIdMapping || rules.solarCardIdMapping || rules.cardMappings || rules.idTagMapping;
  if (!rawMappings) {
    return originalCardId;
  }

  // 2. Array of mappings: [{ from: "A", to: "B" }]
  if (Array.isArray(rawMappings)) {
    // Specific match
    const match = rawMappings.find(
      (m: any) => m && (m.from === originalCardId || (typeof m.from === "string" && m.from.toUpperCase() === originalCardId.toUpperCase()))
    );
    if (match && match.to) {
      logger.debug(`[Quirk] Resolved card ID from ${originalCardId} to ${match.to}`);
      return match.to;
    }

    // Wildcard match in array: from: "*" or "ALL" or "ANY"
    const wildcardMatch = rawMappings.find(
      (m: any) => m && typeof m.from === "string" && (m.from === "*" || m.from.toUpperCase() === "ALL" || m.from.toUpperCase() === "ANY")
    );
    if (wildcardMatch && wildcardMatch.to) {
      logger.debug(`[Quirk] Resolved card ID via array wildcard from ${originalCardId} to ${wildcardMatch.to}`);
      return wildcardMatch.to;
    }
  }

  // 3. Object of key-value pairs: { "A": "B" }
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
    // Wildcard match ("*", "ALL", "ANY")
    const wildcardVal =
      rawMappings["*"] ||
      rawMappings["ALL"] ||
      rawMappings["all"] ||
      rawMappings["ANY"] ||
      rawMappings["any"];

    if (wildcardVal && typeof wildcardVal === "string") {
      logger.debug(`[Quirk] Resolved card ID via wildcard from ${originalCardId} to ${wildcardVal}`);
      return wildcardVal;
    }
  }

  return originalCardId;
}

