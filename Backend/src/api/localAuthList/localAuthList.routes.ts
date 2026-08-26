import { Router } from "express";
import {
  getLocalAuthList,
  syncLocalAuthList,
  queryLocalListVersion,
} from "./localAuthList.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router({ mergeParams: true });

router.get("/:id/local-auth-list", authenticateToken, getLocalAuthList);
router.post("/:id/local-auth-list/sync", authenticateToken, requireAdmin, syncLocalAuthList);
router.post("/:id/local-auth-list/version", authenticateToken, requireAdmin, queryLocalListVersion);

export default router;
