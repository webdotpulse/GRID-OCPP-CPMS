import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import axios from "axios";
import { logger } from "../../utils/logger.js";

/**
 * Validates whether an external URL is safe against SSRF attacks
 */
export function isSafeExternalUrl(urlStr: string): { valid: boolean; reason?: string } {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, reason: "URL is required and must be a string." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Only HTTP and HTTPS protocols are permitted." };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  const cleanHost = hostname.replace(/^\[|\]$/g, "");

  // Blacklist loopback, local domains, and cloud metadata endpoints
  const blockedHostnames = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "169.254.169.254",
    "metadata.google.internal",
    "instance-data",
  ];

  if (
    blockedHostnames.includes(cleanHost) ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal")
  ) {
    return { valid: false, reason: "Access to loopback, local, or cloud metadata hostnames is forbidden." };
  }

  // Check if hostname is an IPv4 address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = cleanHost.match(ipv4Regex);
  if (ipMatch) {
    const octets = [
      parseInt(ipMatch[1], 10),
      parseInt(ipMatch[2], 10),
      parseInt(ipMatch[3], 10),
      parseInt(ipMatch[4], 10),
    ];

    if (octets.some((o) => o < 0 || o > 255)) {
      return { valid: false, reason: "Invalid IPv4 address." };
    }

    const [o1, o2] = octets;

    // 0.0.0.0/8
    if (o1 === 0) return { valid: false, reason: "Access to 0.0.0.0/8 is forbidden." };
    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return { valid: false, reason: "Access to loopback IP addresses is forbidden." };
    // 10.0.0.0/8 (Private)
    if (o1 === 10) return { valid: false, reason: "Access to private RFC1918 IP addresses (10.0.0.0/8) is forbidden." };
    // 172.16.0.0/12 (Private)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return { valid: false, reason: "Access to private RFC1918 IP addresses (172.16.0.0/12) is forbidden." };
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return { valid: false, reason: "Access to private RFC1918 IP addresses (192.168.0.0/16) is forbidden." };
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (o1 === 169 && o2 === 254) return { valid: false, reason: "Access to link-local IP addresses (169.254.0.0/16) is forbidden." };
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return { valid: false, reason: "Access to shared address space (100.64.0.0/10) is forbidden." };
  }

  // Check IPv6 unique local (fc00::/7) and link local (fe80::/10)
  if (cleanHost.startsWith("fc") || cleanHost.startsWith("fd") || cleanHost.startsWith("fe80")) {
    return { valid: false, reason: "Access to private or link-local IPv6 addresses is forbidden." };
  }

  return { valid: true };
}

/**
 * Retrieve all OICP endpoints
 */
export const getEndpoints = async (req: Request, res: Response) => {
  try {
    const endpoints = await prisma.oicpEndpoint.findMany();
    res.json({ success: true, data: endpoints });
  } catch (error: any) {
    logger.error(`Failed to fetch OICP endpoints: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to fetch OICP endpoints." });
  }
};

/**
 * Create a new OICP endpoint
 */
export const createEndpoint = async (req: Request, res: Response) => {
  try {
    const { name, url, token, version, status } = req.body;

    if (!name || !url || !token) {
      return res.status(400).json({
        success: false,
        message: "name, url, and token are required fields.",
      });
    }

    const urlCheck = isSafeExternalUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({
        success: false,
        message: `Invalid endpoint URL: ${urlCheck.reason}`,
      });
    }

    const endpoint = await prisma.oicpEndpoint.create({
      data: {
        name,
        url: url.trim(),
        token,
        version: version || "2.3",
        status: status || "active",
      },
    });

    logger.info(`Created OICP endpoint ${endpoint.name} (${endpoint.id})`);
    res.status(201).json({ success: true, data: endpoint });
  } catch (error: any) {
    logger.error(`Failed to create OICP endpoint: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to create OICP endpoint." });
  }
};

/**
 * Update an OICP endpoint
 */
export const updateEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    if (req.body.url) {
      const urlCheck = isSafeExternalUrl(req.body.url);
      if (!urlCheck.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid endpoint URL: ${urlCheck.reason}`,
        });
      }
      req.body.url = req.body.url.trim();
    }

    const endpoint = await prisma.oicpEndpoint.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: endpoint });
  } catch (error: any) {
    logger.error(`Failed to update OICP endpoint: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to update OICP endpoint." });
  }
};

/**
 * Delete an OICP endpoint
 */
export const deleteEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    await prisma.oicpEndpoint.delete({
      where: { id },
    });

    res.json({ success: true, message: "OICP endpoint deleted." });
  } catch (error: any) {
    logger.error(`Failed to delete OICP endpoint: ${error.message}`);
    res.status(500).json({ success: false, message: "Failed to delete OICP endpoint." });
  }
};

