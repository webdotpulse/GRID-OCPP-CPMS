import JSZip from "jszip";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import qrcode from "qrcode";
import { prisma } from "../config/database.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export interface RfidCardPassData {
  rfid_user_id: number;
  rfid_tag: string;
  name: string;
  cardScope: string;
  company_name?: string | null;
  active: boolean;
}

export interface GoogleWalletPassDetails {
  saveUrl: string;
  token: string;
  qrCodeDataUrl: string;
  rfidTag: string;
  name: string;
  cardScope: string;
  companyName: string;
  active: boolean;
  smartTapValue: string;
  isProductionConfigured: boolean;
  issuerId: string;
  classId: string;
  objectId: string;
}

export class WalletPassService {
  /**
   * Generate an Apple Wallet (.pkpass) binary buffer for a registered RFID card
   */
  public static async generateApplePkPass(rfidCard: RfidCardPassData): Promise<Buffer> {
    const zip = new JSZip();

    // 1. Construct pass.json
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.grid.cpms.rfid",
      serialNumber: `RFID-${rfidCard.rfid_tag}`,
      teamIdentifier: "GRIDCPMS",
      organizationName: "GRID EV Charging Network",
      description: "Digital RFID Charging Pass",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(30, 34, 40)", // #1e2228
      labelColor: "rgb(84, 168, 199)",     // #54a8c7
      logoText: "GRID Charging",
      // Apple Pay / NFC smart tap dictionary for contactless EV charger authorization
      nfc: {
        message: rfidCard.rfid_tag,
      },
      barcodes: [
        {
          format: "PKBarcodeFormatQR",
          message: rfidCard.rfid_tag,
          messageEncoding: "iso-8859-1",
          altText: rfidCard.rfid_tag,
        },
      ],
      storeCard: {
        headerFields: [
          {
            key: "scope",
            label: "SCOPE",
            value: rfidCard.cardScope || "Roaming",
          },
        ],
        primaryFields: [
          {
            key: "cardholder",
            label: "CARDHOLDER",
            value: rfidCard.name || "EV Driver",
          },
        ],
        secondaryFields: [
          {
            key: "rfidTag",
            label: "RFID / EMAID",
            value: rfidCard.rfid_tag,
          },
          {
            key: "status",
            label: "STATUS",
            value: rfidCard.active ? "ACTIVE" : "SUSPENDED",
          },
        ],
        auxiliaryFields: [
          {
            key: "network",
            label: "NETWORK",
            value: rfidCard.company_name || "GRID Open CPMS",
          },
        ],
      },
    };

    const passJsonStr = JSON.stringify(passJson, null, 2);
    zip.file("pass.json", passJsonStr);

    // Minimal 1x1 transparent PNG fallback icons if physical assets not present
    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    zip.file("icon.png", dummyPng);
    zip.file("icon@2x.png", dummyPng);
    zip.file("logo.png", dummyPng);
    zip.file("logo@2x.png", dummyPng);

    // 2. Generate SHA-1 manifest.json
    const manifest: Record<string, string> = {
      "pass.json": crypto.createHash("sha1").update(passJsonStr).digest("hex"),
      "icon.png": crypto.createHash("sha1").update(dummyPng).digest("hex"),
      "icon@2x.png": crypto.createHash("sha1").update(dummyPng).digest("hex"),
      "logo.png": crypto.createHash("sha1").update(dummyPng).digest("hex"),
      "logo@2x.png": crypto.createHash("sha1").update(dummyPng).digest("hex"),
    };

    const manifestStr = JSON.stringify(manifest, null, 2);
    zip.file("manifest.json", manifestStr);

    // 3. Digital signature of manifest (in production, signed via Apple WWDR & Pass Certificate)
    const signature = crypto.createHash("sha256").update(manifestStr).digest();
    zip.file("signature", signature);

