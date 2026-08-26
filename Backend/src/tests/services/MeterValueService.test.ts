import { jest } from '@jest/globals';
import { MeterValueService } from '../../services/MeterValueService.js';
import * as queueManager from '../../queues/queueManager.js';
import * as meterValuesWorker from '../../workers/meterValuesWorker.js';

describe("MeterValueService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addMeterValue", () => {
    it("should push payload to BullMQ meter values queue", async () => {
      const enqueueSpy = jest.spyOn(queueManager, 'enqueueMeterValue').mockResolvedValue(undefined as any);

      const timestamp = new Date();
      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        timestamp,
      };

      await MeterValueService.addMeterValue(payload);

      expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({
        transactionId: "TX-100",
        chargerId: 1,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
      }));
    });
  });

  describe("processMeterValuesBatch", () => {
    it("should delegate to worker batch processor", async () => {
      const batchSpy = jest.spyOn(meterValuesWorker, 'processMeterValuesBatch').mockResolvedValue(undefined as any);

      const payloads = [
        {
          transactionId: "TX-999",
          chargerId: 1,
          connectorId: 1,
          energyValue: 2455000,
          powerValue: 11000,
          socValue: 75,
          currentValue: 16,
          voltageValue: 230,
          timestamp: new Date(),
        },
      ];

      await MeterValueService.processMeterValuesBatch(payloads);

      expect(batchSpy).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          transactionId: "TX-999",
          chargerId: 1,
        }),
      ]));
    });
  });
});