/**
 * Test an OICP endpoint connection safely
 */
export const testEndpoint = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid endpoint ID." });
    }

    const endpoint = await prisma.oicpEndpoint.findUnique({
      where: { id },
    });

    if (!endpoint) {
      return res.status(404).json({ success: false, message: "OICP endpoint not found." });
    }

    const urlCheck = isSafeExternalUrl(endpoint.url);
    if (!urlCheck.valid) {
      logger.warn(`SSRF Blocked on OICP testEndpoint for endpoint ${id} (${endpoint.url}): ${urlCheck.reason}`);
      return res.status(400).json({
        success: false,
        message: `Connection aborted: ${urlCheck.reason}`,
      });
    }

    const response = await axios.get(endpoint.url, {
      headers: {
        Authorization: `Bearer ${endpoint.token}`,
      },
      timeout: 5000,
      maxContentLength: 1024 * 1024, // 1MB
      maxBodyLength: 1024 * 1024,
      maxRedirects: 3,
    });

    res.json({ success: true, message: "Connection successful.", data: response.data });
  } catch (error: any) {
    logger.error(`OICP Test Endpoint Connection failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Connection failed.",
      error: error.message || "Unknown error occurred",
    });
  }
};

/**
 * Manually trigger Hubject EVSE master data push for a station
 */
export const triggerPushEvseData = async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(String(req.params.stationId), 10);
    if (isNaN(stationId)) {
      return res.status(400).json({ success: false, message: "Invalid station ID" });
    }

    const { HubjectOicpService } = await import("../../services/HubjectOicpService.js");
    const result = await HubjectOicpService.pushEvseData(stationId);

    if (result.success) {
      return res.json({ success: true, message: `Pushed ${result.count} EVSE records to Hubject`, data: result });
    } else {
      return res.status(500).json({ success: false, message: result.error || "Failed to push EVSE data" });
    }
  } catch (error: any) {
    logger.error(`Error in triggerPushEvseData: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manually trigger Hubject EVSE status push
 */
export const triggerPushEvseStatus = async (req: Request, res: Response) => {
  try {
    const { chargerId, connectorId, status, errorCode } = req.body;
    if (!chargerId || !status) {
      return res.status(400).json({ success: false, message: "chargerId and status are required" });
    }

    const { HubjectOicpService } = await import("../../services/HubjectOicpService.js");
    const result = await HubjectOicpService.pushEvseStatus(
      parseInt(chargerId),
      connectorId ? parseInt(connectorId) : 1,
      status,
      errorCode
    );

    return res.json({ success: result.success, data: result });
  } catch (error: any) {
    logger.error(`Error in triggerPushEvseStatus: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Real-time driver authorization check against Hubject
 */
export const triggerAuthorizeStart = async (req: Request, res: Response) => {
  try {
    const { idTag, evseId } = req.body;
    if (!idTag) {
      return res.status(400).json({ success: false, message: "idTag is required" });
    }

    const { HubjectOicpService } = await import("../../services/HubjectOicpService.js");
    const result = await HubjectOicpService.authorizeStart(idTag, evseId);

    return res.json({ success: result.authorized, data: result });
  } catch (error: any) {
    logger.error(`Error in triggerAuthorizeStart: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manually trigger Hubject CDR submission for a transaction
 */
export const triggerSendCdr = async (req: Request, res: Response) => {
  try {
    const transactionId = String(req.params.transactionId);

    const { HubjectOicpService } = await import("../../services/HubjectOicpService.js");
    const result = await HubjectOicpService.sendChargeDetailRecord(transactionId);

    return res.json({ success: result.success, data: result });
  } catch (error: any) {
    logger.error(`Error in triggerSendCdr: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

