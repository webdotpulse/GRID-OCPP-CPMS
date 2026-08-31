import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getFirmwareFiles,
  getFirmwareForCharger,
  uploadFirmware,
  deleteFirmware,
} from "./firmware.controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads", "firmware");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage for firmware files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${uniqueSuffix}_${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Max 100 MB firmware binary
  },
});

// Authenticated routes
router.use(authenticateToken as any);

router.get("/", getFirmwareFiles);
router.get("/for-charger/:chargerId", getFirmwareForCharger);

// Admin-only upload & deletion routes
router.post("/", requireAdmin as any, upload.single("file"), uploadFirmware);
router.delete("/:id", requireAdmin as any, deleteFirmware);

export default router;
