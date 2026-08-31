import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { EichrechtOcmfService } from "../../services/EichrechtOcmfService.js";

/**
 * POST /api/eichrecht/verify - Verify arbitrary OCMF payload or transaction OCMF
 */
export const verifyOcmfPayload = async (req: Request, res: Response) => {
  try {
    const { ocmfPayload, transactionId, chargerId } = req.body;

    if (!ocmfPayload) {
      return res.status(400).json({ success: false, error: "ocmfPayload is required" });
    }

    if (transactionId && chargerId) {
      const record = await EichrechtOcmfService.ingestAndVerifyTransactionOcmf({
        transactionId: String(transactionId),
        chargerId: Number(chargerId),
        ocmfRaw: ocmfPayload,
      });
      return res.json({ success: true, data: record });
    }

    const parsed = EichrechtOcmfService.parseOcmfPayload(ocmfPayload);
    const verification = EichrechtOcmfService.verifyOcmfSignature(parsed);

    res.json({
      success: true,
      data: {
        parsed,
        verification,
      },
    });
  } catch (error: any) {
    logger.error(`Error verifying OCMF payload: ${error}`);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OCMF payload" });
  }
};

/**
 * GET /api/eichrecht/records - Get audited Eichrecht metrology records
 */
export const getEichrechtRecords = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const chargerId = req.query.chargerId ? parseInt(req.query.chargerId as string) : undefined;
    const isVerified = req.query.isVerified !== undefined ? req.query.isVerified === "true" : undefined;

    const records = await prisma.eichrechtRecord.findMany({
      where: {
        ...(chargerId && { chargerId }),
        ...(isVerified !== undefined && { isVerified }),
      },
      include: {
        charger: { select: { charger_id: true, name: true, model: true, manufacturer: true } },
        transaction: { select: { id: true, transactionId: true, startTime: true, endTime: true, idTag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json({ success: true, data: records });
  } catch (error) {
    logger.error(`Error fetching Eichrecht records: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch Eichrecht records" });
  }
};

/**
 * GET /api/eichrecht/transaction/:id - Get Eichrecht record for a specific transaction
 */
export const getTransactionEichrecht = async (req: Request, res: Response) => {
  try {
    const transactionId = String(req.params.id);
    const record = await prisma.eichrechtRecord.findFirst({
      where: { transactionId },
      include: { charger: true, transaction: true },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: "No Eichrecht metrology record found for this transaction" });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    logger.error(`Error fetching transaction Eichrecht record: ${error}`);
    res.status(500).json({ success: false, error: "Failed to fetch Eichrecht record" });
  }
};

/**
 * GET /api/eichrecht/transaction/:id/xml - Export S.A.F.E. Transparency Software XML Proof
 */
export const exportTransparencyXml = async (req: Request, res: Response) => {
  try {
    const transactionId = String(req.params.id);
    const record = await prisma.eichrechtRecord.findFirst({
      where: { transactionId },
    });

    if (!record || !record.xmlProof) {
      return res.status(404).json({ success: false, error: "Transparency proof not available" });
    }

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="Eichrecht_TX_${transactionId}.xml"`);
    res.send(record.xmlProof);
  } catch (error) {
    logger.error(`Error exporting transparency XML: ${error}`);
    res.status(500).json({ success: false, error: "Failed to export transparency XML" });
  }
};
