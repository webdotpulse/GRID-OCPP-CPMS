import { Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { parseId } from "../../utils/validation.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * GET /api/firmware - List all uploaded firmware binaries with filtering
 */
export const getFirmwareFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { search, model, manufacturer } = req.query;

    const where: any = {};

    if (model && model !== "all") {
      where.model = String(model);
    }
    if (manufacturer && manufacturer !== "all") {
      where.manufacturer = String(manufacturer);
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { version: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { filename: { contains: q, mode: "insensitive" } },
      ];
    }

    const files = await prisma.firmwareFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: files,
      total: files.length,
    });
  } catch (error: any) {
    logger.error("Error fetching firmware files:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch firmware files" });
  }
};

/**
 * GET /api/firmware/for-charger/:chargerId - Retrieve matching firmware binaries for a specific charger
 */
export const getFirmwareForCharger = async (req: AuthRequest, res: Response) => {
  try {
    const chargerId = parseId(req.params.chargerId);
    if (!chargerId) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      select: { charger_id: true, name: true, model: true, manufacturer: true, firmware_version: true },
    });

    if (!charger) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }

    // Match by specific charger ID OR matching model OR matching manufacturer OR universal
    const files = await prisma.firmwareFile.findMany({
      where: {
        OR: [
          { chargerId: charger.charger_id },
          { model: charger.model },
          ...(charger.manufacturer ? [{ manufacturer: charger.manufacturer }] : []),
          { model: null, manufacturer: null, chargerId: null }, // Universal firmware
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      charger,
      data: files,
      count: files.length,
    });
  } catch (error: any) {
    logger.error(`Error fetching firmware for charger #${req.params.chargerId}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch charger firmware" });
  }
};

/**
 * POST /api/firmware - Upload a new firmware binary
 */
export const uploadFirmware = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No firmware file uploaded" });
    }

    const { name, version, manufacturer, model, chargerId, releaseNotes } = req.body;

    if (!name || !version) {
      // Remove temporary uploaded file if required validation fields are missing
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, error: "Firmware name and version are required" });
    }

    // Calculate SHA-256 checksum of uploaded binary
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Relative public URL
    const fileUrl = `/uploads/firmware/${req.file.filename}`;

    const newFirmware = await prisma.firmwareFile.create({
      data: {
        name: String(name).trim(),
        version: String(version).trim(),
        manufacturer: manufacturer ? String(manufacturer).trim() : null,
        model: model ? String(model).trim() : null,
        chargerId: chargerId ? parseInt(String(chargerId), 10) : null,
        filename: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        checksum,
        releaseNotes: releaseNotes ? String(releaseNotes).trim() : null,
        uploadedBy: req.userId || null,
      },
    });

    logger.info(`Firmware uploaded: ${newFirmware.name} v${newFirmware.version} (${newFirmware.filename})`);

    res.status(201).json({
      success: true,
      message: `Firmware "${newFirmware.name}" v${newFirmware.version} uploaded successfully`,
      data: newFirmware,
    });
  } catch (error: any) {
    logger.error("Error uploading firmware binary:", error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    res.status(500).json({ success: false, error: error.message || "Failed to upload firmware" });
  }
};

/**
 * DELETE /api/firmware/:id - Delete firmware record and purge binary file from storage
 */
export const deleteFirmware = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid firmware ID" });
    }

    const firmware = await prisma.firmwareFile.findUnique({
      where: { id },
    });

    if (!firmware) {
      return res.status(404).json({ success: false, error: "Firmware file not found" });
    }

    // Attempt to remove physical file from uploads folder
    const diskPath = path.join(process.cwd(), firmware.fileUrl.startsWith("/") ? firmware.fileUrl.slice(1) : firmware.fileUrl);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch (fileErr) {
        logger.warn(`Could not delete physical firmware file at ${diskPath}:`, fileErr);
      }
    }

    await prisma.firmwareFile.delete({
      where: { id },
    });

    logger.info(`Firmware #${id} (${firmware.name}) deleted by user #${req.userId}`);

    res.json({
      success: true,
      message: `Firmware "${firmware.name}" deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Error deleting firmware #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete firmware" });
  }
};
