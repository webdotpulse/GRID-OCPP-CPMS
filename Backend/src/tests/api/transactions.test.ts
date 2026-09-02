import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as transactionsController from '../../api/transactions/transactions.controller.js';

describe("Transactions Controller (FE-03 / Bugfix 404)", () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userRole: 'admin',
      userId: 1,
      params: {},
      query: {},
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("getTransactionById", () => {
    it("should retrieve transaction by OCPP numerical transactionId string (e.g. 1788372586)", async () => {
      mockReq.params = { id: "1788372586" };

      const mockTx = {
        id: 7,
        transactionId: "1788372586",
        charger_id: 10,
        status: "charging",
        energyConsumed: 15400,
        charger: { name: "Fast Charger 1", chargingStation: { name: "Station Alpha" } },
        rfidUser: { name: "Alice", rfid_tag: "TAG-99" },
      };

      const findFirstSpy = jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTx as any);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(findFirstSpy).toHaveBeenCalledWith({
        where: {
          OR: [
            { transactionId: "1788372586" },
            { id: 1788372586 },
          ],
        },
        include: {
          charger: { include: { chargingStation: true } },
          rfidUser: true,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTx,
      });
    });

    it("should retrieve transaction by database primary key id (e.g. 42)", async () => {
      mockReq.params = { id: "42" };

      const mockTx = {
        id: 42,
        transactionId: "OCPP-TX-9988",
        charger_id: 5,
        status: "completed",
        energyConsumed: 45000,
        charger: { name: "Depot Charger" },
      };

      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTx as any);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTx,
      });
    });

    it("should retrieve transaction by UUID transactionId string without failing on integer parsing", async () => {
      const uuid = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";
      mockReq.params = { id: uuid };

      const mockTx = {
        id: 15,
        transactionId: uuid,
        charger_id: 3,
        status: "completed",
      };

      const findFirstSpy = jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTx as any);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(findFirstSpy).toHaveBeenCalledWith({
        where: {
          OR: [{ transactionId: uuid }],
        },
        include: {
          charger: { include: { chargingStation: true } },
          rfidUser: true,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTx,
      });
    });

    it("should fallback to RfidSession if transaction is not in Transaction table", async () => {
      mockReq.params = { id: "1788372370" };

      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      const mockRfidSession = {
        id: 3,
        transactionId: "1788372370",
        charger_id: 2,
        amountDue: 1250,
        status: "completed",
        charger: { name: "Office AC 1" },
        rfidUser: { name: "Bob", rfid_tag: "RFID-442" },
      };

      jest.spyOn(prisma.rfidSession, 'findFirst').mockResolvedValue(mockRfidSession as any);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          transactionId: "1788372370",
          totalCost: 1250,
        }),
      });
    });

    it("should return 404 when transaction is not found in either table", async () => {
      mockReq.params = { id: "999999999" };

      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.rfidSession, 'findFirst').mockResolvedValue(null);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Transaction not found",
      });
    });

    it("should enforce tenant isolation for non-admin users", async () => {
      mockReq.params = { id: "1788372586" };
      mockReq.userRole = "user";
      mockReq.userId = 88;

      const findFirstSpy = jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.rfidSession, 'findFirst').mockResolvedValue(null);

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            charger: { owner_id: 88 },
          }),
        })
      );
    });

    it("should return 400 if param is empty", async () => {
      mockReq.params = { id: "  " };

      await transactionsController.getTransactionById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid transaction ID",
      });
    });
  });

  describe("getRfidSessionById", () => {
    it("should retrieve rfid session by transactionId or id with tenant isolation", async () => {
      mockReq.params = { id: "1788372586" };
      mockReq.userRole = "user";
      mockReq.userId = 42;

      const mockSession = {
        id: 12,
        transactionId: "1788372586",
        charger_id: 1,
      };

      jest.spyOn(prisma.rfidSession, 'findFirst').mockResolvedValue(mockSession as any);

      await transactionsController.getRfidSessionById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession,
      });
    });
  });

  describe("getAllTransactions", () => {
    it("should include idTag in search query", async () => {
      mockReq.query = { search: "TAG-ABC" };

      const findManySpy = jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.transaction, 'count').mockResolvedValue(0);

      await transactionsController.getAllTransactions(mockReq, mockRes);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { idTag: { contains: "TAG-ABC", mode: "insensitive" } },
            ]),
          }),
        })
      );
    });
  });
});
