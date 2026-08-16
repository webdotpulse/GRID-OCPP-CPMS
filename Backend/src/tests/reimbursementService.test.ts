import { jest } from "@jest/globals";
import { prisma } from "../config/database.js";
import { calculateMonthlyReimbursements } from "../cron/reimbursementCron.js";

describe("Reimbursement Service & Calculation Engine (FIN-01 & FIN-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should calculate monthly reimbursement ledger for fixed tariff contracts", async () => {
    const mockContracts = [
      {
        id: 1,
        userId: 10,
        rfidUserId: 20,
        stationId: 30,
        iban: "BE68539007547034",
        user: { id: 10, name: "Alice Dupont", email: "alice@example.com" },
        rfidUser: { rfid_user_id: 20, rfid_tag: "RFID-ALICE" },
        station: { id: 30, station_name: "Home Charger Alice" },
        tariff: {
          tariff_id: 1,
          tariff_name: "Fixed Rate",
          tariffType: "FIXED",
          electricity_rate: 0.35, // 0.35 EUR / kWh
        },
      },
    ];

    const mockTransactions = [
      {
        id: 101,
        transactionId: "TX-101",
        energyConsumed: 40000, // 40,000 Wh = 40 kWh
        status: "completed",
        startTime: new Date("2026-07-10T10:00:00Z"),
      },
      {
        id: 102,
        transactionId: "TX-102",
        energyConsumed: 60000, // 60,000 Wh = 60 kWh
        status: "completed",
        startTime: new Date("2026-07-20T10:00:00Z"),
      },
    ];

    const findContractsSpy = jest
      .spyOn(prisma.reimbursementContract, "findMany")
      .mockResolvedValue(mockContracts as any);
    const findTxSpy = jest
      .spyOn(prisma.transaction, "findMany")
      .mockResolvedValue(mockTransactions as any);
    const upsertLedgerSpy = jest
      .spyOn(prisma.reimbursementLedger, "upsert")
      .mockResolvedValue({ id: 1 } as any);

    const targetDate = new Date("2026-07-15T00:00:00Z"); // Month 7 (July), Year 2026
    const result = await calculateMonthlyReimbursements(targetDate);

    expect(result.month).toBe(7);
    expect(result.year).toBe(2026);
    expect(result.contractsProcessed).toBe(1);
    expect(result.ledgers.length).toBe(1);

    // Total energy: 40 + 60 = 100 kWh
    expect(result.ledgers[0].totalKwh).toBe(100);
    // Total amount: 100 kWh * 0.35 = 35.00 EUR
    expect(result.ledgers[0].totalAmount).toBe(35.0);

    expect(upsertLedgerSpy).toHaveBeenCalledWith({
      where: {
        contractId_month_year: {
          contractId: 1,
          month: 7,
          year: 2026,
        },
      },
      update: {
        totalKwh: 100,
        totalAmount: 35.0,
      },
      create: {
        contractId: 1,
        month: 7,
        year: 2026,
        totalKwh: 100,
        totalAmount: 35.0,
        status: "pending",
      },
    });

    findContractsSpy.mockRestore();
    findTxSpy.mockRestore();
    upsertLedgerSpy.mockRestore();
  });

  it("should calculate monthly reimbursement for dynamic EPEX contracts", async () => {
    const mockContracts = [
      {
        id: 2,
        userId: 11,
        rfidUserId: 21,
        stationId: 31,
        iban: "NL91ABNA0417164300",
        user: { id: 11, name: "Bob Smith", email: "bob@example.com" },
        rfidUser: { rfid_user_id: 21, rfid_tag: "RFID-BOB" },
        station: { id: 31, station_name: "Home Charger Bob" },
        tariff: {
          tariff_id: 2,
          tariff_name: "Dynamic EPEX",
          tariffType: "DYNAMIC_EPEX",
          electricity_rate: 0.30,
        },
      },
    ];

    const mockTransactions = [
      {
        id: 201,
        transactionId: "TX-201",
        energyConsumed: 50000, // 50 kWh
        totalCost: 1250, // 1250 cents = 12.50 EUR
        status: "completed",
        startTime: new Date("2026-07-05T14:00:00Z"),
      },
      {
        id: 202,
        transactionId: "TX-202",
        energyConsumed: 30000, // 30 kWh
        totalCost: 800, // 800 cents = 8.00 EUR
        status: "completed",
        startTime: new Date("2026-07-18T16:00:00Z"),
      },
    ];

    const findContractsSpy = jest
      .spyOn(prisma.reimbursementContract, "findMany")
      .mockResolvedValue(mockContracts as any);
    const findTxSpy = jest
      .spyOn(prisma.transaction, "findMany")
      .mockResolvedValue(mockTransactions as any);
    const upsertLedgerSpy = jest
      .spyOn(prisma.reimbursementLedger, "upsert")
      .mockResolvedValue({ id: 2 } as any);

    const targetDate = new Date("2026-07-15T00:00:00Z");
    const result = await calculateMonthlyReimbursements(targetDate);

    expect(result.month).toBe(7);
    expect(result.year).toBe(2026);
    expect(result.ledgers[0].totalKwh).toBe(80);
    // Total dynamic cost: 12.50 + 8.00 = 20.50 EUR
    expect(result.ledgers[0].totalAmount).toBe(20.5);

    expect(upsertLedgerSpy).toHaveBeenCalledWith({
      where: {
        contractId_month_year: {
          contractId: 2,
          month: 7,
          year: 2026,
        },
      },
      update: {
        totalKwh: 80,
        totalAmount: 20.5,
      },
      create: {
        contractId: 2,
        month: 7,
        year: 2026,
        totalKwh: 80,
        totalAmount: 20.5,
        status: "pending",
      },
    });

    findContractsSpy.mockRestore();
    findTxSpy.mockRestore();
    upsertLedgerSpy.mockRestore();
  });
});
