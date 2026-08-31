import { jest } from "@jest/globals";
import crypto from "crypto";
import { EichrechtOcmfService } from "../../services/EichrechtOcmfService.js";
import { prisma } from "../../config/database.js";

describe("Eichrecht & OCMF Legal Metrology Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse standard pipe-delimited OCMF format", () => {
    const rawOcmf = `OCMF|{"FV":"1.0","TM":"2026-08-31T18:30:00.000+02:00","IS":"EMH-00998811","ES":150.25,"EF":185.75,"RD":[{"TX":"TX-999"}]}|{"SA":"ECDSA-secp256r1-SHA256","SD":"{\\"ES\\":150.25,\\"EF\\":185.75}","PK":"04112233","SI":"30450220..."}`;

    const parsed = EichrechtOcmfService.parseOcmfPayload(rawOcmf);

    expect(parsed.meterSerialNumber).toBe("EMH-00998811");
    expect(parsed.meterStartKwh).toBe(150.25);
    expect(parsed.meterStopKwh).toBe(185.75);
    expect(parsed.totalKwh).toBe(35.5);
    expect(parsed.signatureAlgorithm).toBe("ECDSA-secp256r1-SHA256");
    expect(parsed.publicKeyHex).toBe("04112233");
  });

  it("should cryptographically verify valid ECDSA secp256r1 OCMF signatures", () => {
    // Generate an actual secp256r1 keypair for cryptographic testing
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1", // secp256r1
    });

    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const signedData = JSON.stringify({
      meterSerial: "MTR-TEST-1",
      startKwh: 10.0,
      stopKwh: 35.0,
      timestamp: "2026-08-31T20:00:00Z",
    });

    // Sign with SHA-256
    const signer = crypto.createSign("SHA256");
    signer.update(signedData);
    signer.end();
    const signatureHex = signer.sign(privateKey, "hex");

    const parsedData = {
      version: "1.0",
      meterTimestamp: "2026-08-31T20:00:00Z",
      meterSerialNumber: "MTR-TEST-1",
      meterStartKwh: 10.0,
      meterStopKwh: 35.0,
      totalKwh: 25.0,
      signedData,
      signature: signatureHex,
      signatureAlgorithm: "ECDSA-secp256r1-SHA256",
      publicKeyHex: publicKeyPem,
      rawPayload: signedData,
    };

    const verification = EichrechtOcmfService.verifyOcmfSignature(parsedData);
    expect(verification.isValid).toBe(true);
    expect(verification.error).toBeUndefined();
  });

  it("should reject tampered meter data or invalid signatures", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });

    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const originalData = "Original Meter Data";

    const signer = crypto.createSign("SHA256");
    signer.update(originalData);
    signer.end();
    const signatureHex = signer.sign(privateKey, "hex");

    const tamperedData = {
      version: "1.0",
      meterTimestamp: "2026-08-31T20:00:00Z",
      meterSerialNumber: "MTR-TEST-1",
      meterStartKwh: 10.0,
      meterStopKwh: 999.0, // Tampered!
      totalKwh: 989.0,
      signedData: "Tampered Meter Data",
      signature: signatureHex,
      signatureAlgorithm: "ECDSA-secp256r1-SHA256",
      publicKeyHex: publicKeyPem,
      rawPayload: "Tampered Meter Data",
    };

    const verification = EichrechtOcmfService.verifyOcmfSignature(tamperedData);
    expect(verification.isValid).toBe(false);
    expect(verification.error).toBe("Cryptographic signature mismatch");
  });

  it("should generate compliant S.A.F.E. XML transparency package", () => {
    const xml = EichrechtOcmfService.generateTransparencyXml({
      transactionId: "TX-4001",
      chargerId: 5,
      meterSerialNumber: "EFR-12345",
      publicKey: "04998877",
      meterStartKwh: 100.0,
      meterStopKwh: 145.5,
      totalKwh: 45.5,
      signature: "304502...",
      signatureAlgorithm: "ECDSA-secp256r1-SHA256",
      isVerified: true,
      verifiedAt: new Date(),
      ocmfPayload: "OCMF|...",
    });

    expect(xml).toContain("<TransparencySoftwarePackage");
    expect(xml).toContain("<ComplianceStatus>VERIFIED_COMPLIANT</ComplianceStatus>");
    expect(xml).toContain("<TransactionId>TX-4001</TransactionId>");
    expect(xml).toContain("<TotalBilledKwh>45.5000</TotalBilledKwh>");
  });

  it("should ingest and store Eichrecht record for a Transaction", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

    const payloadObj = {
      TM: "2026-08-31T20:00:00Z",
      IS: "MTR-888",
      ES: 10.0,
      EF: 30.0,
      SD: "meter-data-123",
      PK: publicKeyPem,
      SA: "ECDSA-secp256r1-SHA256",
    };

    const signer = crypto.createSign("SHA256");
    signer.update(payloadObj.SD);
    signer.end();
    (payloadObj as any).SI = signer.sign(privateKey, "hex");

    jest.spyOn(prisma.transaction, "findFirst").mockResolvedValue({
      id: 50,
      transactionId: "TX-888",
    } as any);

    const mockUpsert = jest.spyOn(prisma.eichrechtRecord, "upsert").mockResolvedValue({
      id: 1,
      transactionDbId: 50,
      transactionId: "TX-888",
      chargerId: 10,
      meterSerialNumber: "MTR-888",
      publicKey: publicKeyPem,
      ocmfPayload: JSON.stringify(payloadObj),
      meterStartKwh: 10.0,
      meterStopKwh: 30.0,
      totalKwh: 20.0,
      signature: (payloadObj as any).SI,
      signatureAlgorithm: "ECDSA-secp256r1-SHA256",
      isVerified: true,
      verificationError: null,
      verifiedAt: new Date(),
      xmlProof: "<xml>...</xml>",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const record = await EichrechtOcmfService.ingestAndVerifyTransactionOcmf({
      transactionId: "TX-888",
      chargerId: 10,
      ocmfRaw: payloadObj,
    });

    expect(record.isVerified).toBe(true);
    expect(record.meterSerialNumber).toBe("MTR-888");
    expect(mockUpsert).toHaveBeenCalled();
  });
});
