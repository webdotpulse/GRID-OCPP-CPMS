import { Request, Response } from "express";
import { RoamingTestSuiteService } from "../../services/RoamingTestSuiteService.js";
import { logger } from "../../utils/logger.js";

/**
 * Get catalog of available test cases and automated scenarios
 */
export const getTestSuiteCatalog = async (req: Request, res: Response) => {
  try {
    const catalog = RoamingTestSuiteService.getCatalog();
    return res.json({ success: true, data: catalog });
  } catch (error: any) {
    logger.error("Error retrieving test suite catalog:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve test catalog." });
  }
};

/**
 * Execute an individual test case
 */
export const runTestSuiteTest = async (req: Request, res: Response) => {
  try {
    const { testId, params } = req.body;

    if (!testId) {
      return res.status(400).json({ success: false, message: "testId is required." });
    }

    const result = await RoamingTestSuiteService.runTestCase(testId, params || {});
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error running test case ${req.body?.testId}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to execute test case.",
    });
  }
};

/**
 * Execute a multi-step test scenario sequentially
 */
export const runTestSuiteScenario = async (req: Request, res: Response) => {
  try {
    const { scenarioId, params } = req.body;

    if (!scenarioId) {
      return res.status(400).json({ success: false, message: "scenarioId is required." });
    }

    const result = await RoamingTestSuiteService.runScenario(scenarioId, params || {});
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error running scenario ${req.body?.scenarioId}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to execute scenario.",
    });
  }
};

/**
 * Mock eMSP Authorize Receiver (Simulates an eMSP answering a CPO authorization query)
 */
export const mockEmspAuthorize = async (req: Request, res: Response) => {
  try {
    const { token_uid, location_id } = req.body;
    RoamingTestSuiteService.recordMockEvent("AUTHORIZE_REQUEST", req.body, req.headers);

    const isBlocked = token_uid === "BLOCKED_TAG" || token_uid?.includes("INVALID");

    return res.json({
      result: isBlocked ? "BLOCKED" : "ALLOWED",
      allowed: !isBlocked,
      authorization_reference: `MOCK_AUTH_${Date.now()}`,
      token: {
        uid: token_uid || "UNKNOWN_TAG",
        type: "RFID",
        valid: !isBlocked,
        whitelist: isBlocked ? "NEVER" : "ALWAYS",
      },
    });
  } catch (error: any) {
    logger.error("Error in mock eMSP authorize receiver:", error);
    return res.status(500).json({ result: "INVALID", allowed: false });
  }
};

/**
 * Mock eMSP CDR Receiver (Simulates an eMSP receiving completed CDRs from a CPO)
 */
export const mockEmspCdr = async (req: Request, res: Response) => {
  try {
    RoamingTestSuiteService.recordMockEvent("CDR_DISPATCH", req.body, req.headers);
    return res.status(201).json({
      status_code: 1000,
      status_message: "CDR successfully received and queued for invoicing",
      timestamp: new Date().toISOString(),
      data: {
        cdr_id: req.body?.id || `MOCK-CDR-${Date.now()}`,
        status: "ACCEPTED",
      },
    });
  } catch (error: any) {
    logger.error("Error in mock eMSP CDR receiver:", error);
    return res.status(500).json({ status_code: 3000, status_message: "Failed to process CDR" });
  }
};

/**
 * Mock eMSP Command Callback Receiver (Simulates an eMSP receiving async command callbacks)
 */
export const mockEmspCallback = async (req: Request, res: Response) => {
  try {
    RoamingTestSuiteService.recordMockEvent("ASYNC_CALLBACK", req.body, req.headers);
    return res.json({
      status_code: 1000,
      status_message: "Asynchronous command callback acknowledged",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Error in mock eMSP callback receiver:", error);
    return res.status(500).json({ status_code: 3000, status_message: "Callback error" });
  }
};

/**
 * Get recent mock eMSP events recorded during test runs
 */
export const getMockEvents = async (req: Request, res: Response) => {
  try {
    const events = RoamingTestSuiteService.getMockEvents();
    return res.json({ success: true, data: events });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Failed to fetch mock events." });
  }
};

/**
 * Clear recorded mock events
 */
export const clearMockEvents = async (req: Request, res: Response) => {
  try {
    RoamingTestSuiteService.clearMockEvents();
    return res.json({ success: true, message: "Mock event buffer cleared." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Failed to clear mock events." });
  }
};
