import { jest } from "@jest/globals";

const mockPrismaMeterValueCreate = jest.fn() as any;
const mockPrismaTxFindFirst = jest.fn() as any;
const mockPrismaTxUpdateMany = jest.fn() as any;
const mockPrismaRfidSessionUpdateMany = jest.fn() as any;
const mockPrismaDiagnosticEventCreate = jest.fn() as any;

jest.mock("../../config/database.js", () => ({
  prisma: {
    meterValue: {
      create: mockPrismaMeterValueCreate,
    },
    transaction: {
      findFirst: mockPrismaTxFindFirst,
      updateMany: mockPrismaTxUpdateMany,
    },
    rfidSession: {
      updateMany: mockPrismaRfidSessionUpdateMany,
    },
    diagnosticEvent: {
      create: mockPrismaDiagnosticEventCreate,
    },
  },
}));

jest.mock("bullmq", () => {
  class MockWorker {
    on = jest.fn();
    close = jest.fn().mockResolvedValue(undefined as never);
  }
  class MockQueue {
    add = jest.fn();
    close = jest.fn().mockResolvedValue(undefined as never);
    on = jest.fn();
  }
  return {
    Worker: MockWorker,
    Queue: MockQueue,
  };
});

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK" as never),
  })),
}));

describe("BullMQ meterValuesWorker", () => {
  let meterValuesWorkerModule: any;

  beforeAll(async () => {
    meterValuesWorkerModule = await import("../../workers/meterValuesWorker.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should process meter value telemetry job and compute net session energy", async () => {
    mockPrismaMeterValueCreate.mockResolvedValue({ id: 1 });
    mockPrismaTxFindFirst.mockResolvedValue({
      initialMeterValue: 2000,
    });
    mockPrismaTxUpdateMany.mockResolvedValue({ count: 1 });
    mockPrismaRfidSessionUpdateMany.mockResolvedValue({ count: 1 });

    const job = {
      id: "job-1",
      data: {
        transactionId: "TX-777",
        chargerId: 1,
        connectorId: 1,
        energyValue: 7500,
        powerValue: 11000,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        current_L1: 16,
        current_L2: 0,
        current_L3: 0,
        voltage_L1: 230,
        voltage_L2: 0,
        voltage_L3: 0,
        timestamp: new Date().toISOString(),
      },
    } as any;

    await meterValuesWorkerModule.processMeterValueJob(job);

    expect(mockPrismaMeterValueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "TX-777",
          chargerId: 1,
          energy: 7500,
          power: 11000,
          soc: 80,
          current: 16,
          voltage: 230,
          current_L1: 16,
        }),
      })
    );

    expect(mockPrismaTxFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "TX-777" },
        select: { initialMeterValue: true },
      })
    );

    // Net energy consumed = 7500 - 2000 = 5500
    expect(mockPrismaTxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transactionId: "TX-777", status: { not: "completed" } },
        data: expect.objectContaining({
          energyConsumed: 5500,
          currentPower: 11000,
          soc: 80,
          status: "charging",
        }),
      })
    );
  });

  it("should trigger high temperature diagnostic event if temperature exceeds 80C", async () => {
    mockPrismaMeterValueCreate.mockResolvedValue({ id: 2 });
    mockPrismaTxFindFirst.mockResolvedValue(null);
    mockPrismaTxUpdateMany.mockResolvedValue({ count: 0 });
    mockPrismaRfidSessionUpdateMany.mockResolvedValue({ count: 0 });
    mockPrismaDiagnosticEventCreate.mockResolvedValue({ id: 10 });

    const job = {
      id: "job-2",
      data: {
        transactionId: "TX-HOT",
        chargerId: 5,
        connectorId: 1,
        temperatureValue: 85,
        timestamp: new Date().toISOString(),
      },
    } as any;

    await meterValuesWorkerModule.processMeterValueJob(job);

    expect(mockPrismaDiagnosticEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargerId: 5,
          type: "HighTemperature",
          description: expect.stringContaining("85°C"),
        }),
      })
    );
  });
});
