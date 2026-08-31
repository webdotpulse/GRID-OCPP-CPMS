import crypto from "crypto";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export interface OcmfParsedData {
  version: string;
  meterTimestamp: string;
  meterSerialNumber: string;
  meterStartKwh: number;
  meterStopKwh: number;
  totalKwh: number;
  signedData: string;
  signature: string;
  signatureAlgorithm: string;
  publicKeyHex: string;
  rawPayload: string;
}

export class EichrechtOcmfService {
  /**
   * Parse raw OCMF string or JSON payload
   * Example: OCMF|{"TM":"2026-08-31T20:00:00.000+02:00","IS":"MTR-88291","ES":120.450,"EF":145.850,"RD":[{"TM":"2026-08-31T20:00:00.000+02:00","TX":"TX-1001"}]}|{"SA":"ECDSA-secp256r1-SHA256","SD":"...","PK":"04a1b2...","SI":"304502..."}
   */
  public static parseOcmfPayload(raw: string | any): OcmfParsedData {
    let rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    let ocmfJson: any = {};
    let sigJson: any = {};
    let signedData = "";

    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      ocmfJson = raw;
      sigJson = raw;
      signedData = raw.SD || JSON.stringify(raw);
    } else if (rawStr.startsWith("OCMF|")) {
      const parts = rawStr.split("|");
      if (parts.length >= 3) {
        try {
          ocmfJson = JSON.parse(parts[1]);
          sigJson = JSON.parse(parts[2]);
          signedData = parts[1]; // Payload that was signed
        } catch {
          throw new Error("Invalid JSON components in pipe-delimited OCMF string");
        }
      } else {
        throw new Error("Malformed OCMF pipe-separated payload");
      }
    } else {
      try {
        const parsed = JSON.parse(rawStr);
        ocmfJson = parsed.data || parsed;
        sigJson = parsed.signatureData || parsed;
        signedData = parsed.SD || parsed.signedData || JSON.stringify(ocmfJson);
      } catch {
        throw new Error("Unsupported OCMF payload format");
      }
    }

    const meterTimestamp = ocmfJson.TM || ocmfJson.timestamp || new Date().toISOString();
    const meterSerialNumber = ocmfJson.IS || ocmfJson.meterSerial || ocmfJson.meterSerialNumber || "UNKNOWN_METER";
    
    // Parse energy values (handling Wh or kWh representations)
    let startKwh = typeof ocmfJson.ES === "number" ? ocmfJson.ES : (parseFloat(ocmfJson.ES) || 0);
    let stopKwh = typeof ocmfJson.EF === "number" ? ocmfJson.EF : (parseFloat(ocmfJson.EF) || (startKwh + (ocmfJson.kwh || 0)));
    
    // If values are in Wh (> 10000), convert to kWh
    if (startKwh > 500000) startKwh = startKwh / 1000;
    if (stopKwh > 500000) stopKwh = stopKwh / 1000;

    const totalKwh = Math.max(0, Math.round((stopKwh - startKwh) * 10000) / 10000);
    const signature = sigJson.SI || sigJson.signature || sigJson.sig || "";
    const signatureAlgorithm = sigJson.SA || sigJson.algorithm || "ECDSA-secp256r1-SHA256";
    const publicKeyHex = sigJson.PK || sigJson.publicKey || ocmfJson.PK || "";

