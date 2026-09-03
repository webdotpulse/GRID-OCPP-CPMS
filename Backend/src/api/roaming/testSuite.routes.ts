import { Router } from "express";
import {
  getTestSuiteCatalog,
  runTestSuiteTest,
  runTestSuiteScenario,
  mockEmspAuthorize,
  mockEmspCdr,
  mockEmspCallback,
  getMockEvents,
  clearMockEvents,
} from "./testSuite.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Test Runner Endpoints (Admin Protected)
router.get("/catalog", authenticateToken, requireAdmin, getTestSuiteCatalog);
router.post("/run-test", authenticateToken, requireAdmin, runTestSuiteTest);
router.post("/run-scenario", authenticateToken, requireAdmin, runTestSuiteScenario);
router.get("/mock-events", authenticateToken, requireAdmin, getMockEvents);
router.post("/mock-events/clear", authenticateToken, requireAdmin, clearMockEvents);

// Public Mock eMSP Receivers for CPO Test Execution
router.post("/mock-emsp/authorize", mockEmspAuthorize);
router.post("/mock-emsp/cdrs", mockEmspCdr);
router.post("/mock-emsp/callback", mockEmspCallback);

export default router;
