import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import { processMeterValueJob, processMeterValuesBatch } from '../../workers/meterValuesWorker.js';

describe('MeterValuesWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processMeterValueJob', () => {
    it('should process a single meter value and update transaction', async () => {
      const createManySpy = jest.spyOn(prisma.meterValue, 'createMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({ initialMeterValue: 1000 } as any);
      const updateTxSpy = jest.spyOn(prisma.transaction, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.rfidSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const job: any = {
        id: 'job-test-1',
        data: {
          transactionId: 'TX-100',
          chargerId: 1,
          connectorId: 1,
          energyValue: 6000,
          powerValue: 11000,
          socValue: 80,
          currentValue: 16,
          voltageValue: 230,
          timestamp: new Date().toISOString(),
        },
      };

      await processMeterValueJob(job);

      expect(createManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              transactionId: 'TX-100',
              chargerId: 1,
              energy: 6000,
              power: 11000,
              soc: 80,
            }),
          ]),
          skipDuplicates: true,
        })
      );

      // Session energy = 6000 - 1000 = 5000
      expect(updateTxSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: 'TX-100', status: { not: 'completed' } },
          data: expect.objectContaining({
            energyConsumed: 5000,
            currentPower: 11000,
            soc: 80,
          }),
        })
      );
    });

    it('should create diagnostic event when temperature exceeds 80C', async () => {
      const diagSpy = jest.spyOn(prisma.diagnosticEvent, 'create').mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prisma.meterValue, 'createMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({ initialMeterValue: 0 } as any);
      jest.spyOn(prisma.transaction, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.rfidSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const job: any = {
        id: 'job-test-temp',
        data: {
          transactionId: 'TX-101',
          chargerId: 1,
          connectorId: 1,
          temperatureValue: 85,
          timestamp: new Date().toISOString(),
        },
      };

      await processMeterValueJob(job);

      expect(diagSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargerId: 1,
            connectorId: 1,
            type: 'HighTemperature',
          }),
        })
      );
    });
  });

  describe('processMeterValuesBatch', () => {
    it('should bulk insert meter values and update active transactions', async () => {
      const createManySpy = jest.spyOn(prisma.meterValue, 'createMany').mockResolvedValue({ count: 2 } as any);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({ initialMeterValue: 10000 } as any);
      const updateTxSpy = jest.spyOn(prisma.transaction, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.rfidSession, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const payloads = [
        {
          transactionId: 'TX-200',
          chargerId: 2,
          connectorId: 1,
          energyValue: 15000,
          powerValue: 22000,
          socValue: 50,
          currentValue: 32,
          voltageValue: 230,
          timestamp: new Date().toISOString(),
        },
      ];

      await processMeterValuesBatch(payloads);

      expect(createManySpy).toHaveBeenCalled();
      expect(updateTxSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: 'TX-200', status: { not: 'completed' } },
          data: expect.objectContaining({
            energyConsumed: 5000,
            currentPower: 22000,
            soc: 50,
          }),
        })
      );
    });
  });
});
