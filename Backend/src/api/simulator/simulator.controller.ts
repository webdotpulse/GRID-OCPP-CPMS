import { Request, Response } from "express";
import { simulatorService, OcppProtocol, ConnectorStatus } from "../../services/SimulatorService.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

/**
 * Helper to safely extract string param from request
 */
function getParamId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : (raw as string);
}

/**
 * Get all active simulator sessions
 */
export async function getSessions(req: Request, res: Response): Promise<void> {
  try {
    const instances = simulatorService.getInstances().map((inst) => inst.toJSON());
    res.json({
      success: true,
      data: instances,
    });
  } catch (error: any) {
    logger.error(`Error fetching simulator sessions: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get single simulator session details including logs
 */
export async function getSessionById(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const instance = simulatorService.getInstance(id);

    if (!instance) {
      res.status(404).json({ success: false, error: `Simulator session '${id}' not found` });
      return;
    }

    res.json({
      success: true,
      data: {
        ...instance.toJSON(),
        logs: instance.logs,
        offlineBuffer: instance.offlineBuffer,
      },
    });
  } catch (error: any) {
    logger.error(`Error fetching simulator session ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 1-Click Quick Provision a test charger & station in DB
 */
export async function quickProvision(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).userId || 1;
    const { prefix } = req.body || {};

    const provisionResult = await simulatorService.quickProvision(userId, prefix || "SIM-LAB");

    res.status(201).json({
      success: true,
      message: "Test charger, station, and connectors provisioned successfully",
      data: provisionResult,
    });
  } catch (error: any) {
    logger.error(`Error quick provisioning simulator test charger: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Start or connect a simulator instance
 */
export async function startSession(req: Request, res: Response): Promise<void> {
  try {
    const {
      chargerId,
      chargerName,
      protocol = "ocpp1.6",
      endpoint,
      vendor,
      model,
      firmwareVersion,
    } = req.body;

    if (!chargerId && !chargerName) {
      res.status(400).json({ success: false, error: "chargerId or chargerName is required" });
      return;
    }

    // Resolve charger from DB if numeric or name
    let dbCharger = null;
    if (chargerId) {
      dbCharger = await prisma.charger.findUnique({
        where: { charger_id: Number(chargerId) },
        include: { evses: { include: { connectors: true } } },
      });
    } else if (chargerName) {
      dbCharger = await prisma.charger.findUnique({
        where: { name: chargerName },
        include: { evses: { include: { connectors: true } } },
      });
    }

    if (!dbCharger) {
      res.status(404).json({ success: false, error: "Charger not found in database" });
      return;
    }

    const resolvedChargerId = dbCharger.charger_id;
    const resolvedChargerName = dbCharger.name;

    const instance = await simulatorService.startInstance({
      chargerId: resolvedChargerId,
      chargerName: resolvedChargerName,
      protocol: protocol as OcppProtocol,
      endpoint,
      vendor: vendor || dbCharger.manufacturer || "VirtualLab",
      model: model || dbCharger.model || "GridSim-Pro-2026",
      firmwareVersion: firmwareVersion || dbCharger.firmware_version || "v4.2.0-sim",
    });

    res.json({
      success: true,
      message: `Simulator for charger '${resolvedChargerName}' started`,
      data: instance.toJSON(),
    });
  } catch (error: any) {
    logger.error(`Error starting simulator instance: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Stop and disconnect a simulator instance
 */
export async function stopSession(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const stopped = simulatorService.stopInstance(id);

    if (!stopped) {
      res.status(404).json({ success: false, error: `Simulator session '${id}' not found or already stopped` });
      return;
    }

    res.json({
      success: true,
      message: `Simulator session '${id}' stopped`,
    });
  } catch (error: any) {
    logger.error(`Error stopping simulator instance ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Dispatch manual OCPP action on a simulator
 */
export async function sendAction(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const { action, connectorId = 1, idTag, meterValue, errorCode, vendorErrorCode, status, payload } = req.body;

    const instance = simulatorService.getInstance(id);
    if (!instance) {
      res.status(404).json({ success: false, error: `Simulator session '${id}' not found` });
      return;
    }

    let response: any;

    switch (action) {
      case "BootNotification":
        response = await instance.sendBootNotification();
        break;

      case "Heartbeat":
        response = await instance.sendHeartbeat();
        break;

      case "StatusNotification":
        response = await instance.sendStatusNotification(
          Number(connectorId),
          (status as ConnectorStatus) || "Available",
          errorCode || "NoError",
          vendorErrorCode
        );
        break;

      case "Authorize":
        if (!idTag) {
          res.status(400).json({ success: false, error: "idTag is required for Authorize" });
          return;
        }
        response = await instance.sendAuthorize(idTag);
        break;

      case "PlugIn":
        await instance.plugIn(Number(connectorId));
        response = { status: "PluggedIn", connectorId };
        break;

      case "Unplug":
        await instance.unplug(Number(connectorId));
        response = { status: "Unplugged", connectorId };
        break;

      case "StartTransaction":
        response = await instance.startTransaction(
          Number(connectorId),
          idTag || "SIM-RFID-PASS-01",
          meterValue
        );
        break;

      case "MeterValues":
        response = await instance.sendMeterValues(Number(connectorId));
        break;

      case "StopTransaction":
        response = await instance.stopTransaction(
          Number(connectorId),
          meterValue,
          req.body.reason || "Local",
          idTag
        );
        break;

      case "Custom":
        if (!payload || !payload.action) {
          res.status(400).json({ success: false, error: "Custom action requires payload with action name" });
          return;
        }
        response = await instance.sendCall(payload.action, payload.data || {});
        break;

      default:
        res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
        return;
    }

    res.json({
      success: true,
      action,
      response,
      session: instance.toJSON(),
    });
  } catch (error: any) {
    logger.error(`Error sending action on simulator ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Trigger anomaly or chaos scenario
 */
export async function triggerScenario(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const { scenario, connectorId = 1, powerKw, driftWh, errorCode, vendorErrorCode, enableBuffering } = req.body;

    const instance = simulatorService.getInstance(id);
    if (!instance) {
      res.status(404).json({ success: false, error: `Simulator session '${id}' not found` });
      return;
    }

    let result: any = {};

    switch (scenario) {
      case "premature-cable-disconnect":
        await instance.prematureCableDisconnect(Number(connectorId));
        result = { scenario, status: "Cable forcefully unlatched during charge" };
        break;

      case "power-drop":
        await instance.powerDrop(Number(connectorId), Number(powerKw || 3.7));
        result = { scenario, throttledPowerKw: powerKw || 3.7 };
        break;

      case "meter-drift":
        await instance.meterDrift(Number(connectorId), Number(driftWh || 2500));
        result = { scenario, driftInjectedWh: driftWh || 2500 };
        break;

      case "fault-inject":
        await instance.injectFault(
          Number(connectorId),
          errorCode || "GroundFailure",
          vendorErrorCode || "CHAOS_FAULT_SIM"
        );
        result = { scenario, injectedFault: errorCode || "GroundFailure" };
        break;

      case "offline-buffer-toggle":
        instance.toggleOfflineBuffering(Boolean(enableBuffering));
        result = {
          scenario,
          status: instance.status,
          bufferedFramesCount: instance.offlineBuffer.length,
        };
        break;

      case "offline-buffer-flush":
        result = await instance.flushOfflineBuffer();
        break;

      default:
        res.status(400).json({ success: false, error: `Unknown scenario: ${scenario}` });
        return;
    }

    res.json({
      success: true,
      scenario,
      result,
      session: instance.toJSON(),
    });
  } catch (error: any) {
    logger.error(`Error triggering scenario on simulator ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Execute automated conformance test lab suite
 */
export async function runTestSuite(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const { suiteId } = req.body;

    if (!suiteId) {
      res.status(400).json({ success: false, error: "suiteId is required (e.g. happy_path, smart_charging, offline_buffering, premature_disconnect, hardware_fault_recovery, unauthorized_rfid)" });
      return;
    }

    const testReport = await simulatorService.runTestSuite(id, suiteId);

    res.json({
      success: true,
      report: testReport,
    });
  } catch (error: any) {
    logger.error(`Error running test suite ${req.body.suiteId} on simulator ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Send raw JSON-RPC frame from simulator
 */
export async function sendRawFrame(req: Request, res: Response): Promise<void> {
  try {
    const id = getParamId(req);
    const { frame } = req.body;

    if (!Array.isArray(frame) || frame.length < 3) {
      res.status(400).json({ success: false, error: "Invalid frame format. Must be an array: [2, messageId, action, payload]" });
      return;
    }

    const instance = simulatorService.getInstance(id);
    if (!instance) {
      res.status(404).json({ success: false, error: `Simulator session '${id}' not found` });
      return;
    }

    const action = frame[2];
    const payload = frame[3] || {};
    const response = await instance.sendCall(action, payload);

    res.json({
      success: true,
      frame,
      response,
    });
  } catch (error: any) {
    logger.error(`Error sending raw frame on simulator ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get available RFID tags for quick selection in simulator
 */
export async function getRfidTags(req: Request, res: Response): Promise<void> {
  try {
    const tags = await prisma.rfidUser.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        rfid_tag: true,
        name: true,
        active: true,
      },
    });

    res.json({
      success: true,
      data: tags,
    });
  } catch (error: any) {
    logger.error(`Error fetching RFID tags for simulator: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}
