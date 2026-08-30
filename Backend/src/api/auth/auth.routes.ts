import { Router } from "express";
import {
  register,
  login,
  verify2FALogin,
  refresh,
  getMe,
  updateMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  generate2FASecret,
  enable2FA,
  disable2FA,
  send2FAEmailCode,
  verifyEmail,
  resendVerification,
  getEmergencyContact,
} from "./auth.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.get("/emergency-contact", getEmergencyContact);

router.post("/register", register);
router.post("/login", login);
router.post("/verify-2fa-login", verify2FALogin);
router.post("/refresh", refresh);

// Email verification routes
router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/me", authenticateToken, getMe as any);
router.put("/me", authenticateToken, updateMe as any);
router.put("/password", authenticateToken, updatePassword as any);

// 2FA Routes
router.get("/2fa/generate", authenticateToken, generate2FASecret as any);
router.post("/2fa/enable", authenticateToken, enable2FA as any);
router.post("/2fa/disable", authenticateToken, disable2FA as any);
router.post("/2fa/send-email-code", authenticateToken, send2FAEmailCode as any);

export default router;

