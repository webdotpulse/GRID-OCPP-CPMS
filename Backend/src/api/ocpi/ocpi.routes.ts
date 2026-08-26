import { Router } from "express";
import {
  getOcpiLocations,
  getOcpiTariffs,
} from "./ocpi.controller.js";
import commandsRoutes from "./v221/commands.routes.js";
import tokensRoutes from "./v221/tokens.routes.js";
import sessionsRoutes from "./v221/sessions.routes.js";
import cdrsRoutes from "./v221/cdrs.routes.js";

const router = Router();

// Standard OCPI 2.2.1 CPO Endpoints
router.use("/2.2.1/commands", commandsRoutes);
router.use("/2.2.1/tokens", tokensRoutes);
router.use("/2.2.1/sessions", sessionsRoutes);
router.use("/2.2.1/cdrs", cdrsRoutes);
router.get("/2.2.1/locations", getOcpiLocations);
router.get("/2.2.1/tariffs", getOcpiTariffs);

// Legacy backward-compatible routes
router.get("/locations", getOcpiLocations);
router.get("/tariffs", getOcpiTariffs);
router.use("/sessions", sessionsRoutes);
router.use("/cdrs", cdrsRoutes);
router.use("/commands", commandsRoutes);
router.use("/tokens", tokensRoutes);

export default router;
