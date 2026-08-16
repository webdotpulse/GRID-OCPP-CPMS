import { Router } from "express";
import {
  getEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  testEndpoint
} from "./oicp.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Apply auth & admin checks to all OICP routes
router.use(authenticateToken, requireAdmin);

// Endpoint management
router.get("/endpoints", getEndpoints);
router.post("/endpoints", createEndpoint);
router.put("/endpoints/:id", updateEndpoint);
router.delete("/endpoints/:id", deleteEndpoint);
router.post("/endpoints/:id/test", testEndpoint);

export default router;

