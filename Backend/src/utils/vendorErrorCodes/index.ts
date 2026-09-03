/**
 * Unified Multi-Vendor EV Charger Error Code & Diagnostic Resolution Service
 * Supports: Alfen, Easee, Zaptec, Peblar, Raedian
 */

import { getAlfenErrorInfo, AlfenErrorCodeInfo } from "./alfenErrorCodes.js";
import { getEaseeReasonInfo, EaseeReasonInfo } from "./easeeErrorCodes.js";
import { getZaptecErrorInfo, decodeZaptecBitmask, ZaptecBitmaskFlag } from "./zaptecErrorCodes.js";
import { getPeblarCodeInfo, PeblarCodeInfo } from "./peblarErrorCodes.js";
import { getRaedianErrorInfo, RaedianErrorCodeInfo } from "../raedianErrorCodes.js";

export * from "./alfenErrorCodes.js";
export * from "./easeeErrorCodes.js";
export * from "./zaptecErrorCodes.js";
export * from "./peblarErrorCodes.js";

export interface UnifiedVendorErrorInfo {
  vendor: "Alfen" | "Easee" | "Zaptec" | "Peblar" | "Raedian" | "Generic";
  code: string;
  name: string;
  description: string;
  action: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "PowerElectronics" | "GridFault" | "Thermal" | "ConnectorLock" | "Communications" | "General";
  ocppErrorCodeMapped: string;
  isHealthy?: boolean;
  isWarning?: boolean;
}

/**
 * Resolves vendor-specific error codes into standardized unified diagnostic metadata
 */
export function getUnifiedVendorErrorInfo(
  vendor?: string | null,
  vendorErrorCode?: string | number | null,
  rawText?: string | null
): UnifiedVendorErrorInfo | undefined {
  const codeStr = vendorErrorCode !== undefined && vendorErrorCode !== null ? String(vendorErrorCode).trim() : "";
  const combinedText = [codeStr, rawText].filter(Boolean).join(" ");
  const vendorNorm = (vendor || "").trim().toLowerCase();

  // 1. ALFEN
  if (vendorNorm.includes("alfen") || (!vendorNorm && /^(10[1-9]|20[1-9]|21[1-4]|30[1-4]|40[1-5])$/.test(codeStr))) {
    const alfen = getAlfenErrorInfo(codeStr || combinedText);
    if (alfen) {
      return {
        vendor: "Alfen",
        code: alfen.code,
        name: alfen.name,
        description: alfen.description,
        action: alfen.action,
        severity: alfen.severity,
        category: alfen.category,
        ocppErrorCodeMapped: alfen.ocppErrorCodeMapped,
      };
    }
  }

  // 2. EASEE
  if (vendorNorm.includes("easee") || (!vendorNorm && /^(0|1|2|3|4|7|8|9|10|11|25|53|54|55|56|57|75|79|81|100)$/.test(codeStr))) {
    const easee = getEaseeReasonInfo(codeStr || combinedText);
    if (easee) {
      return {
        vendor: "Easee",
        code: String(easee.code),
        name: easee.enumName,
        description: easee.meaning,
        action: easee.action,
        severity: easee.severity,
        category: easee.category,
        ocppErrorCodeMapped: easee.ocppErrorCodeMapped,
        isHealthy: easee.isHealthy,
      };
    }
  }

  // 3. ZAPTEC
  if (vendorNorm.includes("zaptec") || (!vendorNorm && /^(1|2|8|256|65536|134217728)$/.test(codeStr))) {
    const zaptec = getZaptecErrorInfo(codeStr || combinedText);
    if (zaptec && zaptec.primaryFlag) {
      return {
        vendor: "Zaptec",
        code: codeStr,
        name: zaptec.primaryFlag.name,
        description: zaptec.summary,
        action: zaptec.primaryFlag.action,
        severity: zaptec.primaryFlag.severity,
        category: zaptec.primaryFlag.category,
        ocppErrorCodeMapped: zaptec.primaryFlag.ocppErrorCodeMapped,
      };
    }
  }

  // 4. PEBLAR
  if (vendorNorm.includes("peblar") || (!vendorNorm && /^(100[0-5]|105[0-9]|106[15]|125[2-6]|10[023][0-9]{2})$/.test(codeStr))) {
    const peblar = getPeblarCodeInfo(codeStr || combinedText);
    if (peblar) {
      return {
        vendor: "Peblar",
        code: peblar.code,
        name: peblar.name,
        description: peblar.description,
        action: peblar.resolution,
        severity: peblar.severity,
        category: peblar.category,
        ocppErrorCodeMapped: peblar.ocppErrorCodeMapped,
        isWarning: peblar.type === "Warning",
      };
    }
  }

  // 5. RAEDIAN
  if (vendorNorm.includes("raedian") || (!vendorNorm && (/^0x[0-9a-f]{4}$/i.test(codeStr) || /^E0[0-9a-f]{4}$/i.test(codeStr)))) {
    const raedian = getRaedianErrorInfo(codeStr || combinedText);
    if (raedian) {
      return {
        vendor: "Raedian",
        code: raedian.code,
        name: raedian.errorType,
        description: raedian.possibleReason,
        action: raedian.solution,
        severity: raedian.severity,
        category: raedian.category,
        ocppErrorCodeMapped: raedian.ocppErrorCodeMapped,
      };
    }
  }

  return undefined;
}

/**
 * Formats a clean, readable one-line diagnostic summary for any supported vendor
 */
export function formatUnifiedVendorDiagnostic(
  vendor?: string | null,
  vendorErrorCode?: string | number | null,
  rawText?: string | null
): string | undefined {
  const info = getUnifiedVendorErrorInfo(vendor, vendorErrorCode, rawText);
  if (!info) return undefined;
  return `[${info.vendor} ${info.code}] ${info.name} - Reason: ${info.description} | Action: ${info.action}`;
}
