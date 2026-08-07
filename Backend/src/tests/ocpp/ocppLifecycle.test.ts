import { jest } from '@jest/globals';

const mockPrismaChargerUpdate = jest.fn() as any;
const mockPrismaChargerFindUnique = jest.fn() as any;
const mockPrismaRfidFindUnique = jest.fn() as any;
const mockPrismaTxCreate = jest.fn() as any;
const mockPrismaTxUpdate = jest.fn() as any;

jest.unstable_mockModule('../../config/database.js', () => ({
  prisma: {
    charger: {
      update: mockPrismaChargerUpdate,
      findUnique: mockPrismaChargerFindUnique,
    },
    rfidUser: {
      findUnique: mockPrismaRfidFindUnique,
    },
    transaction: {
      create: mockPrismaTxCreate,
      update: mockPrismaTxUpdate,
    },
  },
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    publish: jest.fn(),
  },
}));

const importPromise = import('../../ocpp/handlers/v16Handlers.js');

describe("OCPP 1.6 Lifecycle Handlers", () => {
  let v16Handlers: any;

  beforeAll(async () => {
    v16Handlers = await importPromise;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleBootNotification", () => {
    it("should accept boot notification and update charger status", async () => {
      mockPrismaChargerUpdate.mockResolvedValue({ charger_id: 1, name: "CP-001" });

      const response = await v16Handlers.handleBootNotification(1, {
        chargePointVendor: "TestVendor",
        chargePointModel: "TestModel",
        firmwareVersion: "v1.0.0",
      });

      expect(response.status).toBe("Accepted");
      expect(response.heartbeatInterval).toBeGreaterThan(0);
      expect(mockPrismaChargerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { charger_id: 1 },
          data: expect.objectContaining({
            status: "Available",
            consecutiveErrors: 0,
          }),
        })
      );
    });
  });

  describe("handleAuthorize", () => {
    it("should return Accepted for a valid RFID tag", async () => {
      mockPrismaRfidFindUnique.mockResolvedValue({
        rfid_tag: "TAG123456",
        status: "active",
        expiry_date: new Date(Date.now() + 86400000),
      });

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "TAG123456",
      });

      expect(response.idTagInfo.status).toBe("Accepted");
    });

    it("should return Invalid for an unknown RFID tag", async () => {
      mockPrismaRfidFindUnique.mockResolvedValue(null);

      const response = await v16Handlers.handleAuthorize(1, {
        idTag: "UNKNOWN_TAG",
      });

      expect(response.idTagInfo.status).toBe("Invalid");
    });
  });
});
