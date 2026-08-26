import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

/**
 * Generate an HMAC-SHA256 signature for outgoing webhook payload
 */
export function createHmacSignature(
  payload: string | Buffer | object,
  secret: string,
  timestamp?: number | string
): string {
  const content = typeof payload === "object" && !Buffer.isBuffer(payload)
    ? JSON.stringify(payload)
    : payload.toString();

  const dataToSign = timestamp ? `${timestamp}.${content}` : content;
  return crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");
}

/**
 * Verify HMAC-SHA256 signature on incoming webhook payload with replay attack tolerance
 */
export function verifyHmacSignature(
  payload: string | Buffer | object,
  signatureHeader: string,
  secret: string,
  timestampHeader?: string,
  maxToleranceSeconds: number = 300
): { valid: boolean; reason?: string } {
  if (!signatureHeader || !secret) {
    return { valid: false, reason: "Missing signature header or secret" };
  }

  // 1. Replay attack timestamp verification (max 5 minutes default)
  if (timestampHeader) {
    const timestampNum = parseInt(timestampHeader, 10);
    if (isNaN(timestampNum)) {
      return { valid: false, reason: "Invalid webhook timestamp header" };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const delta = Math.abs(nowSeconds - timestampNum);

    if (delta > maxToleranceSeconds) {
      return {
        valid: false,
        reason: `Webhook timestamp expired or outside tolerance window (delta: ${delta}s > ${maxToleranceSeconds}s)`,
      };
    }
  }

  // Clean signature header (strip "sha256=", "t=", etc. if present)
  let cleanSignature = signatureHeader.trim();
  if (cleanSignature.startsWith("sha256=")) {
    cleanSignature = cleanSignature.slice(7);
  }

  // Compute expected signature
  const expectedSignature = createHmacSignature(payload, secret, timestampHeader);

  // Timing-safe constant-time comparison
  try {
    const signatureBuffer = Buffer.from(cleanSignature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!isValid) {
      return { valid: false, reason: "HMAC signature mismatch" };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

/**
 * Express Middleware for automated webhook signature verification
 */
export function verifyWebhookSignatureMiddleware(
  secretGetter: string | ((req: Request) => string) = process.env.WEBHOOK_SECRET || "default-cpms-webhook-secret"
) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const signature =
      (req.headers["x-signature-256"] as string) ||
      (req.headers["x-hub-signature-256"] as string) ||
      (req.headers["x-signature"] as string) ||
      (req.headers["x-webhook-signature"] as string);

    const timestamp = req.headers["x-timestamp"] as string;

    const secret = typeof secretGetter === "function" ? secretGetter(req) : secretGetter;

    if (!signature) {
      logger.warn(`Rejected unsigned webhook request from IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: "Missing webhook HMAC signature header (X-Signature-256)",
      });
    }

    const verification = verifyHmacSignature(req.body, signature, secret, timestamp);

    if (!verification.valid) {
      logger.warn(`Invalid webhook signature from IP ${req.ip}: ${verification.reason}`);
      return res.status(401).json({
        success: false,
        error: `Webhook signature verification failed: ${verification.reason}`,
      });
    }

    next();
  };
}
