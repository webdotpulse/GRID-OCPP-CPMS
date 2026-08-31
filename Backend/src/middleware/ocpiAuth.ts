import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { buildOcpiResponse } from "../services/OcpiService.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware to authenticate OCPI 2.2.1 requests from roaming partners / eMSPs.
 * Expects "Authorization: Token <token>" or "Authorization: Bearer <token>".
 */
export async function authenticateOcpiToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    logger.warn(`OCPI request rejected: Missing Authorization header on ${req.method} ${req.originalUrl}`);
    return res.status(401).json(
      buildOcpiResponse(null, 2001, "Missing Authorization header")
    );
  }

  let token = "";
  if (authHeader.startsWith("Token ")) {
    token = authHeader.substring(6).trim();
  } else if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    token = authHeader.trim();
  }

  if (!token) {
    logger.warn(`OCPI request rejected: Empty token on ${req.method} ${req.originalUrl}`);
    return res.status(401).json(
      buildOcpiResponse(null, 2001, "Invalid Authorization token format")
    );
  }

  try {
    // 1. Check global env fallback if set
    const envToken = process.env.OCPI_SERVER_TOKEN;
    if (envToken && token === envToken) {
      return next();
    }

    // 2. Validate token against registered OCPI Endpoints
    const endpoint = await prisma.ocpiEndpoint.findFirst({
      where: {
        token,
        status: "active",
      },
    });

    if (endpoint) {
      (req as any).ocpiEndpoint = endpoint;
      return next();
    }

    // 3. Validate against RoamingPartner credentials
    const partners = await prisma.roamingPartner.findMany();
    for (const partner of partners) {
      if (partner.apiCredentials) {
        try {
          const creds = JSON.parse(partner.apiCredentials);
          if (creds.token === token || creds.api_key === token) {
            (req as any).roamingPartner = partner;
            return next();
          }
        } catch {
          if (partner.apiCredentials === token) {
            (req as any).roamingPartner = partner;
            return next();
          }
        }
      }
    }

    logger.warn(`OCPI request rejected: Unauthorized token from IP ${req.ip} on ${req.method} ${req.originalUrl}`);
    return res.status(401).json(
      buildOcpiResponse(null, 2001, "Unauthorized: Invalid or expired OCPI token")
    );
  } catch (err: any) {
    logger.error(`Error in authenticateOcpiToken middleware: ${err.message}`);
    return res.status(500).json(
      buildOcpiResponse(null, 3000, "Internal Server Error during token verification")
    );
  }
}
