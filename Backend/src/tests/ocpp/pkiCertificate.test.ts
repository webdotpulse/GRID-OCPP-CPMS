import { jest } from "@jest/globals";
import forge from "node-forge";

const mockPrismaVccFindFirst = jest.fn() as any;
const mockPrismaVccFindUnique = jest.fn() as any;
const mockPrismaVccFindMany = jest.fn() as any;
const mockPrismaVccUpsert = jest.fn() as any;
const mockPrismaInstalledCertCreate = jest.fn() as any;
const mockPrismaInstalledCertFindMany = jest.fn() as any;
const mockPrismaInstalledCertDeleteMany = jest.fn() as any;
const mockPrismaChargerFindUnique = jest.fn() as any;
const mockPrismaChargeGroupUserFindUnique = jest.fn() as any;
const mockPrismaRfidFindUnique = jest.fn() as any;
const mockPrismaOcppLogCreate = jest.fn() as any;

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    vehicleContractCertificate: {
      findFirst: mockPrismaVccFindFirst,
      findUnique: mockPrismaVccFindUnique,
      findMany: mockPrismaVccFindMany,
      upsert: mockPrismaVccUpsert,
    },
    installedCertificate: {
      create: mockPrismaInstalledCertCreate,
      findMany: mockPrismaInstalledCertFindMany,
      deleteMany: mockPrismaInstalledCertDeleteMany,
    },
    charger: {
      findUnique: mockPrismaChargerFindUnique,
    },
    chargeGroupUser: {
      findUnique: mockPrismaChargeGroupUserFindUnique,
    },
    rfidUser: {
      findUnique: mockPrismaRfidFindUnique,
    },
    ocppLog: {
      create: mockPrismaOcppLogCreate,
    },
  },
}));

jest.unstable_mockModule("../../config/redis.js", () => ({
  redisPublisher: {
    publish: jest.fn().mockResolvedValue(1 as never),
  },
  redisSubscriber: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    psubscribe: jest.fn(),
    on: jest.fn(),
  },
  redisClient: {
    get: jest.fn().mockResolvedValue(null as never),
    set: jest.fn().mockResolvedValue("OK" as never),
    del: jest.fn().mockResolvedValue(1 as never),
    hset: jest.fn().mockResolvedValue(1 as never),
    hget: jest.fn().mockResolvedValue(null as never),
    expire: jest.fn().mockResolvedValue(1 as never),
    exists: jest.fn().mockResolvedValue(1 as never),
  },
}));

jest.unstable_mockModule("../../ocpp/distributedRemoteControl.js", () => ({
  sendDistributedOcppCall: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  sendDistributedRemoteCommand: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  getChargerProtocol: jest.fn().mockResolvedValue("ocpp2.1" as never),
  generateMessageId: () => "msg_test_pki",
  distributedPendingRequests: new Map(),
}));

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => ({
  certificateSigned: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  installCertificate: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  deleteCertificate: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  getInstalledCertificateIds: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  clearChargingProfile: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  setChargingProfile: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
}));

jest.unstable_mockModule("../../queues/queueManager.js", () => ({
  enqueueMeterValue: jest.fn().mockResolvedValue("job-1" as never),
  enqueueStatusEvent: jest.fn().mockResolvedValue("job-2" as never),
  enqueueBillingEvent: jest.fn().mockResolvedValue("job-3" as never),
  enqueueBillingJob: jest.fn().mockResolvedValue("job-4" as never),
  getBullMqRedisConnection: jest.fn().mockReturnValue({}),
  defaultJobOptions: {},
  DEFAULT_JOB_OPTIONS: {},
}));

