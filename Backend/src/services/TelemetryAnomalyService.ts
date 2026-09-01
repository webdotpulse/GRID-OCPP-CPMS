import { prisma } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { setChargingProfile, clearChargingProfile } from "../ocpp/remoteControl.js";
import { getIO } from "../ocpp/realtime.socket.js";
import { MeterValueJobData } from "../queues/queueManager.js";

export interface AnomalyEvaluationResult {
  isAnomaly: boolean;
  anomalyType?: "CONTACT_RESISTANCE_SPIKE" | "PHASE_IMBALANCE" | "CABLE_WEAR_HARMONICS" | "COOLING_DEGRADATION" | "VOLTAGE_SAG_ANOMALY";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  anomalyScore: number; // 0.0 to 1.0
  confidence: number;   // 0.0 to 1.0
  rootCause: string;
  affectedPhase?: "L1" | "L2" | "L3" | "ALL";
  metrics: {
    contactResistanceL1_mOhm?: number;
    contactResistanceL2_mOhm?: number;
    contactResistanceL3_mOhm?: number;
    maxAsymmetricVoltageDrop_V?: number;
    phaseCurrentImbalancePct?: number;
    currentThdPct?: number;
    currentRippleStdDev?: number;
    thermalSlopeDegPerMin?: number;
    estimatedRulDays?: number;
  };
  suggestedDerateAmps?: number;
}

export interface ComponentHealthSummary {
  componentType: "CONNECTOR_PIN_L1" | "CONNECTOR_PIN_L2" | "CONNECTOR_PIN_L3" | "CABLE_ASSEMBLY" | "COOLING_LOOP" | "POWER_ELECTRONICS";
  healthScore: number;
  contactResistanceMilliOhms?: number;
  voltageDropVolts?: number;
  thdCurrentPct?: number;
  thermalSlopeDegPerMin?: number;
  rulDays: number;
  status: "HEALTHY" | "DEGRADING" | "AT_RISK" | "CRITICAL";
}

export class TelemetryAnomalyService {
  private static readonly WINDOW_SIZE = 60; // Keep last 60 telemetry frames (~1-5 mins)
  private static readonly WINDOW_TTL_SECONDS = 600; // 10 minutes cache TTL

  /**
   * Main entrypoint called by meterValuesWorker on every telemetry reading
   */
  public static async analyzeTelemetry(sample: MeterValueJobData): Promise<AnomalyEvaluationResult | null> {
    if (!sample || !sample.chargerId) return null;

    const connectorId = sample.connectorId ?? 1;
    const windowKey = `telemetry:window:${sample.chargerId}:${connectorId}`;

    try {
      // 1. Append sample to Redis sliding ring buffer
      const sampleJson = JSON.stringify({
        ...sample,
        timestamp: typeof sample.timestamp === "string" ? sample.timestamp : sample.timestamp.toISOString(),
      });

      await redisClient.rpush(windowKey, sampleJson);
      await redisClient.ltrim(windowKey, -this.WINDOW_SIZE, -1);
      await redisClient.expire(windowKey, this.WINDOW_TTL_SECONDS);

      // 2. Fetch current window for analysis
      const rawWindow = await redisClient.lrange(windowKey, 0, -1);
      if (!rawWindow || rawWindow.length < 5) {
        // Need at least 5 frames to compute slopes & standard deviations
        return null;
      }

      const window: MeterValueJobData[] = rawWindow.map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }).filter(Boolean) as MeterValueJobData[];

      // 3. Extract physical metrics & run anomaly evaluation
      const evaluation = this.evaluatePhysicalMetrics(window, sample);

      // 4. If an anomaly is detected, trigger storage and protective actions
      if (evaluation.isAnomaly && evaluation.anomalyScore >= 0.70) {
        await this.handleDetectedAnomaly(sample, evaluation, window);
      }

      // 5. Periodically update component health scores
      if (window.length % 10 === 0 || evaluation.isAnomaly) {
        await this.updateComponentHealthScores(sample.chargerId, connectorId, evaluation, window);
      }

