import { Router } from "express";
import { getMailConfig, updateMailConfig } from "./mail.controller.js";
import { requireAdmin, requireSuperAdmin } from "../../../middleware/auth.js";

const router = Router();

router.get("/", requireAdmin, getMailConfig);
router.put("/", requireSuperAdmin, updateMailConfig);

export default router;
