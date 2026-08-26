import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";
import { buildOcpiResponse, OcpiService } from "../../../services/OcpiService.js";

/**
 * OCPI 2.2.1 GET /tokens (Get token list)
 */
export const getTokens = async (req: Request, res: Response) => {
  try {
    const rfidUsers = await prisma.rfidUser.findMany({
      where: { active: true },
    });

    const ocpiTokens = rfidUsers.map((u) => ({
      country_code: "NL",
      party_id: "CPMS",
      uid: u.rfid_tag,
      type: "RFID",
      contract_id: u.external_id || `NL-CPMS-${u.rfid_user_id}`,
      visual_number: u.rfid_tag,
      issuer: u.company_name || "OCPP-CPMS",
      group_id: null,
      valid: u.active,
      whitelist: "ALWAYS",
      language: "en",
      last_updated: u.updatedAt.toISOString(),
    }));

    return res.json(buildOcpiResponse(ocpiTokens));
  } catch (error) {
    logger.error("Error fetching OCPI tokens:", error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch tokens"));
  }
};

/**
 * OCPI 2.2.1 GET /tokens/:token_uid (Get single token)
 */
export const getTokenById = async (req: Request, res: Response) => {
  const token_uid = String(req.params.token_uid);

  try {
    const rfid = await prisma.rfidUser.findUnique({
      where: { rfid_tag: token_uid },
    });

    if (!rfid) {
      return res.status(404).json(buildOcpiResponse(null, 2004, "Token not found"));
    }

    const ocpiToken = {
      country_code: "NL",
      party_id: "CPMS",
      uid: rfid.rfid_tag,
      type: "RFID",
      contract_id: rfid.external_id || `NL-CPMS-${rfid.rfid_user_id}`,
      visual_number: rfid.rfid_tag,
      issuer: rfid.company_name || "OCPP-CPMS",
      valid: rfid.active,
      whitelist: "ALWAYS",
      last_updated: rfid.updatedAt.toISOString(),
    };

    return res.json(buildOcpiResponse(ocpiToken));
  } catch (error) {
    logger.error(`Error fetching OCPI token ${token_uid}:`, error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to fetch token"));
  }
};

/**
 * OCPI 2.2.1 PUT /tokens/:token_uid (Sync / Whitelist foreign token from eMSP)
 */
export const putToken = async (req: Request, res: Response) => {
  const token_uid = String(req.params.token_uid);
  const tokenData = req.body;

  try {
    const valid = tokenData.valid !== false;
    const issuer = tokenData.issuer || "Roaming Partner";
    const contractId = tokenData.contract_id || `ROAM-${token_uid}`;

    let ownerId = 1;
    const defaultUser = await prisma.user.findFirst();
    if (defaultUser) {
      ownerId = defaultUser.id;
    }

    const rfid = await prisma.rfidUser.upsert({
      where: { rfid_tag: token_uid },
      create: {
        rfid_tag: token_uid,
        external_id: contractId,
        name: `Roaming User (${issuer})`,
        company_name: issuer,
        active: valid,
        owner_id: ownerId,
      },
      update: {
        external_id: contractId,
        company_name: issuer,
        active: valid,
      },
    });

    logger.info(`Synced OCPI roaming token ${token_uid} (Valid: ${valid})`);
    return res.status(200).json(buildOcpiResponse({ success: true }));
  } catch (error) {
    logger.error(`Error in OCPI PUT token ${token_uid}:`, error);
    return res.status(500).json(buildOcpiResponse(null, 3000, "Unable to update token"));
  }
};

/**
 * OCPI 2.2.1 POST /tokens/:token_uid/authorize (Real-time Token Authorization)
 */
export const postAuthorizeToken = async (req: Request, res: Response) => {
  const token_uid = String(req.params.token_uid);
  const { location_id } = req.body || {};

  try {
    const tokenType = typeof req.query.type === "string" ? req.query.type : "RFID";
    const locId = location_id ? String(location_id) : undefined;
    const authResult = await OcpiService.authorizeToken(token_uid, tokenType, locId);

    return res.status(200).json(
      buildOcpiResponse({
        result: authResult.result,
        token: authResult.token,
        authorization_reference: authResult.authorization_reference,
      })
    );
  } catch (error) {
    logger.error(`Error in OCPI authorize token ${token_uid}:`, error);
    return res.status(500).json(
      buildOcpiResponse({ result: "INVALID" }, 3000, "Authorization processing error")
    );
  }
};
