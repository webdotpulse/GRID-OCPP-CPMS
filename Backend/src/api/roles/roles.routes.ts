import { Router } from "express";
import { getRoles } from "./roles.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken as any);
router.get("/", getRoles as any);

export default router;
