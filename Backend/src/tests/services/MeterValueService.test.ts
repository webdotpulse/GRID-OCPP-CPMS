import { jest } from '@jest/globals';

const mockEnqueueMeterValue = jest.fn<any>().mockResolvedValue(undefined);
const mockProcessMeterValuesBatch = jest.fn<any>().mockResolvedValue(undefined);

jest.unstable_mockModule('../../queues/queueManager.js', () => ({
  enqueueMeterValue: mockEnqueueMeterValue,
}));

jest.unstable_mockModule('../../workers/meterValuesWorker.js', () => ({
  processMeterValuesBatch: mockProcessMeterValuesBatch,
}));

const { MeterValueService } = await import('../../services/MeterValueService.js');

describe("MeterValueService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addMeterValue", () => {
    it("should push payload to BullMQ meter values queue", async () => {
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

      expect(mockEnqueueMeterValue).toHaveBeenCalledWith(expect.objectContaining({
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

      expect(mockProcessMeterValuesBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          transactionId: "TX-999",
          chargerId: 1,
        }),
      ]));
    });
  });
});
