import { jest } from "@jest/globals";

const mockAdd = jest.fn() as any;
const mockClose = jest.fn() as any;
const mockQuit = jest.fn() as any;

const mockQueueInstance = {
  add: mockAdd,
  close: mockClose,
  on: jest.fn(),
};

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => mockQueueInstance),
}));

jest.mock("ioredis", () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      quit: mockQuit,
      on: jest.fn(),
    })),
  };
});

describe("BullMQ Queue Manager", () => {
  let queueManager: any;

  beforeAll(async () => {
    queueManager = await import("../../queues/queueManager.js");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("enqueueMeterValue", () => {
    it("should add job to meterValuesQueue with default options", async () => {
      mockAdd.mockResolvedValue({ id: "job-mv-123" });

      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        connectorId: 1,
        energyValue: 5000,
        socValue: 80,
        currentValue: 16,
        voltageValue: 230,
        timestamp: new Date().toISOString(),
      };

      const jobId = await queueManager.enqueueMeterValue(payload);

      expect(jobId).toBe("job-mv-123");
      expect(mockAdd).toHaveBeenCalledWith(
        "ingest-meter-value",
        payload,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        })
      );
    });

    it("should handle error gracefully and return undefined", async () => {
      mockAdd.mockRejectedValue(new Error("Redis connection failure"));

      const payload = {
        transactionId: "TX-100",
        chargerId: 1,
        timestamp: new Date().toISOString(),
      };

      const jobId = await queueManager.enqueueMeterValue(payload);
      expect(jobId).toBeUndefined();
    });
  });

  describe("enqueueStatusEvent", () => {
    it("should add job to statusEventsQueue", async () => {
      mockAdd.mockResolvedValue({ id: "job-st-456" });

      const payload = {
        chargerId: 2,
        connectorId: 1,
        status: "Charging",
      };

      const jobId = await queueManager.enqueueStatusEvent(payload);

      expect(jobId).toBe("job-st-456");
      expect(mockAdd).toHaveBeenCalledWith(
        "process-status-event",
        payload,
        expect.objectContaining({ attempts: 3 })
      );
    });
  });

  describe("enqueueBillingEvent", () => {
    it("should add job to billingQueue", async () => {
      mockAdd.mockResolvedValue({ id: "job-bill-789" });

      const payload = {
        chargerId: 1,
        transactionId: "TX-999",
        meterStop: 12000,
        timestamp: new Date().toISOString(),
      };

      const jobId = await queueManager.enqueueBillingEvent(payload);

      expect(jobId).toBe("job-bill-789");
      expect(mockAdd).toHaveBeenCalledWith(
        "process-billing-event",
        payload,
        expect.objectContaining({ attempts: 3 })
      );
    });
  });

  describe("closeQueues", () => {
    it("should close all queues and quit redis connection", async () => {
      mockClose.mockResolvedValue(undefined);
      mockQuit.mockResolvedValue("OK");

      await queueManager.closeQueues();

      expect(mockClose).toHaveBeenCalledTimes(3);
      expect(mockQuit).toHaveBeenCalled();
    });
  });
});
