import { Router } from "express";
import {
  getOcpiLocations,
  getOcpiTariffs,
  getOcpiEndpoints,
  createOcpiEndpoint,
  updateOcpiEndpoint,
  deleteOcpiEndpoint,
  testOcpiEndpoint,
} from "./ocpi.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { authenticateOcpiToken } from "../../middleware/ocpiAuth.js";
import commandsRoutes from "./v221/commands.routes.js";
import tokensRoutes from "./v221/tokens.routes.js";
import sessionsRoutes from "./v221/sessions.routes.js";
import cdrsRoutes from "./v221/cdrs.routes.js";

const router = Router();

// OCPI Roaming Endpoints Management (Admin UI)
router.get("/endpoints", authenticateToken, requireAdmin, getOcpiEndpoints);
router.post("/endpoints", authenticateToken, requireAdmin, createOcpiEndpoint);
router.put("/endpoints/:id", authenticateToken, requireAdmin, updateOcpiEndpoint);
router.delete("/endpoints/:id", authenticateToken, requireAdmin, deleteOcpiEndpoint);
router.post("/endpoints/:id/test", authenticateToken, requireAdmin, testOcpiEndpoint);

// Standard OCPI 2.2.1 CPO Endpoints (Protected by OCPI Partner Token)
router.use("/2.2.1/commands", authenticateOcpiToken, commandsRoutes);
router.use("/2.2.1/tokens", authenticateOcpiToken, tokensRoutes);
router.use("/2.2.1/sessions", authenticateOcpiToken, sessionsRoutes);
router.use("/2.2.1/cdrs", authenticateOcpiToken, cdrsRoutes);
router.get("/2.2.1/locations", authenticateOcpiToken, getOcpiLocations);
router.get("/2.2.1/tariffs", authenticateOcpiToken, getOcpiTariffs);

// Legacy backward-compatible routes (Protected by OCPI Partner Token)
router.get("/locations", authenticateOcpiToken, getOcpiLocations);
router.get("/tariffs", authenticateOcpiToken, getOcpiTariffs);
router.use("/sessions", authenticateOcpiToken, sessionsRoutes);
router.use("/cdrs", authenticateOcpiToken, cdrsRoutes);
router.use("/commands", authenticateOcpiToken, commandsRoutes);
router.use("/tokens", authenticateOcpiToken, tokensRoutes);

export default router;