    return {
      version: ocmfJson.FV || "1.0",
      meterTimestamp,
      meterSerialNumber,
      meterStartKwh: startKwh,
      meterStopKwh: stopKwh,
      totalKwh,
      signedData: signedData || rawStr,
      signature,
      signatureAlgorithm,
      publicKeyHex,
      rawPayload: rawStr,
    };
  }

  /**
   * Cryptographically verify ECDSA P-256 / secp256r1 signature against smart meter public key
   */
  public static verifyOcmfSignature(data: OcmfParsedData): { isValid: boolean; error?: string } {
    try {
      if (!data.signature) {
        return { isValid: false, error: "Signature string (SI) is missing" };
      }
      if (!data.publicKeyHex) {
        return { isValid: false, error: "Smart meter public key (PK) is missing" };
      }

      // Format Public Key to SPKI PEM if provided as hex
      let publicKeyPem: string;
      if (data.publicKeyHex.startsWith("-----BEGIN PUBLIC KEY-----")) {
        publicKeyPem = data.publicKeyHex;
      } else {
        // Construct DER SubjectPublicKeyInfo for secp256r1 (P-256)
        const cleanHex = data.publicKeyHex.replace(/\s+/g, "");
        const rawKeyBuf = Buffer.from(cleanHex, "hex");

        // If raw uncompressed 65-byte EC point (0x04 || X || Y)
        if (rawKeyBuf.length === 65 && rawKeyBuf[0] === 0x04) {
          // Wrap with secp256r1 SPKI header: 3059301306072a8648ce3d020106082a8648ce3d030107034200
          const spkiHeader = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
          const spkiDer = Buffer.concat([spkiHeader, rawKeyBuf]);
          publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${spkiDer.toString("base64").match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
        } else {
          // If already full DER in hex
          publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${rawKeyBuf.toString("base64").match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
        }
      }

      // Prepare signature buffer (handles DER or Hex)
      let sigBuf: Buffer;
      if (/^[0-9a-fA-F]+$/.test(data.signature)) {
        sigBuf = Buffer.from(data.signature, "hex");
      } else {
        sigBuf = Buffer.from(data.signature, "base64");
      }

      // ECDSA verification with SHA-256
      const verifier = crypto.createVerify("SHA256");
      verifier.update(data.signedData);
      verifier.end();

      const isValid = verifier.verify(publicKeyPem, sigBuf);
      return { isValid, error: isValid ? undefined : "Cryptographic signature mismatch" };
    } catch (err: any) {
      logger.warn(`[Eichrecht] Verification exception: ${err.message}`);
      return { isValid: false, error: err.message || "Cryptographic verification failed" };
    }
  }

  /**
   * Ingest and verify an Eichrecht OCMF record for a Transaction
   */
  public static async ingestAndVerifyTransactionOcmf(params: {
    transactionId: string;
    chargerId: number;
    ocmfRaw: string | any;
  }) {
    const { transactionId, chargerId, ocmfRaw } = params;

    const parsed = this.parseOcmfPayload(ocmfRaw);
    const verification = this.verifyOcmfSignature(parsed);

    // Look up transaction by string transactionId
    const tx = await prisma.transaction.findFirst({
      where: { transactionId },
    });

    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const xmlProof = this.generateTransparencyXml({
      transactionId,
      chargerId,
      meterSerialNumber: parsed.meterSerialNumber,
      publicKey: parsed.publicKeyHex,
      meterStartKwh: parsed.meterStartKwh,
      meterStopKwh: parsed.meterStopKwh,
      totalKwh: parsed.totalKwh,
      signature: parsed.signature,
      signatureAlgorithm: parsed.signatureAlgorithm,
      isVerified: verification.isValid,
      verifiedAt: verification.isValid ? new Date() : null,
      ocmfPayload: parsed.rawPayload,
    });

    const record = await prisma.eichrechtRecord.upsert({
      where: { transactionDbId: tx.id },
      update: {
        meterSerialNumber: parsed.meterSerialNumber,
        publicKey: parsed.publicKeyHex,
        ocmfPayload: parsed.rawPayload,
        meterStartKwh: parsed.meterStartKwh,
        meterStopKwh: parsed.meterStopKwh,
        totalKwh: parsed.totalKwh,
        signature: parsed.signature,
        signatureAlgorithm: parsed.signatureAlgorithm,
        isVerified: verification.isValid,
        verificationError: verification.error || null,
        verifiedAt: verification.isValid ? new Date() : null,
        xmlProof,
      },
      create: {
        transactionDbId: tx.id,
        transactionId,
        chargerId,
        meterSerialNumber: parsed.meterSerialNumber,
        publicKey: parsed.publicKeyHex,
        ocmfPayload: parsed.rawPayload,
        meterStartKwh: parsed.meterStartKwh,
        meterStopKwh: parsed.meterStopKwh,
        totalKwh: parsed.totalKwh,
        signature: parsed.signature,
        signatureAlgorithm: parsed.signatureAlgorithm,
        isVerified: verification.isValid,
        verificationError: verification.error || null,
        verifiedAt: verification.isValid ? new Date() : null,
        xmlProof,
      },
    });

    logger.info(
      `[Eichrecht] Record stored for TX ${transactionId}. Verified: ${verification.isValid} (Meter: ${parsed.meterSerialNumber}, Total: ${parsed.totalKwh} kWh)`
    );

    return record;
  }

  /**
   * Generate S.A.F.E. Transparency Software XML package
   */
  public static generateTransparencyXml(record: {
    transactionId: string;
    chargerId: number;
    meterSerialNumber: string;
    publicKey: string;
    meterStartKwh: number;
    meterStopKwh: number;
    totalKwh: number;
    signature: string;
    signatureAlgorithm: string;
    isVerified: boolean;
    verifiedAt: Date | null;
    ocmfPayload: string;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TransparencySoftwarePackage xmlns="http://safe-ev.org/transparency/1.0" version="1.0">
  <Header>
    <Standard>OCMF / MessEG Legal Metrology</Standard>
    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>
    <ComplianceStatus>${record.isVerified ? "VERIFIED_COMPLIANT" : "UNVERIFIED"}</ComplianceStatus>
  </Header>
  <ChargingSession>
    <TransactionId>${record.transactionId}</TransactionId>
    <ChargerId>${record.chargerId}</ChargerId>
    <MeterSerialNumber>${record.meterSerialNumber}</MeterSerialNumber>
    <PublicKeyHex>${record.publicKey}</PublicKeyHex>
    <EnergyStartKwh>${record.meterStartKwh.toFixed(4)}</EnergyStartKwh>
    <EnergyStopKwh>${record.meterStopKwh.toFixed(4)}</EnergyStopKwh>
    <TotalBilledKwh>${record.totalKwh.toFixed(4)}</TotalBilledKwh>
  </ChargingSession>
  <LegalMetrologyProof>
    <SignatureAlgorithm>${record.signatureAlgorithm}</SignatureAlgorithm>
    <CryptographicSignature>${record.signature}</CryptographicSignature>
    <RawOCMFData><![CDATA[${record.ocmfPayload}]]></RawOCMFData>
  </LegalMetrologyProof>
</TransparencySoftwarePackage>`;
  }
}
