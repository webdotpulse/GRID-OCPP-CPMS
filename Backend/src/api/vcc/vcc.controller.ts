import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { parseId, parsePagination } from "../../utils/validation.js";

/**
 * List all ISO 15118 Vehicle Contract Certificates
 */
export const getCertificates = async (req: AuthRequest, res: Response) => {
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

    return res.json({
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
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Get a specific Vehicle Contract Certificate by ID
 */
export const getCertificateById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid certificate ID" });

    const cert = await prisma.vehicleContractCertificate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        rfidUser: { select: { rfid_user_id: true, rfid_tag: true } },
      },
    });

    if (!cert) return res.status(404).json({ success: false, error: "Certificate not found" });

    return res.json({ success: true, data: cert });
  } catch (error) {
    logger.error("Error fetching certificate by ID:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Create a new ISO 15118 Vehicle Contract Certificate
 */
export const createCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const { emaid, macAddress, contractCert, status, expirationDate, userId, rfidUserId } = req.body;

    if (!emaid || !userId || !expirationDate) {
      return res.status(400).json({ success: false, error: "emaid, userId, and expirationDate are required" });
    }

    const newCert = await prisma.vehicleContractCertificate.create({
      data: {
        emaid,
        macAddress: macAddress || null,
        contractCert: contractCert || null,
        status: status || "Valid",
        expirationDate: new Date(expirationDate),
        userId: Number(userId),
        rfidUserRfid_user_id: rfidUserId ? Number(rfidUserId) : null,
      },
    });

    return res.status(201).json({ success: true, data: newCert });
  } catch (error: any) {
    logger.error("Error creating certificate:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, error: "EMAID already registered" });
    }
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Update an existing Vehicle Contract Certificate
 */
export const updateCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid certificate ID" });

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

    return res.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Error updating certificate:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * Delete a Vehicle Contract Certificate
 */
export const deleteCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid certificate ID" });

    await prisma.vehicleContractCertificate.delete({ where: { id } });

    return res.json({ success: true, message: "Certificate deleted successfully" });
  } catch (error) {
    logger.error("Error deleting certificate:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
