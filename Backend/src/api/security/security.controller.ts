import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { PkiCertificateService } from "../../services/PkiCertificateService.js";
import { installCertificate, deleteCertificate, getInstalledCertificateIds } from "../../ocpp/remoteControl.js";
import { AuditLogService } from "../../services/AuditLogService.js";
import { logger } from "../../utils/logger.js";

/**
 * GET /api/security/ca (Get Root CA Public Certificate)
 */
export const getRootCa = async (req: AuthRequest, res: Response) => {
  try {
    const rootCa = PkiCertificateService.getV2gRootCa();
    const subCa = PkiCertificateService.getV2gSubCa();

    return res.json({
      success: true,
      data: {
        rootCa: {
          certificatePem: rootCa.certificatePem,
          serialNumber: rootCa.serialNumber,
          validFrom: rootCa.validFrom,
          validTo: rootCa.validTo,
          certificateHashData: rootCa.certificateHashData,
        },
        subCa: {
          certificatePem: subCa.certificatePem,
          serialNumber: subCa.serialNumber,
          validFrom: subCa.validFrom,
          validTo: subCa.validTo,
          certificateHashData: subCa.certificateHashData,
        },
      },
    });
  } catch (error: any) {
    logger.error(`Error in getRootCa: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve CA certificate" });
  }
};

/**
 * GET /api/security/certificates (List installed certificates & CSR requests)
 */
export const getCertificates = async (req: AuthRequest, res: Response) => {
  try {
    const { chargerId } = req.query;

    const where: any = {};
    if (chargerId) {
      where.chargerId = parseInt(chargerId as string, 10);
    }

    if (req.userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
      const tenantCondition = currentUser?.companyId
        ? {
            OR: [
              { owner_id: req.userId },
              { owner: { companyId: currentUser.companyId } },
              { chargingStation: { companyId: currentUser.companyId } },
            ],
          }
        : { owner_id: req.userId };
      where.charger = tenantCondition;
    }

    const [installedCertificates, pendingRequests] = await Promise.all([
      prisma.installedCertificate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          charger: { select: { charger_id: true, name: true, model: true } },
        },
      }),
      prisma.certificateRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          charger: { select: { charger_id: true, name: true, model: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        installedCertificates,
        pendingRequests,
      },
    });
  } catch (error: any) {
    logger.error(`Error in getCertificates: ${error.message}`);
    return res.status(500).json({ success: false, error: "Failed to retrieve certificates" });
  }
};

/**
 * POST /api/security/certificates/sign (Sign a pending CSR)
 */
export const signCsrRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId, csr, chargerId, certificateType, validityDays } = req.body;

    let targetCsr = csr;
    let targetChargerId = chargerId ? Number(chargerId) : undefined;
    let targetCertType = certificateType || "V2GCertificate";

    if (requestId) {
      const request = await prisma.certificateRequest.findUnique({
        where: { id: Number(requestId) },
        include: { charger: { include: { chargingStation: true, owner: true } } },
      });
      if (!request) {
        return res.status(404).json({ success: false, error: "Certificate request not found" });
      }
      if (req.userRole !== "superadmin") {
        const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
        const isOwner = request.charger?.owner_id === req.userId;
        const isSameCompany = currentUser?.companyId && (
          request.charger?.chargingStation?.companyId === currentUser.companyId ||
          request.charger?.owner?.companyId === currentUser.companyId
        );
        if (!isOwner && !isSameCompany) {
          return res.status(403).json({ success: false, error: "Access denied: Charger not within your organization" });
        }
      }
      targetCsr = request.csr;
      targetChargerId = request.chargerId;
      targetCertType = request.certificateType;
    }

    if (targetChargerId && req.userRole !== "superadmin" && !requestId) {
      const charger = await prisma.charger.findUnique({
        where: { charger_id: targetChargerId },
        include: { chargingStation: true, owner: true },
      });
      if (charger) {
        const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
        const isOwner = charger.owner_id === req.userId;
        const isSameCompany = currentUser?.companyId && (
          charger.chargingStation?.companyId === currentUser.companyId ||
          charger.owner?.companyId === currentUser.companyId
        );
        if (!isOwner && !isSameCompany) {
          return res.status(403).json({ success: false, error: "Access denied: Charger not within your organization" });
        }
      }
    }

    if (!targetCsr) {
      return res.status(400).json({ success: false, error: "CSR PEM string is required" });
    }

    const signed = PkiCertificateService.signCsr(targetCsr, undefined, undefined, validityDays || 365, {
      certificateType: targetCertType,
    });

    if (requestId) {
      await prisma.certificateRequest.update({
        where: { id: Number(requestId) },
        data: {
          status: "Signed",
          signedCertificate: signed.certificatePem,
        },
      });
    }

    if (targetChargerId) {
      // Record in installed certificates
      await prisma.installedCertificate.create({
        data: {
          chargerId: targetChargerId,
          certificateType: targetCertType,
          certificatePem: signed.certificatePem,
          serialNumber: signed.serialNumber,
          validFrom: signed.validFrom,
          validTo: signed.validTo,
          status: "Accepted",
          certificateHashData: signed.certificateHashData as any,
        },
      });

      // Audit log
      await AuditLogService.logAction({
        userId: req.userId,
        action: "CERTIFICATE_SIGNED",
        target: "Certificate",
        targetId: signed.serialNumber,
        payload: { chargerId: targetChargerId, certificateType: targetCertType },
        ip: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] as string,
      });
    }

    return res.json({ success: true, data: signed });
  } catch (error: any) {
    logger.error(`Error in signCsrRequest: ${error.message}`);
    return res.status(400).json({ success: false, error: error.message || "Failed to sign CSR" });
  }
};

/**
 * POST /api/security/certificates/install (Install certificate onto charger)
 */
export const installCertificateToCharger = async (req: AuthRequest, res: Response) => {
  try {
    const { chargerId, certificateType, certificatePem } = req.body;

    if (!chargerId || !certificateType || !certificatePem) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: chargerId, certificateType, certificatePem",
      });
    }

    const cid = Number(chargerId);

    if (req.userRole !== "superadmin") {
      const charger = await prisma.charger.findUnique({
        where: { charger_id: cid },
        include: { chargingStation: true, owner: true },
      });
      if (!charger) {
        return res.status(404).json({ success: false, error: "Charger not found" });
      }
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
      const isOwner = charger.owner_id === req.userId;
      const isSameCompany = currentUser?.companyId && (
        charger.chargingStation?.companyId === currentUser.companyId ||
        charger.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Charger not within your organization" });
      }
    }

    const rpcResult = await installCertificate(cid, certificateType, certificatePem);

    const hashData = PkiCertificateService.compute15118CertificateHashData(certificatePem);

    const record = await prisma.installedCertificate.create({
      data: {
        chargerId: cid,
        certificateType,
        certificatePem,
        serialNumber: hashData.serialNumber,
        status: rpcResult.status || "Accepted",
        certificateHashData: hashData as any,
      },
    });

    // Audit log
    await AuditLogService.logAction({
      userId: req.userId,
      action: "CERTIFICATE_INSTALLED",
      target: "Charger",
      targetId: String(cid),
      payload: { certificateType, serialNumber: hashData.serialNumber, rpcResult },
      ip: req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({ success: true, data: record, rpcResult });
  } catch (error: any) {
    logger.error(`Error in installCertificateToCharger: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to install certificate" });
  }
};

/**
 * POST /api/security/certificates/delete (Remove certificate from charger)
 */
export const deleteCertificateFromCharger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;

    const cert = await prisma.installedCertificate.findUnique({
      where: { id: Number(id) },
      include: { charger: { include: { chargingStation: true, owner: true } } },
    });

    if (!cert) {
      return res.status(404).json({ success: false, error: "Certificate not found" });
    }

    if (req.userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { companyId: true } });
      const isOwner = cert.charger?.owner_id === req.userId;
      const isSameCompany = currentUser?.companyId && (
        cert.charger?.chargingStation?.companyId === currentUser.companyId ||
        cert.charger?.owner?.companyId === currentUser.companyId
      );
      if (!isOwner && !isSameCompany) {
        return res.status(403).json({ success: false, error: "Access denied: Certificate charger not within your organization" });
      }
    }

    let rpcResult = { status: "Accepted" };
    if (cert.certificateHashData) {
      rpcResult = await deleteCertificate(cert.chargerId, cert.certificateHashData);
    }

    await prisma.installedCertificate.delete({
      where: { id: Number(id) },
    });

    // Audit log
    await AuditLogService.logAction({
      userId: req.userId,
      action: "CERTIFICATE_DELETED",
      target: "Charger",
      targetId: String(cert.chargerId),
      payload: { certificateId: id, serialNumber: cert.serialNumber },
      ip: req.ip || "127.0.0.1",
      userAgent: req.headers["user-agent"] as string,
    });

    return res.json({ success: true, message: "Certificate deleted", rpcResult });
  } catch (error: any) {
    logger.error(`Error in deleteCertificateFromCharger: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || "Failed to delete certificate" });
  }
};
