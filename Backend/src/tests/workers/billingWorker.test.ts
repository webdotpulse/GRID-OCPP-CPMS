import { jest } from '@jest/globals';

const mockPrismaTxFindFirst = jest.fn() as any;
const mockPrismaTxUpdate = jest.fn() as any;
const mockPrismaRfidSessionFindFirst = jest.fn() as any;
const mockPrismaRfidSessionUpdate = jest.fn() as any;
const mockPrismaConnectorFindFirst = jest.fn() as any;
const mockPrismaConnectorUpdate = jest.fn() as any;

const mockPrisma = {
  prisma: {
    transaction: {
      findFirst: mockPrismaTxFindFirst,
      update: mockPrismaTxUpdate,
    },
    rfidSession: {
      findFirst: mockPrismaRfidSessionFindFirst,
      update: mockPrismaRfidSessionUpdate,
    },
    connector: {
      findFirst: mockPrismaConnectorFindFirst,
      update: mockPrismaConnectorUpdate,
    },
  },
};

jest.unstable_mockModule('../../config/database', () => mockPrisma);
jest.unstable_mockModule('../../config/database.js', () => mockPrisma);

const mockCalculateSessionCost = jest.fn() as any;
jest.unstable_mockModule('../../services/DynamicTariffService', () => ({
  DynamicTariffService: {
    calculateSessionCost: mockCalculateSessionCost,
  },
}));
jest.unstable_mockModule('../../services/DynamicTariffService.js', () => ({
  DynamicTariffService: {
    calculateSessionCost: mockCalculateSessionCost,
  },
}));

jest.unstable_mockModule('../../utils/tariffHelpers', () => ({
  getTariffForTransaction: (jest.fn() as any).mockResolvedValue({ electricity_rate: 35 }),
}));
jest.unstable_mockModule('../../utils/tariffHelpers.js', () => ({
  getTariffForTransaction: (jest.fn() as any).mockResolvedValue({ electricity_rate: 35 }),
}));

jest.unstable_mockModule('../../services/LoadManagementService', () => ({
  loadManagementService: {
    balanceSiteLoad: (jest.fn() as any).mockResolvedValue(undefined),
    balanceChargeGroupLoad: (jest.fn() as any).mockResolvedValue(undefined),
  },
}));
jest.unstable_mockModule('../../services/LoadManagementService.js', () => ({
  loadManagementService: {
    balanceSiteLoad: (jest.fn() as any).mockResolvedValue(undefined),
    balanceChargeGroupLoad: (jest.fn() as any).mockResolvedValue(undefined),
  },
}));

class MockQueue {
  add = jest.fn();
  close = jest.fn();
  on = jest.fn();
  constructor(public name: string, public opts: any) {}
}

class MockWorker {
  on = jest.fn();
  close = jest.fn();
  constructor(public name: string, public processor: any, public opts: any) {}
}

jest.unstable_mockModule('bullmq', () => ({
  Queue: MockQueue,
  Worker: MockWorker,
}));

describe('BillingWorker', () => {
  let billingWorkerModule: any;

  beforeAll(async () => {
    billingWorkerModule = await import('../../workers/billingWorker.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate session cost and complete transaction and RFID session', async () => {
    const mockTx = {
      id: 1,
      transactionId: 'TX-1234',
      initialMeterValue: 10000,
      startTime: new Date('2026-08-25T10:00:00Z'),
      connectorName: 'Channel 1',
    };
    mockPrismaTxFindFirst.mockResolvedValue(mockTx);
    mockCalculateSessionCost.mockResolvedValue({
      totalCost: 1500, // in cents
      totalKwh: 30,
      connectionFee: 100,
      energyFee: 1400,
      timeFee: 0,
      idleFee: 0,
    });
    mockPrismaTxUpdate.mockResolvedValue({
      ...mockTx,
      charger: { charging_station_id: 1 },
    });
    mockPrismaConnectorFindFirst.mockResolvedValue({ connector_id: 5 });
    mockPrismaConnectorUpdate.mockResolvedValue({});
    mockPrismaRfidSessionFindFirst.mockResolvedValue({
      id: 10,
      transactionId: 'TX-1234',
      initialMeterValue: 10000,
      startTime: new Date('2026-08-25T10:00:00Z'),
    });
    mockPrismaRfidSessionUpdate.mockResolvedValue({});

    const job: any = {
      id: 'job-billing-1',
      data: {
        chargerId: 1,
        transactionId: 'TX-1234',
        meterStop: 40000, // 30 kWh consumed
        timestamp: '2026-08-25T11:00:00Z',
        idTag: 'RFID-ABC',
        reason: 'EVDisconnected',
      },
    };

    await billingWorkerModule.processBillingJob(job);

    expect(mockCalculateSessionCost).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'TX-1234',
        initialMeterValue: 10000,
        meterStop: 40000,
      })
    );

    expect(mockPrismaTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          finalMeterValue: 40000,
          status: 'completed',
          energyConsumed: 30000,
          totalCost: 1500,
        }),
      })
    );

    expect(mockPrismaConnectorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { connector_id: 5 },
        data: expect.objectContaining({ status: 'Finishing' }),
      })
    );

    expect(mockPrismaRfidSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          finalMeterValue: 40000,
          status: 'completed',
          amountDue: 1500,
        }),
      })
    );
  });
});
