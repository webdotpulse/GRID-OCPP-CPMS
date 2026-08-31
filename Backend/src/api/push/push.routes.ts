import { Router } from "express";
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  sendTestPush,
} from "./push.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", authenticateToken, subscribePush);
router.post("/unsubscribe", authenticateToken, unsubscribePush);
router.post("/test", authenticateToken, sendTestPush);

export default router;