    logger.info(`[Wallet] Generated Apple .pkpass for RFID card ${rfidCard.rfid_tag}`);
    return await zip.generateAsync({ type: "nodebuffer" });
  }

  /**
   * Generate Google Wallet "Save to Google Wallet" JWT link
   */
  public static generateGoogleWalletUrl(rfidCard: RfidCardPassData): string {
    const issuerId = config.googleWalletIssuerId || process.env.GOOGLE_WALLET_ISSUER_ID || "3388000000022334455";
    const classId = `${issuerId}.GRID_RFID_PASS_CLASS`;
    const objectId = `${issuerId}.RFID_${rfidCard.rfid_tag.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const clientEmail = config.googleWalletClientEmail || process.env.GOOGLE_WALLET_CLIENT_EMAIL || "grid-cpms@google-wallet.internal";
    const appUrl = process.env.APP_URL || "https://cpms.grid-ev.network";

    const claims = {
      iss: clientEmail,
      aud: "google",
      origins: [appUrl, "http://localhost:3000", "http://localhost:3002"],
      typ: "savetowallet",
      payload: {
        genericObjects: [
          {
            id: objectId,
            classId: classId,
            logo: {
              sourceUri: {
                uri: `${appUrl}/icons/icon-192x192.png`,
              },
              contentDescription: {
                defaultValue: {
                  language: "en-US",
                  value: "GRID EV Charging Logo",
                },
              },
            },
            cardTitle: {
              defaultValue: {
                language: "en-US",
                value: "GRID EV Digital RFID Card",
              },
            },
            subheader: {
              defaultValue: {
                language: "en-US",
                value: "Driver",
              },
            },
            header: {
              defaultValue: {
                language: "en-US",
                value: rfidCard.name || "EV Driver",
              },
            },
            barcode: {
              type: "QR_CODE",
              value: rfidCard.rfid_tag,
              alternateText: rfidCard.rfid_tag,
            },
            smartTap: {
              merchantId: issuerId,
              value: rfidCard.rfid_tag,
            },
            hexBackgroundColor: "#1e2228",
          },
        ],
      },
    };

    const privateKeyRaw = config.googleWalletPrivateKey || process.env.GOOGLE_WALLET_PRIVATE_KEY;
    if (privateKeyRaw) {
      try {
        const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
        const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
        return `https://pay.google.com/gp/v/save/${token}`;
      } catch (err) {
        logger.warn(`Failed to sign Google Wallet JWT with RS256 key: ${err}. Falling back to HS256.`);
      }
    }

    const token = jwt.sign(claims, "grid-wallet-secret-key-2026", { algorithm: "HS256" });
    return `https://pay.google.com/gp/v/save/${token}`;
  }

  /**
   * Generate comprehensive Google Wallet Pass details including dynamic QR Code data URL
   */
  public static async generateGoogleWalletPassDetails(rfidCard: RfidCardPassData): Promise<GoogleWalletPassDetails> {
    const saveUrl = this.generateGoogleWalletUrl(rfidCard);
    const token = saveUrl.replace("https://pay.google.com/gp/v/save/", "");
    const issuerId = config.googleWalletIssuerId || process.env.GOOGLE_WALLET_ISSUER_ID || "3388000000022334455";
    const classId = `${issuerId}.GRID_RFID_PASS_CLASS`;
    const objectId = `${issuerId}.RFID_${rfidCard.rfid_tag.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const isProductionConfigured = Boolean((config.googleWalletPrivateKey || process.env.GOOGLE_WALLET_PRIVATE_KEY) && (config.googleWalletIssuerId || process.env.GOOGLE_WALLET_ISSUER_ID));

    // Generate high-resolution QR code data URL for mobile scan (contains RFID tag / token)
    let qrCodeDataUrl = "";
    try {
      qrCodeDataUrl = await qrcode.toDataURL(rfidCard.rfid_tag, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 320,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (err) {
      logger.error(`Error generating QR code for Google Wallet pass: ${err}`);
    }

    return {
      saveUrl,
      token,
      qrCodeDataUrl,
      rfidTag: rfidCard.rfid_tag,
      name: rfidCard.name,
      cardScope: rfidCard.cardScope || "Roaming",
      companyName: rfidCard.company_name || "GRID Open CPMS",
      active: rfidCard.active,
      smartTapValue: rfidCard.rfid_tag,
      isProductionConfigured,
      issuerId,
      classId,
      objectId,
    };
  }
}

