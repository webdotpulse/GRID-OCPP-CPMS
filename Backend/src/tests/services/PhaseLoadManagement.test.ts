import { jest } from "@jest/globals";

const mockPrismaChargeGroupFindUnique = jest.fn() as any;
const mockPrismaTransactionFindMany = jest.fn() as any;
const mockPrismaMeterValueFindFirst = jest.fn() as any;
const mockPrismaChargingProfileFindMany = jest.fn() as any;
const mockPrismaChargingProfileFindUnique = jest.fn() as any;
const mockPrismaChargingProfileUpsert = jest.fn() as any;
const mockPrismaChargingProfileDeleteMany = jest.fn() as any;

jest.mock("../../config/database.js", () => ({
  prisma: {
    chargeGroup: {
      findUnique: mockPrismaChargeGroupFindUnique,
      findMany: jest.fn().mockResolvedValue([] as never),
    },
    transaction: {
      findMany: mockPrismaTransactionFindMany,
      aggregate: jest.fn().mockResolvedValue({ _sum: { currentPower: 0 } } as never),
    },
    meterValue: {
      findFirst: mockPrismaMeterValueFindFirst,
    },
    chargingProfile: {
      findMany: mockPrismaChargingProfileFindMany,
      findUnique: mockPrismaChargingProfileFindUnique,
      upsert: mockPrismaChargingProfileUpsert,
      deleteMany: mockPrismaChargingProfileDeleteMany,
    },
    chargingStation: {
      findUnique: jest.fn().mockResolvedValue(null as never),
    },
  },
}));

