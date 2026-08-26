import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import { processBillingJob } from '../../workers/billingWorker.js';
import { DynamicTariffService } from '../../services/DynamicTariffService.js';
import * as tariffHelpers from '../../utils/tariffHelpers.js';
import { loadManagementService } from '../../services/LoadManagementService.js';

describe('BillingWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate session cost and complete transaction and RFID session', async () => {
    const mockTx = {
      id: 10,
      transactionId: 'TX-100',
      charger_id: 1,
      connectorName: 'Channel 1',
      initialMeterValue: 1000,
      startTime: new Date(Date.now() - 3600000), // 1 hr ago
      rfidUserId: 5,
      charger: { charger_id: 1, charging_station_id: 10, chargeGroupId: null },
    };

    const findFirstTxSpy = jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(mockTx as any);
    const updateTxSpy = jest.spyOn(prisma.transaction, 'update').mockResolvedValue({
      ...mockTx,
      status: 'completed',
      finalMeterValue: 5000,
      energyConsumed: 4000,
    } as any);

    const findFirstRfidSpy = jest.spyOn(prisma.rfidSession, 'findFirst').mockResolvedValue({
      id: 99,
      transactionId: 'TX-100',
      status: 'active',
    } as any);

    const updateRfidSpy = jest.spyOn(prisma.rfidSession, 'update').mockResolvedValue({} as any);

    const findFirstConnSpy = jest.spyOn(prisma.connector, 'findFirst').mockResolvedValue({
      connector_id: 2,
      status: 'Occupied',
    } as any);

    const updateConnSpy = jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);

    jest.spyOn(tariffHelpers, 'getTariffForTransaction').mockResolvedValue({
      tariff_id: 1,
      electricity_rate: 0.35,
    } as any);

    jest.spyOn(DynamicTariffService, 'calculateSessionCost').mockResolvedValue({
      totalCost: 1.40,
      energyCost: 1.40,
      connectionFee: 0,
      timeCost: 0,
      idleCost: 0,
    } as any);

    jest.spyOn(loadManagementService, 'balanceSiteLoad').mockResolvedValue(undefined as any);
    jest.spyOn(loadManagementService, 'balanceChargeGroupLoad').mockResolvedValue(undefined as any);

    const job = {
      id: 'job-1',
      data: {
        chargerId: 1,
        transactionId: 'TX-100',
        meterStop: 5000,
        timestamp: new Date().toISOString(),
        reason: 'Local',
      },
    } as any;

    await processBillingJob(job);

    expect(findFirstTxSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transactionId: 'TX-100' } })
    );

    expect(updateTxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          status: 'completed',
          finalMeterValue: 5000,
          energyConsumed: 4000, // 5000 - 1000
        }),
      })
    );

    expect(updateRfidSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99 },
        data: expect.objectContaining({
          finalMeterValue: 5000,
          status: 'completed',
        }),
      })
    );
  });
});
