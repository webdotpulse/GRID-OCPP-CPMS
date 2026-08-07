import { Router } from "express";
import {
  getOcpiLocations,
  getOcpiTariffs,
  getOcpiSessions,
  getOcpiCdrs,
} from "./ocpi.controller.js";

const router = Router();

// Standard OCPI 2.2.1 CPO Endpoints
router.get("/2.2.1/locations", getOcpiLocations);
router.get("/2.2.1/tariffs", getOcpiTariffs);
router.get("/2.2.1/sessions", getOcpiSessions);
router.get("/2.2.1/cdrs", getOcpiCdrs);

export default router;
