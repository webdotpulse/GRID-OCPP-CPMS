import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  attachChargerProduct,
} from "./products.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);

router.get("/", getProducts);
router.get("/:id", getProductById);

// Admin-only write & attachment routes
router.post("/", requireAdmin as any, createProduct);
router.put("/:id", requireAdmin as any, updateProduct);
router.delete("/:id", requireAdmin as any, deleteProduct);
router.patch("/chargers/:chargerId/attach", requireAdmin as any, attachChargerProduct);

export default router;
