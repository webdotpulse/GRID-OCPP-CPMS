<<<<<<< HEAD
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
=======
import { jest } from '@jest/globals';

const mockQueueAdd = jest.fn() as any;
const mockQueueAddBulk = jest.fn() as any;
const mockQueueClose = jest.fn() as any;
const mockQueueOn = jest.fn() as any;

class MockQueue {
  add = mockQueueAdd;
  addBulk = mockQueueAddBulk;
  close = mockQueueClose;
  on = mockQueueOn;
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

const mockRedisQuit = jest.fn() as any;

class MockRedis {
  quit = mockRedisQuit.mockResolvedValue("OK" as never);
  on = jest.fn();
  constructor(public url?: any, public opts?: any) {}
}

jest.unstable_mockModule('ioredis', () => ({
  Redis: MockRedis,
  default: MockRedis,
}));

describe('BullMQ Queue Manager', () => {
  let queueManager: any;

  beforeAll(async () => {
    queueManager = await import('../../queues/queueManager.js');
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

<<<<<<< HEAD
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
=======
  it('should enqueue a single meter value', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });

    const payload = {
      transactionId: 'TX-100',
      chargerId: 1,
      connectorId: 1,
      energyValue: 5000,
      timestamp: new Date(),
    };

    await queueManager.enqueueMeterValue(payload);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'meter-value',
      payload,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should enqueue bulk meter values when passed an array', async () => {
    mockQueueAddBulk.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }]);

    const payloads = [
      { transactionId: 'TX-1', chargerId: 1, energyValue: 1000, timestamp: new Date() },
      { transactionId: 'TX-2', chargerId: 1, energyValue: 2000, timestamp: new Date() },
    ];

    await queueManager.enqueueMeterValue(payloads);

    expect(mockQueueAddBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'meter-value-batch', data: payloads[0] }),
        expect.objectContaining({ name: 'meter-value-batch', data: payloads[1] }),
      ])
    );
  });

  it('should enqueue a status event', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'job-status-1' });

    const event = {
      chargerId: 2,
      connectorId: 1,
      status: 'Occupied',
      timestamp: new Date(),
    };

    await queueManager.enqueueStatusEvent(event);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'status-event',
      event,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should enqueue a billing job', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'job-billing-1' });

    const billingData = {
      chargerId: 5,
      transactionId: 'TX-999',
      meterStop: 50000,
      timestamp: new Date(),
    };

    await queueManager.enqueueBillingJob(billingData);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'billing-job',
      billingData,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should gracefully close all queues', async () => {
    mockQueueClose.mockResolvedValue(undefined);

    await queueManager.closeQueues();

    expect(mockQueueClose).toHaveBeenCalledTimes(3);
    expect(mockRedisQuit).toHaveBeenCalled();
>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
  });
});
