import { Router } from "express";
import {
  getAllConnectors,
  getConnectorById,
  createConnector,
  updateConnector,
  deleteConnector,
} from "./connectors.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.get("/", getAllConnectors);
router.get("/:id", getConnectorById);
router.post("/", requireAdmin, createConnector);
router.put("/:id", requireAdmin, updateConnector);
router.delete("/:id", requireAdmin, deleteConnector);

export default router;