describe("ISO 15118 Plug & Charge PKI Pipeline (PRT-01)", () => {
  let PkiCertificateService: any;
  let v21Handlers: any;

  beforeAll(async () => {
    const pkiMod = await import("../../services/PkiCertificateService.js");
    PkiCertificateService = pkiMod.PkiCertificateService;
    v21Handlers = await import("../../ocpp/handlers/v21Handlers.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PkiCertificateService core cryptographic operations", () => {
    it("should generate valid X.509 Root CA and Sub-CA certificates", () => {
      const rootCa = PkiCertificateService.generateCaKeyPairAndCertificate({
        isV2gRoot: true,
        commonName: "Test V2G Root CA",
      });

      expect(rootCa.certificatePem).toContain("BEGIN CERTIFICATE");
      expect(rootCa.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
      expect(rootCa.serialNumber).toBeDefined();
      expect(rootCa.certificateHashData.hashAlgorithm).toBe("SHA256");
      expect(rootCa.certificateHashData.issuerNameHash).toHaveLength(64);
      expect(rootCa.certificateHashData.issuerKeyHash).toHaveLength(64);

      const subCa = PkiCertificateService.generateCaKeyPairAndCertificate({
        isV2gRoot: false,
        commonName: "Test V2G Sub-CA",
      });
      expect(subCa.certificatePem).toContain("BEGIN CERTIFICATE");
      expect(subCa.validTo.getTime()).toBeGreaterThan(Date.now());
    });

    it("should sign a PKCS#10 Certificate Signing Request (CSR)", () => {
      const subCa = PkiCertificateService.getV2gSubCa();

      // Generate a test CSR using forge
      const clientKeypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = clientKeypair.publicKey;
      csr.setSubject([{ name: "commonName", value: "EVSE-001-V2G" }]);
      csr.sign(clientKeypair.privateKey, forge.md.sha256.create());

      const csrPem = forge.pki.certificationRequestToPem(csr);

      const signed = PkiCertificateService.signCsr(
        csrPem,
        subCa.certificatePem,
        subCa.privateKeyPem,
        365,
        { certificateType: "V2GCertificate" }
      );

      expect(signed.certificatePem).toContain("BEGIN CERTIFICATE");
      expect(signed.certificateChain).toContain(subCa.certificatePem.trim());
      expect(signed.serialNumber).toBeDefined();
      expect(signed.certificateHashData.issuerNameHash).toBeDefined();
    });

    it("should validate ISO 15118 certificate hash data", async () => {
      const futureDate = new Date(Date.now() + 10000000000);
      mockPrismaVccFindFirst.mockResolvedValue({
        id: 1,
        emaid: "EMAID-DE-V2G-001",
        status: "Valid",
        expirationDate: futureDate,
        serialNumber: "SN123456",
        userId: 10,
        user: { name: "Alice" },
      });

      const res = await PkiCertificateService.validate15118CertificateHash({
        hashAlgorithm: "SHA256",
        serialNumber: "SN123456",
        issuerNameHash: "AABBCC",
        issuerKeyHash: "DDEEFF",
      });

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("Accepted");
      expect(res.certificate.emaid).toBe("EMAID-DE-V2G-001");
    });

    it("should reject expired ISO 15118 certificate", async () => {
      const pastDate = new Date(Date.now() - 10000000);
      mockPrismaVccFindFirst.mockResolvedValue({
        id: 2,
        emaid: "EMAID-EXPIRED",
        status: "Expired",
        expirationDate: pastDate,
        serialNumber: "SN9999",
      });

      const res = await PkiCertificateService.validate15118CertificateHash({
        serialNumber: "SN9999",
      });

      expect(res.isValid).toBe(false);
      expect(res.status).toBe("Expired");
    });

    it("should reject revoked ISO 15118 certificate", async () => {
      mockPrismaVccFindFirst.mockResolvedValue({
        id: 3,
        emaid: "EMAID-REVOKED",
        status: "Revoked",
        expirationDate: new Date(Date.now() + 10000000),
        serialNumber: "SNREVOKED",
      });

      const res = await PkiCertificateService.validate15118CertificateHash({
        serialNumber: "SNREVOKED",
      });

      expect(res.isValid).toBe(false);
      expect(res.status).toBe("Revoked");
    });
  });

  describe("OCPP 2.0.1 / 2.1 ISO 15118 Handlers", () => {
    it("handleAuthorize with ISO 15118 Certificate Hash should accept valid vehicle contract", async () => {
      const futureDate = new Date(Date.now() + 1000000000);
      mockPrismaVccFindFirst.mockResolvedValue({
        id: 1,
        emaid: "DE-V2G-PNC-01",
        status: "Valid",
        expirationDate: futureDate,
        serialNumber: "AUTHSN1",
        userId: 5,
        user: { name: "Bob Test" },
      });
      mockPrismaChargerFindUnique.mockResolvedValue({ charger_id: 1, chargeGroupId: null, isPublic: true });

      const response = await v21Handlers.handleAuthorize(1, {
        iso15118CertificateHashData: {
          hashAlgorithm: "SHA256",
          issuerNameHash: "HASH1",
          issuerKeyHash: "HASH2",
          serialNumber: "AUTHSN1",
        },
      });

      expect(response.idTokenInfo.status).toBe("Accepted");
    });

    it("handleSignCertificate should process charger CSR and return Accepted", async () => {
      const clientKeypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = clientKeypair.publicKey;
      csr.setSubject([{ name: "commonName", value: "CP-CHARGER-1" }]);
      csr.sign(clientKeypair.privateKey, forge.md.sha256.create());
      const csrPem = forge.pki.certificationRequestToPem(csr);

      mockPrismaInstalledCertCreate.mockResolvedValue({ id: 10 });

      const response = await v21Handlers.handleSignCertificate(1, {
        csr: csrPem,
        certificateType: "ChargingStationCertificate",
      });

      expect(response.status).toBe("Accepted");
      expect(mockPrismaInstalledCertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargerId: 1,
            certificateType: "ChargingStationCertificate",
            status: "Accepted",
          }),
        })
      );
    });

    it("handleGetInstalledCertificateIds should return installed certificate hash chain", async () => {
      mockPrismaInstalledCertFindMany.mockResolvedValue([
        {
          certificateType: "V2GRootCertificate",
          certificateHashData: {
            hashAlgorithm: "SHA256",
            issuerNameHash: "NAMEHASH",
            issuerKeyHash: "KEYHASH",
            serialNumber: "SN100",
          },
        },
      ]);

      const response = await v21Handlers.handleGetInstalledCertificateIds(1, {
        certificateType: ["V2GRootCertificate"],
      });

      expect(response.status).toBe("Accepted");
      expect(response.certificateHashDataChain).toHaveLength(1);
      expect(response.certificateHashDataChain[0].certificateType).toBe("V2GRootCertificate");
    });

    it("handleInstallCertificate should store new certificate and return Accepted", async () => {
      const rootCa = PkiCertificateService.getV2gRootCa();
      mockPrismaInstalledCertCreate.mockResolvedValue({ id: 20 });

      const response = await v21Handlers.handleInstallCertificate(1, {
        certificateType: "CSMSRootCertificate",
        certificate: rootCa.certificatePem,
      });

      expect(response.status).toBe("Accepted");
      expect(mockPrismaInstalledCertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargerId: 1,
            certificateType: "CSMSRootCertificate",
            status: "Accepted",
          }),
        })
      );
    });

    it("handleDeleteCertificate should remove matching certificate and return Accepted", async () => {
      mockPrismaInstalledCertDeleteMany.mockResolvedValue({ count: 1 });

      const response = await v21Handlers.handleDeleteCertificate(1, {
        certificateHashData: {
          hashAlgorithm: "SHA256",
          issuerNameHash: "NAMEHASH",
          issuerKeyHash: "KEYHASH",
          serialNumber: "SN100",
        },
      });

      expect(response.status).toBe("Accepted");
      expect(mockPrismaInstalledCertDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            chargerId: 1,
            serialNumber: "SN100",
          },
        })
      );
    });

    it("handleGet15118EVCertificate should return contract certificate chain", async () => {
      mockPrismaVccFindFirst.mockResolvedValue({
        id: 1,
        emaid: "EMAID-PNC-001",
        status: "Valid",
        expirationDate: new Date(Date.now() + 10000000),
        contractCert: "CERT_PEM_DATA",
        contractCertChain: "CERT_CHAIN_DATA",
      });

      const response = await v21Handlers.handleGet15118EVCertificate(1, {
        iso15118SchemaVersion: "urn:iso:15118:2:2013:MsgDef",
        action: "Install",
        exiRequest: "EMAID-PNC-001",
      });

      expect(response.status).toBe("Accepted");
      expect(response.exiResponse).toBe("CERT_CHAIN_DATA");
    });
  });
});
