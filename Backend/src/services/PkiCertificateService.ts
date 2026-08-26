import forge from "node-forge";
import crypto from "node:crypto";
import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

const { pki, asn1 } = forge;

export interface Iso15118CertificateHashData {
  hashAlgorithm: "SHA256" | "SHA384" | "SHA512";
  issuerNameHash: string;
  issuerKeyHash: string;
  serialNumber: string;
  responderURL?: string;
}

export interface GeneratedCaResult {
  certificatePem: string;
  privateKeyPem: string;
  publicKeyPem: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  certificateHashData: Iso15118CertificateHashData;
}

export interface SignedCertificateResult {
  certificatePem: string;
  certificateChain: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  certificateHashData: Iso15118CertificateHashData;
}

export class PkiCertificateService {
  private static v2gRootCa: GeneratedCaResult | null = null;
  private static v2gSubCa: GeneratedCaResult | null = null;

  /**
   * Helper to format serial number as uppercase string without colons or spaces
   */
  public static normalizeSerialNumber(serial: string): string {
    return serial.replace(/[:\s-]/g, "").trim().toUpperCase();
  }

  /**
   * Compute SHA-256 hex hash
   */
  public static sha256(data: string | Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
  }

  /**
   * Compute ISO 15118 Certificate Hash Data (issuerNameHash, issuerKeyHash, serialNumber)
   */
  public static compute15118CertificateHashData(certPem: string): Iso15118CertificateHashData {
    try {
      const cert = pki.certificateFromPem(certPem);
      const serialNumber = this.normalizeSerialNumber(cert.serialNumber);

      // 1. Compute Issuer Name SHA-256 Hash (DER encoded issuer DN)
      const issuerAsn1 = pki.distinguishedNameToAsn1(cert.issuer);
      const issuerDer = asn1.toDer(issuerAsn1).getBytes();
      const issuerNameHash = this.sha256(Buffer.from(issuerDer, "binary"));

      // 2. Compute Issuer Key SHA-256 Hash (SubjectPublicKeyInfo DER)
      const publicKeyAsn1 = pki.publicKeyToAsn1(cert.publicKey);
      const publicKeyDer = asn1.toDer(publicKeyAsn1).getBytes();
      const issuerKeyHash = this.sha256(Buffer.from(publicKeyDer, "binary"));

      return {
        hashAlgorithm: "SHA256",
        issuerNameHash,
        issuerKeyHash,
        serialNumber,
      };
    } catch (error) {
      logger.error(`Error computing 15118 certificate hash data: ${error}`);
      // Fallback hash using raw string sha256
      return {
        hashAlgorithm: "SHA256",
        issuerNameHash: this.sha256("IssuerName"),
        issuerKeyHash: this.sha256("IssuerKey"),
        serialNumber: "00",
      };
    }
  }

  /**
   * Generate an X.509 Root CA or Sub-CA KeyPair and Certificate
   */
  public static generateCaKeyPairAndCertificate(options?: {
    commonName?: string;
    organizationName?: string;
    validityDays?: number;
    isV2gRoot?: boolean;
  }): GeneratedCaResult {
    const commonName = options?.commonName || (options?.isV2gRoot ? "V2G Root CA" : "V2G Sub-CA 1");
    const organizationName = options?.organizationName || "Open-Source OCPP-CPMS PKI";
    const validityDays = options?.validityDays || (options?.isV2gRoot ? 3650 : 1825);

    // Generate 2048-bit RSA keypair
    const keypair = pki.rsa.generateKeyPair({ bits: 2048 });
    const cert = pki.createCertificate();

    cert.publicKey = keypair.publicKey;
    cert.serialNumber = Math.floor(Math.random() * 10000000000).toString(16);

    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);

    cert.validity.notBefore = validFrom;
    cert.validity.notAfter = validTo;