jest.mock("../../config/redis.js", () => ({
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

jest.mock("../../ocpp/distributedRemoteControl.js", () => ({
  sendDistributedOcppCall: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  sendDistributedRemoteCommand: jest.fn().mockResolvedValue({ status: "Accepted" } as never),
  getChargerProtocol: jest.fn().mockResolvedValue("ocpp1.6" as never),
  generateMessageId: () => "msg_test_dlb",
  distributedPendingRequests: new Map(),
}));

describe("Hierarchical 3-Phase Dynamic Load Balancing & Phase Unbalance Mitigation (ENG-01)", () => {
  let loadManagementService: any;

  beforeAll(async () => {
    const mod = await import("../../services/LoadManagementService.js");
    loadManagementService = mod.loadManagementService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return balanced when there are no active transactions in the group", async () => {
    mockPrismaChargeGroupFindUnique.mockResolvedValue({
      id: 1,
      maxPhaseCurrent: 80.0,
      maxPhaseUnbalance: 16.0,
    });
    mockPrismaTransactionFindMany.mockResolvedValue([]);

    const result = await loadManagementService.balancePhasesForGroup(1);

    expect(result.balanced).toBe(true);
    expect(result.phaseLoads).toEqual({ L1: 0, L2: 0, L3: 0 });
    expect(result.unbalance).toBe(0);
  });

  it("should detect severe phase unbalance and throttle single-phase vehicles on the overloaded phase", async () => {
    mockPrismaChargeGroupFindUnique.mockResolvedValue({
      id: 1,
      name: "Fleet Depot Group",
      maxPhaseCurrent: 80.0,
      maxPhaseUnbalance: 16.0,
    });

    // 3 active transactions:
    // Tx 1: Charger 1, 1-Phase on L1, drawing 32A
    // Tx 2: Charger 2, 1-Phase on L1, drawing 32A
    // Tx 3: Charger 3, 3-Phase on L1-L2-L3, drawing 10A per phase
    // Phase loads: L1 = 74A, L2 = 10A, L3 = 10A. Unbalance = 64A > 16A!
    mockPrismaTransactionFindMany.mockResolvedValue([
      {
        id: 1,
        transactionId: "TX-101",
        charger_id: 1,
        connector_id: 1,
        current: 32,
        charger: {
          charger_id: 1,
          evses: [
            {
              evse_id: 1,
              connectors: [{ connector_id: 1, phaseConnection: "L1" }],
            },
          ],
        },
      },
      {
        id: 2,
        transactionId: "TX-102",
        charger_id: 2,
        connector_id: 1,
        current: 32,
        charger: {
          charger_id: 2,
          evses: [
            {
              evse_id: 1,
              connectors: [{ connector_id: 1, phaseConnection: "L1" }],
            },
          ],
        },
      },
      {
        id: 3,
        transactionId: "TX-103",
        charger_id: 3,
        connector_id: 1,
        current: 10,
        charger: {
          charger_id: 3,
          evses: [
            {
              evse_id: 1,
              connectors: [{ connector_id: 1, phaseConnection: "L1-L2-L3" }],
            },
          ],
        },
      },
    ]);

    mockPrismaMeterValueFindFirst.mockResolvedValue(null);
    mockPrismaChargingProfileUpsert.mockResolvedValue({ id: 1 });

    const result = await loadManagementService.balancePhasesForGroup(1);

    expect(result.balanced).toBe(false);
    expect(result.isUnbalanced).toBe(true);
    expect(result.maxPhase).toBe("L1");
    expect(result.phaseLoads.L1).toBe(74);
    expect(result.phaseLoads.L2).toBe(10);
    expect(result.phaseLoads.L3).toBe(10);
    expect(result.unbalance).toBe(64);

    // Should take action on single-phase chargers on L1
    expect(result.actionsTaken.length).toBeGreaterThan(0);
    expect(result.actionsTaken[0].phaseConnection).toBe("L1");
    expect(result.actionsTaken[0].newLimitAmps).toBeLessThan(32);

    // Profile 102 should be upserted to database
    expect(mockPrismaChargingProfileUpsert).toHaveBeenCalled();
  });

  it("should detect main breaker phase over-current and apply emergency throttling", async () => {
    mockPrismaChargeGroupFindUnique.mockResolvedValue({
      id: 2,
      name: "High Power Hub",
      maxPhaseCurrent: 80.0,
      maxPhaseUnbalance: 32.0,
    });

    // 3-Phase vehicles drawing 30A each across 3 chargers = 90A on L1, L2, L3 (exceeds 80A!)
    mockPrismaTransactionFindMany.mockResolvedValue([
      {
        id: 1,
        transactionId: "TX-201",
        charger_id: 10,
        connector_id: 1,
        current: 30,
        charger: {
          charger_id: 10,
          evses: [{ evse_id: 1, connectors: [{ connector_id: 1, phaseConnection: "L1-L2-L3" }] }],
        },
      },
      {
        id: 2,
        transactionId: "TX-202",
        charger_id: 11,
        connector_id: 1,
        current: 30,
        charger: {
          charger_id: 11,
          evses: [{ evse_id: 1, connectors: [{ connector_id: 1, phaseConnection: "L1-L2-L3" }] }],
        },
      },
      {
        id: 3,
        transactionId: "TX-203",
        charger_id: 12,
        connector_id: 1,
        current: 30,
        charger: {
          charger_id: 12,
          evses: [{ evse_id: 1, connectors: [{ connector_id: 1, phaseConnection: "L1-L2-L3" }] }],
        },
      },
    ]);

    mockPrismaMeterValueFindFirst.mockResolvedValue(null);
    mockPrismaChargingProfileUpsert.mockResolvedValue({ id: 2 });

    const result = await loadManagementService.balancePhasesForGroup(2);

    expect(result.balanced).toBe(false);
    expect(result.isOverCurrent).toBe(true);
    expect(result.phaseLoads.L1).toBe(90);
    expect(result.actionsTaken.length).toBeGreaterThan(0);
  });

  it("should clear phase unbalance throttling profiles when site is balanced and within limits", async () => {
    mockPrismaChargeGroupFindUnique.mockResolvedValue({
      id: 3,
      name: "Balanced Site",
      maxPhaseCurrent: 80.0,
      maxPhaseUnbalance: 16.0,
    });

    // Balanced loads: L1 = 20A, L2 = 22A, L3 = 18A (Unbalance = 4A <= 16A)
    mockPrismaTransactionFindMany.mockResolvedValue([
      {
        id: 1,
        transactionId: "TX-301",
        charger_id: 20,
        connector_id: 1,
        current: 20,
        charger: {
          charger_id: 20,
          evses: [{ evse_id: 1, connectors: [{ connector_id: 1, phaseConnection: "L1-L2-L3" }] }],
        },
      },
    ]);

    mockPrismaMeterValueFindFirst.mockResolvedValue({
      current_L1: 20,
      current_L2: 22,
      current_L3: 18,
    });

    mockPrismaChargingProfileFindMany.mockResolvedValue([
      { chargerId: 20, chargingProfileId: 102 },
    ]);
    mockPrismaChargingProfileFindUnique.mockResolvedValue({
      chargerId: 20,
      chargingProfileId: 102,
    });
    mockPrismaChargingProfileDeleteMany.mockResolvedValue({ count: 1 });

    const result = await loadManagementService.balancePhasesForGroup(3);

    expect(result.balanced).toBe(true);
    expect(result.isUnbalanced).toBe(false);
    expect(result.isOverCurrent).toBe(false);
    expect(result.phaseLoads.L1).toBe(20);
    expect(result.phaseLoads.L2).toBe(22);
    expect(result.phaseLoads.L3).toBe(18);
    expect(result.unbalance).toBe(4);
  });
});
