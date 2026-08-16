import { Router } from "express";
import { getMailConfig, updateMailConfig } from "./mail.controller.js";
import { requireAdmin } from "../../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

router.get("/", getMailConfig);
router.put("/", updateMailConfig);

export default router;