      return evaluation;
    } catch (error) {
      logger.error(`[TelemetryAnomalyService] Error analyzing telemetry for charger ${sample.chargerId}: ${error}`);
      return null;
    }
  }

  /**
   * Extracts electrical & thermal features and scores anomalies against physical limits
   */
  public static evaluatePhysicalMetrics(
    window: MeterValueJobData[],
    current: MeterValueJobData
  ): AnomalyEvaluationResult {
    const defaultResult: AnomalyEvaluationResult = {
      isAnomaly: false,
      severity: "LOW",
      anomalyScore: 0.05,
      confidence: 0.92,
      rootCause: "Nominal electrical parameters within standard operational envelope.",
      metrics: {},
    };

    const latest = current;
    const iL1 = latest.current_L1 ?? latest.currentValue ?? 0;
    const iL2 = latest.current_L2 ?? 0;
    const iL3 = latest.current_L3 ?? 0;
    const vL1 = latest.voltage_L1 ?? latest.voltageValue ?? 230;
    const vL2 = latest.voltage_L2 ?? (iL2 > 0 ? 230 : null);
    const vL3 = latest.voltage_L3 ?? (iL3 > 0 ? 230 : null);

    const isThreePhase = iL1 > 2 && iL2 > 2 && iL3 > 2 && vL2 !== null && vL3 !== null;
    const activeCurrent = Math.max(iL1, iL2, iL3, latest.currentValue || 0);

    // Skip idle/unloaded evaluations (< 4A)
    if (activeCurrent < 4) {
      return defaultResult;
    }

    // --- FEATURE 1: Asymmetric Phase Voltage Drop & Contact Resistance ---
    let maxAsymDrop = 0;
    let worstPhase: "L1" | "L2" | "L3" | undefined = undefined;
    let rContactL1 = 0;
    let rContactL2 = 0;
    let rContactL3 = 0;

    if (isThreePhase && vL2 !== null && vL3 !== null) {
      const vAvg = (vL1 + vL2 + vL3) / 3;
      const dropL1 = Math.abs(vAvg - vL1);
      const dropL2 = Math.abs(vAvg - vL2);
      const dropL3 = Math.abs(vAvg - vL3);
      maxAsymDrop = Math.max(dropL1, dropL2, dropL3);

      if (iL1 > 0) rContactL1 = (dropL1 / iL1) * 1000; // mΩ
      if (iL2 > 0) rContactL2 = (dropL2 / iL2) * 1000; // mΩ
      if (iL3 > 0) rContactL3 = (dropL3 / iL3) * 1000; // mΩ

      if (dropL1 >= dropL2 && dropL1 >= dropL3) worstPhase = "L1";
      else if (dropL2 >= dropL1 && dropL2 >= dropL3) worstPhase = "L2";
      else worstPhase = "L3";
    }

    // --- FEATURE 2: Phase Current Imbalance ---
    let phaseImbalancePct = 0;
    if (isThreePhase) {
      const iAvg = (iL1 + iL2 + iL3) / 3;
      const iMaxDiff = Math.max(Math.abs(iL1 - iAvg), Math.abs(iL2 - iAvg), Math.abs(iL3 - iAvg));
      phaseImbalancePct = iAvg > 0 ? (iMaxDiff / iAvg) * 100 : 0;
    }

    // --- FEATURE 3: Current Harmonic Noise & Micro-Ripple ---
    const recentCurrents = window.map((w) => w.currentValue || w.current_L1 || 0).filter((c) => c > 2);
    let currentRippleStdDev = 0;
    if (recentCurrents.length >= 5) {
      const mean = recentCurrents.reduce((a, b) => a + b, 0) / recentCurrents.length;
      const variance = recentCurrents.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentCurrents.length;
      currentRippleStdDev = Math.sqrt(variance);
    }
    const currentThdPct = latest.thd_current || (activeCurrent > 10 ? (currentRippleStdDev / activeCurrent) * 100 : 0);

    // --- FEATURE 4: Thermal Rate-of-Rise (dT/dt) ---
    const validTemps = window
      .filter((w) => w.temperatureValue !== null && w.temperatureValue !== undefined)
      .map((w) => ({
        temp: w.temperatureValue as number,
        time: new Date(w.timestamp).getTime(),
      }))
      .sort((a, b) => a.time - b.time);

    let thermalSlopeDegPerMin = 0;
    if (validTemps.length >= 3) {
      const first = validTemps[0];
      const last = validTemps[validTemps.length - 1];
      const deltaMinutes = (last.time - first.time) / (1000 * 60);
      if (deltaMinutes > 0.2) {
        thermalSlopeDegPerMin = (last.temp - first.temp) / deltaMinutes;
      }
    }

    // --- ANOMALY SCORING & CLASSIFICATION ---

    // 1. Contact Resistance Spike / Micro-Drop on Socket Pins
    const maxContactResistance = Math.max(rContactL1, rContactL2, rContactL3);
    if (maxAsymDrop > 4.5 && maxContactResistance > 30 && activeCurrent >= 10) {
      const score = Math.min(1.0, 0.75 + (maxContactResistance - 30) / 40);
      return {
        isAnomaly: true,
        anomalyType: "CONTACT_RESISTANCE_SPIKE",
        severity: maxContactResistance > 60 ? "CRITICAL" : "HIGH",
        anomalyScore: Number(score.toFixed(2)),
        confidence: 0.95,
        rootCause: `Degraded contact resistance on Phase ${worstPhase || "L1"} (${maxContactResistance.toFixed(1)} mΩ). Voltage drop of ${maxAsymDrop.toFixed(1)}V under ${activeCurrent.toFixed(1)}A indicates loose contact spring or socket oxidation.`,
        affectedPhase: worstPhase || "L1",
        metrics: {
          contactResistanceL1_mOhm: Number(rContactL1.toFixed(1)),
          contactResistanceL2_mOhm: Number(rContactL2.toFixed(1)),
          contactResistanceL3_mOhm: Number(rContactL3.toFixed(1)),
          maxAsymmetricVoltageDrop_V: Number(maxAsymDrop.toFixed(1)),
          phaseCurrentImbalancePct: Number(phaseImbalancePct.toFixed(1)),
          thermalSlopeDegPerMin: Number(thermalSlopeDegPerMin.toFixed(2)),
          estimatedRulDays: maxContactResistance > 60 ? 3 : 14,
        },
        suggestedDerateAmps: activeCurrent > 16 ? 16 : 10,
      };
    }

    // 2. Severe Cooling Failure / Thermal Runaway
    const currentTemp = latest.temperatureValue ?? 0;
    if ((thermalSlopeDegPerMin > 2.2 && currentTemp > 65) || currentTemp > 82) {
      const score = Math.min(1.0, 0.80 + (currentTemp > 80 ? 0.18 : thermalSlopeDegPerMin / 10));
      return {
        isAnomaly: true,
        anomalyType: "COOLING_DEGRADATION",
        severity: currentTemp > 80 || thermalSlopeDegPerMin > 3.5 ? "CRITICAL" : "HIGH",
        anomalyScore: Number(score.toFixed(2)),
        confidence: 0.93,
        rootCause: `Rapid thermal rate of rise (${thermalSlopeDegPerMin.toFixed(1)}°C/min) reaching ${currentTemp.toFixed(1)}°C. Indicates cooling fan failure, heat sink thermal pad degradation, or clogged airflow.`,
        affectedPhase: "ALL",
        metrics: {
          thermalSlopeDegPerMin: Number(thermalSlopeDegPerMin.toFixed(2)),
          currentThdPct: Number(currentThdPct.toFixed(1)),
          estimatedRulDays: currentTemp > 80 ? 1 : 7,
        },
        suggestedDerateAmps: 10,
      };
    }

    // 3. Cable Wear & Harmonic Distortion (Micro-arcing / strand fatigue)
    if (currentThdPct > 12 && activeCurrent > 12) {
      const score = Math.min(1.0, 0.70 + (currentThdPct - 12) / 30);
      return {
        isAnomaly: true,
        anomalyType: "CABLE_WEAR_HARMONICS",
        severity: currentThdPct > 20 ? "HIGH" : "MEDIUM",
        anomalyScore: Number(score.toFixed(2)),
        confidence: 0.88,
        rootCause: `High current ripple & harmonic distortion (${currentThdPct.toFixed(1)}% THD) under constant load. Indicates copper core fatigue, micro-arcing at cable bend, or degraded insulation.`,
        affectedPhase: worstPhase || "ALL",
        metrics: {
          currentThdPct: Number(currentThdPct.toFixed(1)),
          currentRippleStdDev: Number(currentRippleStdDev.toFixed(2)),
          phaseCurrentImbalancePct: Number(phaseImbalancePct.toFixed(1)),
          estimatedRulDays: 21,
        },
        suggestedDerateAmps: 16,
      };
    }

    // 4. Severe Phase Current Imbalance
    if (isThreePhase && phaseImbalancePct > 28 && activeCurrent > 10) {
      return {
        isAnomaly: true,
        anomalyType: "PHASE_IMBALANCE",
        severity: "MEDIUM",
        anomalyScore: 0.75,
        confidence: 0.89,
        rootCause: `Severe 3-phase current imbalance (${phaseImbalancePct.toFixed(1)}%). Uneven phase loading may trigger upstream circuit breaker trip or excessive neutral current.`,
        affectedPhase: worstPhase || "L1",
        metrics: {
          phaseCurrentImbalancePct: Number(phaseImbalancePct.toFixed(1)),
          contactResistanceL1_mOhm: Number(rContactL1.toFixed(1)),
          contactResistanceL2_mOhm: Number(rContactL2.toFixed(1)),
          contactResistanceL3_mOhm: Number(rContactL3.toFixed(1)),
          estimatedRulDays: 30,
        },
      };
    }

    // 5. Voltage Sag / Low Line Voltage Anomaly
    if (vL1 < 195 || (vL2 !== null && vL2 < 195) || (vL3 !== null && vL3 < 195)) {
      return {
        isAnomaly: true,
        anomalyType: "VOLTAGE_SAG_ANOMALY",
        severity: "MEDIUM",
        anomalyScore: 0.72,
        confidence: 0.90,
        rootCause: `Sub-nominal phase voltage sag (< 195V) during active session. Local grid transformer overload or severe supply cable resistance drop.`,
        affectedPhase: vL1 < 195 ? "L1" : (vL2 && vL2 < 195 ? "L2" : "L3"),
        metrics: {
          maxAsymmetricVoltageDrop_V: Number(maxAsymDrop.toFixed(1)),
          estimatedRulDays: 45,
        },
      };
    }

    // Default: Healthy state
    return {
      ...defaultResult,
      metrics: {
        contactResistanceL1_mOhm: Number(rContactL1.toFixed(1)),
        contactResistanceL2_mOhm: Number(rContactL2.toFixed(1)),
        contactResistanceL3_mOhm: Number(rContactL3.toFixed(1)),
        maxAsymmetricVoltageDrop_V: Number(maxAsymDrop.toFixed(1)),
        phaseCurrentImbalancePct: Number(phaseImbalancePct.toFixed(1)),
        currentThdPct: Number(currentThdPct.toFixed(1)),
        thermalSlopeDegPerMin: Number(thermalSlopeDegPerMin.toFixed(2)),
        estimatedRulDays: 180,
      },
    };
  }

  /**
   * Persists anomaly event, flags hardware risk, and applies closed-loop safety derating
   */
  private static async handleDetectedAnomaly(
    sample: MeterValueJobData,
    evaluation: AnomalyEvaluationResult,
    window: MeterValueJobData[]
  ): Promise<void> {
    const connectorId = sample.connectorId ?? 1;
    const chargerId = sample.chargerId;

    // Debounce to prevent flooding database if anomaly is continuous (1 per 15 minutes per anomalyType)
    const debounceKey = `anomaly:debounced:${chargerId}:${connectorId}:${evaluation.anomalyType}`;
    const isDebounced = await redisClient.get(debounceKey);
    if (isDebounced) {
      return;
    }
    await redisClient.set(debounceKey, "1", "EX", 900); // 15-minute debounce

    logger.warn(
      `[TelemetryAnomalyService] High-Frequency Anomaly Detected for Charger #${chargerId} Connector #${connectorId}: ${evaluation.anomalyType} (Severity: ${evaluation.severity}, Score: ${evaluation.anomalyScore})`
    );

    let deratingApplied = false;

    // 1. Closed-loop Safety Mitigation: Dynamic SetChargingProfile Derating
    if (evaluation.suggestedDerateAmps && (evaluation.severity === "CRITICAL" || evaluation.severity === "HIGH")) {
      try {
        const derateResult = await setChargingProfile({
          chargerId,
          connectorId,
          csChargingProfiles: {
            chargingProfileId: 9900 + connectorId,
            stackLevel: 9,
            chargingProfilePurpose: "TxDefaultProfile",
            chargingProfileKind: "Relative",
            chargingSchedule: {
              chargingRateUnit: "A",
              chargingSchedulePeriod: [
                {
                  startPeriod: 0,
                  limit: evaluation.suggestedDerateAmps,
                },
              ],
            },
          },
        });

        if (derateResult?.status === "Accepted") {
          deratingApplied = true;
          logger.info(
            `[TelemetryAnomalyService] Applied emergency safety derating of ${evaluation.suggestedDerateAmps}A to charger #${chargerId}`
          );
        }
      } catch (e) {
        logger.error(`[TelemetryAnomalyService] Failed to dispatch safety derating profile: ${e}`);
      }
    }

    // 2. Persist AnomalyEvent in PostgreSQL
    const createdAnomaly = await prisma.anomalyEvent.create({
      data: {
        chargerId,
        connectorId,
        transactionId: sample.transactionId ? String(sample.transactionId) : null,
        anomalyType: evaluation.anomalyType || "CONTACT_RESISTANCE_SPIKE",
        severity: evaluation.severity,
        anomalyScore: evaluation.anomalyScore,
        confidence: evaluation.confidence,
        rootCause: evaluation.rootCause,
        affectedPhase: evaluation.affectedPhase || null,
        metrics: evaluation.metrics as any,
        telemetrySnapshot: window.slice(-15) as any,
        deratingApplied,
        deratedLimitAmps: deratingApplied ? evaluation.suggestedDerateAmps : null,
      },
    });

    // 3. Mark Charger as Hardware At Risk
    await prisma.charger.update({
      where: { charger_id: chargerId },
      data: { isHardwareAtRisk: true },
    });

    // 4. Create DiagnosticEvent for audit trail
    await prisma.diagnosticEvent.create({
      data: {
        chargerId,
        connectorId,
        type: `Anomaly_${evaluation.anomalyType}`,
        description: evaluation.rootCause,
        timestamp: new Date(),
      },
    });

    // 5. Broadcast real-time Socket.IO alert to Frontend Dashboard
    try {
      const socketServer = getIO();
      if (socketServer) {
        socketServer.emit("hardware_anomaly", {
          anomalyId: createdAnomaly.id,
          chargerId,
          connectorId,
          anomalyType: evaluation.anomalyType,
          severity: evaluation.severity,
          anomalyScore: evaluation.anomalyScore,
          rootCause: evaluation.rootCause,
          affectedPhase: evaluation.affectedPhase,
          deratingApplied,
          deratedLimitAmps: evaluation.suggestedDerateAmps,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      logger.debug(`[TelemetryAnomalyService] Socket.io broadcast skipped: ${e}`);
    }
  }

  /**
   * Updates component health records and RUL projections
   */
  public static async updateComponentHealthScores(
    chargerId: number,
    connectorId: number,
    evaluation: AnomalyEvaluationResult,
    window: MeterValueJobData[]
  ): Promise<void> {
    try {
      const metrics = evaluation.metrics;
      const contactR1 = metrics.contactResistanceL1_mOhm ?? 5;
      const contactR2 = metrics.contactResistanceL2_mOhm ?? 5;
      const contactR3 = metrics.contactResistanceL3_mOhm ?? 5;
      const thd = metrics.currentThdPct ?? 2;
      const thermalSlope = metrics.thermalSlopeDegPerMin ?? 0.2;

      const components: ComponentHealthSummary[] = [
        {
          componentType: "CONNECTOR_PIN_L1",
          healthScore: Math.max(0, Math.min(100, 100 - (contactR1 > 10 ? (contactR1 - 10) * 1.8 : 0))),
          contactResistanceMilliOhms: contactR1,
          voltageDropVolts: metrics.maxAsymmetricVoltageDrop_V,
          rulDays: contactR1 > 40 ? 7 : (contactR1 > 20 ? 30 : 180),
          status: contactR1 > 45 ? "CRITICAL" : (contactR1 > 25 ? "AT_RISK" : (contactR1 > 15 ? "DEGRADING" : "HEALTHY")),
        },
        {
          componentType: "CONNECTOR_PIN_L2",
          healthScore: Math.max(0, Math.min(100, 100 - (contactR2 > 10 ? (contactR2 - 10) * 1.8 : 0))),
          contactResistanceMilliOhms: contactR2,
          voltageDropVolts: metrics.maxAsymmetricVoltageDrop_V,
          rulDays: contactR2 > 40 ? 7 : (contactR2 > 20 ? 30 : 180),
          status: contactR2 > 45 ? "CRITICAL" : (contactR2 > 25 ? "AT_RISK" : (contactR2 > 15 ? "DEGRADING" : "HEALTHY")),
        },
        {
          componentType: "CONNECTOR_PIN_L3",
          healthScore: Math.max(0, Math.min(100, 100 - (contactR3 > 10 ? (contactR3 - 10) * 1.8 : 0))),
          contactResistanceMilliOhms: contactR3,
          voltageDropVolts: metrics.maxAsymmetricVoltageDrop_V,
          rulDays: contactR3 > 40 ? 7 : (contactR3 > 20 ? 30 : 180),
          status: contactR3 > 45 ? "CRITICAL" : (contactR3 > 25 ? "AT_RISK" : (contactR3 > 15 ? "DEGRADING" : "HEALTHY")),
        },
        {
          componentType: "CABLE_ASSEMBLY",
          healthScore: Math.max(0, Math.min(100, 100 - (thd > 5 ? (thd - 5) * 4 : 0))),
          thdCurrentPct: thd,
          rulDays: thd > 18 ? 14 : (thd > 10 ? 45 : 240),
          status: thd > 18 ? "CRITICAL" : (thd > 12 ? "AT_RISK" : (thd > 7 ? "DEGRADING" : "HEALTHY")),
        },
        {
          componentType: "COOLING_LOOP",
          healthScore: Math.max(0, Math.min(100, 100 - (thermalSlope > 0.8 ? (thermalSlope - 0.8) * 35 : 0))),
          thermalSlopeDegPerMin: thermalSlope,
          rulDays: thermalSlope > 2.5 ? 3 : (thermalSlope > 1.5 ? 21 : 365),
          status: thermalSlope > 2.5 ? "CRITICAL" : (thermalSlope > 1.6 ? "AT_RISK" : (thermalSlope > 1.0 ? "DEGRADING" : "HEALTHY")),
        },
      ];

      for (const comp of components) {
        await prisma.componentHealthScore.upsert({
          where: {
            chargerId_connectorId_componentType: {
              chargerId,
              connectorId,
              componentType: comp.componentType,
            },
          },
          create: {
            chargerId,
            connectorId,
            componentType: comp.componentType,
            healthScore: Number(comp.healthScore.toFixed(1)),
            contactResistanceMilliOhms: comp.contactResistanceMilliOhms,
            voltageDropVolts: comp.voltageDropVolts,
            thdCurrentPct: comp.thdCurrentPct,
            thermalSlopeDegPerMin: comp.thermalSlopeDegPerMin,
            rulDays: comp.rulDays,
            status: comp.status,
            lastEvaluatedAt: new Date(),
          },
          update: {
            healthScore: Number(comp.healthScore.toFixed(1)),
            contactResistanceMilliOhms: comp.contactResistanceMilliOhms,
            voltageDropVolts: comp.voltageDropVolts,
            thdCurrentPct: comp.thdCurrentPct,
            thermalSlopeDegPerMin: comp.thermalSlopeDegPerMin,
            rulDays: comp.rulDays,
            status: comp.status,
            lastEvaluatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      logger.error(`[TelemetryAnomalyService] Error updating component health scores: ${error}`);
    }
  }

  /**
   * Clears protective derating profile and restores operative limits
   */
  public static async clearSafetyDerating(chargerId: number, connectorId: number = 1): Promise<boolean> {
    try {
      await clearChargingProfile({
        chargerId,
        id: 9900 + connectorId,
        connectorId,
      });
      logger.info(`[TelemetryAnomalyService] Cleared emergency derating profile on charger #${chargerId}`);
      return true;
    } catch (e) {
      logger.error(`[TelemetryAnomalyService] Error clearing safety derating: ${e}`);
      return false;
    }
  }

  /**
   * Retrieves active high-frequency telemetry window from Redis
   */
  public static async getTelemetryStreamWindow(chargerId: number, connectorId: number = 1): Promise<MeterValueJobData[]> {
    const windowKey = `telemetry:window:${chargerId}:${connectorId}`;
    const raw = await redisClient.lrange(windowKey, 0, -1);
    if (!raw || raw.length === 0) return [];
    return raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean) as MeterValueJobData[];
  }
}
