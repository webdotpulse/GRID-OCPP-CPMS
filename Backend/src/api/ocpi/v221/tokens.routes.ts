import { Router } from "express";
import {
  getTokens,
  getTokenById,
  putToken,
  postAuthorizeToken,
} from "./tokens.controller.js";

const router = Router();

router.get("/", getTokens);
router.get("/:token_uid", getTokenById);
router.put("/:token_uid", putToken);
router.post("/:token_uid/authorize", postAuthorizeToken);

export default router;
