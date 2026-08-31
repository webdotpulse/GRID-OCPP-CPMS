import { Router } from "express";
import {
  getAllTariffs,
  getTariffById,
  createTariff,
  updateTariff,
  deleteTariff,
  assignTariffToCharger,
  removeTariffFromCharger,
  getTariffChargers,
  previewEpexTariff,
} from "./tariffs.controller.js";
import {
  getMarketPrices,
  triggerArbitrageDispatch,
  ingestImbalancePrice,
} from "./marketPrices.controller.js";
import { requireAdmin } from "../../middleware/auth.js";
import { auditLogMiddleware } from "../../middleware/audit.js";

const router = Router();

router.get("/", getAllTariffs);
router.get("/market-prices", getMarketPrices);
router.post("/arbitrage-dispatch", requireAdmin, triggerArbitrageDispatch);
router.post("/imbalance-ingest", requireAdmin, ingestImbalancePrice);
router.post("/preview-epex", requireAdmin, previewEpexTariff);
router.get("/:id", getTariffById);
router.post("/", requireAdmin, auditLogMiddleware("CREATE_TARIFF", "Tariff"), createTariff);
router.put("/:id", requireAdmin, auditLogMiddleware("UPDATE_TARIFF", "Tariff"), updateTariff);
router.delete("/:id", requireAdmin, auditLogMiddleware("DELETE_TARIFF", "Tariff"), deleteTariff);
router.post("/:id/chargers/:chargerId", requireAdmin, auditLogMiddleware("ASSIGN_TARIFF", "Tariff"), assignTariffToCharger);
router.delete("/:id/chargers/:chargerId", requireAdmin, auditLogMiddleware("REMOVE_TARIFF", "Tariff"), removeTariffFromCharger);
router.get("/:id/chargers", getTariffChargers);

export default router;
