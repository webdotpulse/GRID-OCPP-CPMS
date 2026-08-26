import { jest } from '@jest/globals';
import {
  enqueueMeterValue,
  enqueueStatusEvent,
  enqueueBillingJob,
  closeQueues,
  meterValuesQueue,
  statusEventsQueue,
  billingQueue,
} from '../../queues/queueManager.js';

describe('BullMQ Queue Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enqueue a single meter value', async () => {
    const addSpy = jest.spyOn(meterValuesQueue, 'add').mockResolvedValue({ id: 'job-1' } as any);

    const payload = {
      transactionId: 'TX-100',
      chargerId: 1,
      connectorId: 1,
      energyValue: 5000,
      timestamp: new Date(),
    };

    await enqueueMeterValue(payload);

    expect(addSpy).toHaveBeenCalledWith(
      'meter-value',
      payload,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should enqueue bulk meter values when passed an array', async () => {
    const addBulkSpy = jest.spyOn(meterValuesQueue, 'addBulk').mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }] as any);

    const payloads = [
      { transactionId: 'TX-1', chargerId: 1, energyValue: 1000, timestamp: new Date() },
      { transactionId: 'TX-2', chargerId: 1, energyValue: 2000, timestamp: new Date() },
    ];

    await enqueueMeterValue(payloads);

    expect(addBulkSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'meter-value-batch', data: payloads[0] }),
        expect.objectContaining({ name: 'meter-value-batch', data: payloads[1] }),
      ])
    );
  });

  it('should enqueue a status event', async () => {
    const addSpy = jest.spyOn(statusEventsQueue, 'add').mockResolvedValue({ id: 'job-status-1' } as any);

    const event = {
      chargerId: 2,
      connectorId: 1,
      status: 'Occupied',
      timestamp: new Date(),
    };

    await enqueueStatusEvent(event);

    expect(addSpy).toHaveBeenCalledWith(
      'status-event',
      event,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should enqueue a billing job', async () => {
    const addSpy = jest.spyOn(billingQueue, 'add').mockResolvedValue({ id: 'job-billing-1' } as any);

    const billingData = {
      chargerId: 5,
      transactionId: 'TX-999',
      meterStop: 50000,
      timestamp: new Date(),
    };

    await enqueueBillingJob(billingData);

    expect(addSpy).toHaveBeenCalledWith(
      'billing-job',
      billingData,
      expect.objectContaining({ attempts: 3 })
    );
  });

  it('should gracefully close all queues', async () => {
    const mvCloseSpy = jest.spyOn(meterValuesQueue, 'close').mockResolvedValue(undefined as any);
    const seCloseSpy = jest.spyOn(statusEventsQueue, 'close').mockResolvedValue(undefined as any);
    const bCloseSpy = jest.spyOn(billingQueue, 'close').mockResolvedValue(undefined as any);

    await closeQueues();

    expect(mvCloseSpy).toHaveBeenCalled();
    expect(seCloseSpy).toHaveBeenCalled();
    expect(bCloseSpy).toHaveBeenCalled();
  });
});