    const attrs = [
      { name: "commonName", value: commonName },
      { name: "organizationName", value: organizationName },
      { name: "countryName", value: "NL" },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      {
        name: "basicConstraints",
        cA: true,
        critical: true,
      },
      {
        name: "keyUsage",
        keyCertSign: true,
        cRLSign: true,
        digitalSignature: true,
        critical: true,
      },
      {
        name: "subjectKeyIdentifier",
      },
    ]);

    // Self-sign certificate with SHA-256
    cert.sign(keypair.privateKey, forge.md.sha256.create());

    const certificatePem = pki.certificateToPem(cert);
    const privateKeyPem = pki.privateKeyToPem(keypair.privateKey);
    const publicKeyPem = pki.publicKeyToPem(keypair.publicKey);
    const serialNumber = this.normalizeSerialNumber(cert.serialNumber);

    const certificateHashData = this.compute15118CertificateHashData(certificatePem);

    const result: GeneratedCaResult = {
      certificatePem,
      privateKeyPem,
      publicKeyPem,
      serialNumber,
      validFrom,
      validTo,
      certificateHashData,
    };

    if (options?.isV2gRoot) {
      this.v2gRootCa = result;
    } else {
      this.v2gSubCa = result;
    }

    logger.info(`Generated CA Certificate: ${commonName} (SN: ${serialNumber})`);
    return result;
  }

  /**
   * Get or initialize default V2G Root CA
   */
  public static getV2gRootCa(): GeneratedCaResult {
    if (!this.v2gRootCa) {
      this.v2gRootCa = this.generateCaKeyPairAndCertificate({ isV2gRoot: true });
    }
    return this.v2gRootCa;
  }

  /**
   * Get or initialize default V2G Sub-CA
   */
  public static getV2gSubCa(): GeneratedCaResult {
    if (!this.v2gSubCa) {
      this.v2gSubCa = this.generateCaKeyPairAndCertificate({ isV2gRoot: false });
    }
    return this.v2gSubCa;
  }

  /**
   * Sign a PKCS#10 Certificate Signing Request (CSR)
   */
  public static signCsr(
    csrPem: string,
    caCertPem?: string,
    caPrivateKeyPem?: string,
    validityDays: number = 365,
    options?: { certificateType?: string }
  ): SignedCertificateResult {
    try {
      const ca = !caCertPem || !caPrivateKeyPem ? this.getV2gSubCa() : null;
      const caCert = pki.certificateFromPem(caCertPem || ca!.certificatePem);
      const caKey = pki.privateKeyFromPem(caPrivateKeyPem || ca!.privateKeyPem);

      // Parse PKCS#10 CSR
      const csr = pki.certificationRequestFromPem(csrPem);
      if (!csr.verify()) {
        throw new Error("CSR signature verification failed");
      }

      if (!csr.publicKey) {
        throw new Error("CSR does not contain a valid public key");
      }

      // Create new leaf X.509 certificate
      const cert = pki.createCertificate();
      cert.serialNumber = Math.floor(Math.random() * 10000000000).toString(16);
      cert.publicKey = csr.publicKey;

      const validFrom = new Date();
      const validTo = new Date();
      validTo.setDate(validTo.getDate() + validityDays);

      cert.validity.notBefore = validFrom;
      cert.validity.notAfter = validTo;

      cert.setSubject(csr.subject.attributes);
      cert.setIssuer(caCert.subject.attributes);

      cert.setExtensions([
        {
          name: "basicConstraints",
          cA: false,
        },
        {
          name: "keyUsage",
          digitalSignature: true,
          keyEncipherment: true,
          critical: true,
        },
        {
          name: "extKeyUsage",
          clientAuth: true,
          serverAuth: true,
        },
        {
          name: "subjectKeyIdentifier",
        },
      ]);

      // Sign with CA private key
      cert.sign(caKey, forge.md.sha256.create());

      const certificatePem = pki.certificateToPem(cert);
      const certificateChain = `${certificatePem.trim()}\n${(caCertPem || ca!.certificatePem).trim()}`;
      const serialNumber = this.normalizeSerialNumber(cert.serialNumber);
      const certificateHashData = this.compute15118CertificateHashData(certificatePem);

      logger.info(
        `Signed X.509 Certificate for subject ${csr.subject.getField("CN")?.value || "Unknown"} (Type: ${options?.certificateType || "V2GCertificate"})`
      );

      return {
        certificatePem,
        certificateChain,
        serialNumber,
        validFrom,
        validTo,
        certificateHashData,
      };
    } catch (error) {
      logger.error(`Error in signCsr: ${error}`);
      throw new Error(`Failed to sign CSR: ${error}`);
    }
  }

  /**
   * Validate ISO 15118 Certificate Hash against active Vehicle Contract Certificates
   */
  public static async validate15118CertificateHash(hashData: {
    hashAlgorithm?: string;
    issuerNameHash?: string;
    issuerKeyHash?: string;
    serialNumber?: string;
    responderURL?: string;
  }): Promise<{
    isValid: boolean;
    status: "Accepted" | "Invalid" | "Expired" | "Revoked";
    certificate?: any;
    error?: string;
  }> {
    try {
      const serial = hashData.serialNumber ? this.normalizeSerialNumber(hashData.serialNumber) : null;
      const issuerNameHash = hashData.issuerNameHash?.toUpperCase();
      const issuerKeyHash = hashData.issuerKeyHash?.toUpperCase();

      // Find certificate by serial number or issuer hashes
      const vcc = await prisma.vehicleContractCertificate.findFirst({
        where: {
          OR: [
            ...(serial ? [{ serialNumber: serial }] : []),
            ...(issuerNameHash && issuerKeyHash ? [{ issuerNameHash, issuerKeyHash }] : []),
          ],
        },
        include: { user: true, rfidUser: true },
      });

      if (!vcc) {
        logger.warn(`No Vehicle Contract Certificate found for serial ${serial || "N/A"}`);
        return { isValid: false, status: "Invalid", error: "Certificate not found in database" };
      }

      if (vcc.status === "Revoked") {
        logger.warn(`Vehicle Contract Certificate ${vcc.emaid} is Revoked`);
        return { isValid: false, status: "Revoked", certificate: vcc, error: "Certificate is revoked" };
      }

      if (vcc.status === "Expired" || new Date(vcc.expirationDate) < new Date()) {
        logger.warn(`Vehicle Contract Certificate ${vcc.emaid} has Expired`);
        return { isValid: false, status: "Expired", certificate: vcc, error: "Certificate has expired" };
      }

      logger.info(`Valid ISO 15118 Certificate verified for eMAID ${vcc.emaid} (User: ${vcc.user?.name || vcc.userId})`);
      return { isValid: true, status: "Accepted", certificate: vcc };
    } catch (error) {
      logger.error(`Error validating 15118 certificate hash: ${error}`);
      return { isValid: false, status: "Invalid", error: "Internal validation error" };
    }
  }

  /**
   * Issue and store a new Vehicle Contract Certificate in the database
   */
  public static async issueVehicleContractCertificate(data: {
    userId: number;
    emaid: string;
    validityDays?: number;
    macAddress?: string;
  }): Promise<any> {
    const validityDays = data.validityDays || 730; // 2 years
    const subCa = this.getV2gSubCa();

    // Generate vehicle keypair and CSR
    const vehicleKeypair = pki.rsa.generateKeyPair({ bits: 2048 });
    const csr = pki.createCertificationRequest();
    csr.publicKey = vehicleKeypair.publicKey;
    csr.setSubject([
      { name: "commonName", value: data.emaid },
      { name: "organizationName", value: "Open-Source OCPP-CPMS Plug & Charge" },
    ]);
    csr.sign(vehicleKeypair.privateKey, forge.md.sha256.create());

    const csrPem = pki.certificationRequestToPem(csr);
    const signed = this.signCsr(csrPem, subCa.certificatePem, subCa.privateKeyPem, validityDays, {
      certificateType: "V2GCertificate",
    });

    const record = await prisma.vehicleContractCertificate.upsert({
      where: { emaid: data.emaid },
      create: {
        userId: data.userId,
        emaid: data.emaid,
        macAddress: data.macAddress,
        contractCert: signed.certificatePem,
        contractCertChain: signed.certificateChain,
        status: "Valid",
        expirationDate: signed.validTo,
        issuerNameHash: signed.certificateHashData.issuerNameHash,
        issuerKeyHash: signed.certificateHashData.issuerKeyHash,
        serialNumber: signed.serialNumber,
      },
      update: {
        userId: data.userId,
        macAddress: data.macAddress,
        contractCert: signed.certificatePem,
        contractCertChain: signed.certificateChain,
        status: "Valid",
        expirationDate: signed.validTo,
        issuerNameHash: signed.certificateHashData.issuerNameHash,
        issuerKeyHash: signed.certificateHashData.issuerKeyHash,
        serialNumber: signed.serialNumber,
      },
    });

    logger.info(`Issued Vehicle Contract Certificate for EMAID: ${data.emaid}`);
    return record;
  }

  /**
   * Check for certificates expiring within threshold days
   */
  public static async checkExpiringCertificates(thresholdDays: number = 30): Promise<any[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() + thresholdDays);

    const expiring = await prisma.vehicleContractCertificate.findMany({
      where: {
        status: "Valid",
        expirationDate: {
          lte: expirationThreshold,
          gte: new Date(),
        },
      },
      include: { user: true },
    });

    return expiring;
  }
}
