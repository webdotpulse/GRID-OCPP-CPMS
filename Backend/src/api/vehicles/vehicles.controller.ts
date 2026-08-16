import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";

/**
 * List all ISO 15118 Vehicle Contract Certificates with pagination
 */
export const getCertificates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = parsePagination(req.query.page, req.query.limit);
    const skip = (page - 1) * limit;

    const [total, certificates] = await Promise.all([
      prisma.vehicleContractCertificate.count(),
      prisma.vehicleContractCertificate.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          rfidUser: { select: { rfid_user_id: true, rfid_tag: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      success: true,
      data: certificates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error fetching vehicle contract certificates:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const getAll = getCertificates;

/**
 * Get a specific Vehicle Contract Certificate by ID
 */
export const getCertificateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: "Invalid certificate ID" });
      return;
    }

    const cert = await prisma.vehicleContractCertificate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        rfidUser: { select: { rfid_user_id: true, rfid_tag: true } },
      },
    });

    if (!cert) {
      res.status(404).json({ success: false, error: "Certificate not found" });
      return;
    }

    res.json({ success: true, data: cert });
  } catch (error) {
    logger.error("Error fetching certificate by ID:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Create a new ISO 15118 Vehicle Contract Certificate
 */
export const createCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { emaid, macAddress, contractCert, status, expirationDate, userId, rfidUserId } = req.body;

    if (!emaid || !userId) {
      res.status(400).json({ success: false, error: "emaid and userId are required" });
      return;
    }

    let expDate = expirationDate ? new Date(expirationDate) : undefined;
    if (!expDate || isNaN(expDate.getTime())) {
      expDate = new Date();
      expDate.setFullYear(expDate.getFullYear() + 1); // default 1 year validity
    }

    const newCert = await prisma.vehicleContractCertificate.create({
      data: {
        emaid,
        macAddress: macAddress || null,
        contractCert: contractCert || null,
        status: status || "Valid",
        expirationDate: expDate,
        userId: Number(userId),
        rfidUserRfid_user_id: rfidUserId ? Number(rfidUserId) : null,
      },
    });

    res.status(201).json({ success: true, data: newCert });
  } catch (error: any) {
    logger.error("Error creating certificate:", error);
    if (error.code === "P2002") {
      res.status(409).json({ success: false, error: "EMAID already registered" });
      return;
    }
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

export const create = createCertificate;

/**
 * Update an existing Vehicle Contract Certificate
 */
export const updateCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: "Invalid certificate ID" });
      return;
    }

    const { status, macAddress, contractCert, expirationDate } = req.body;

    const updated = await prisma.vehicleContractCertificate.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(macAddress !== undefined && { macAddress }),
        ...(contractCert !== undefined && { contractCert }),
        ...(expirationDate && { expirationDate: new Date(expirationDate) }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error("Error updating certificate:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

export const update = updateCertificate;

/**
 * Delete a Vehicle Contract Certificate
 */
export const deleteCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, error: "Invalid certificate ID" });
      return;
    }

    await prisma.vehicleContractCertificate.delete({ where: { id } });

    res.json({ success: true, message: "Certificate deleted successfully" });
  } catch (error: any) {
    logger.error("Error deleting certificate:", error);
    res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

export const remove = deleteCertificate;

/**
 * Get Vehicle Energy Profile
 */
export const getEnergyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const profile = await prisma.vehicleEnergyProfile.findFirst({
      where: { userId },
    });

    if (!profile) {
      res.json({
        success: true,
        data: {
          minSocThreshold: 40.0,
          batteryCapacity: null,
          userId,
        },
        minSocThreshold: 40.0,
        batteryCapacity: null,
        userId,
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
      minSocThreshold: profile.minSocThreshold,
      batteryCapacity: profile.batteryCapacity,
      userId: profile.userId,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to fetch vehicle energy profile" });
  }
};

/**
 * Save Vehicle Energy Profile
 */
export const saveEnergyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { minSocThreshold, batteryCapacity, rfidUserId } = req.body;

    if (minSocThreshold !== undefined) {
      const numSoc = Number(minSocThreshold);
      if (isNaN(numSoc) || numSoc < 0 || numSoc > 100) {
        res.status(400).json({ success: false, error: "minSocThreshold must be a valid number between 0 and 100" });
        return;
      }
    }

    const parsedSoc = minSocThreshold !== undefined ? Number(minSocThreshold) : 40.0;
    const parsedCapacity = batteryCapacity !== undefined ? (batteryCapacity !== null ? Number(batteryCapacity) : null) : undefined;
    const parsedRfid = rfidUserId !== undefined ? (rfidUserId !== null ? Number(rfidUserId) : null) : undefined;

    const profile = await prisma.vehicleEnergyProfile.upsert({
      where: { userId },
      update: {
        minSocThreshold: parsedSoc,
        ...(parsedCapacity !== undefined && { batteryCapacity: parsedCapacity }),
        ...(parsedRfid !== undefined && { rfidUserId: parsedRfid }),
      },
      create: {
        userId,
        minSocThreshold: parsedSoc,
        batteryCapacity: parsedCapacity ?? null,
        rfidUserId: parsedRfid ?? null,
      },
    });

    res.json({
      success: true,
      data: profile,
      minSocThreshold: profile.minSocThreshold,
      batteryCapacity: profile.batteryCapacity,
      userId: profile.userId,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to save vehicle energy profile" });
  }
};

