import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import { processStatusEventJob } from '../../workers/eventWorker.js';

describe('EventWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process a Faulted status event and increment consecutive errors', async () => {
    const diagCreateSpy = jest.spyOn(prisma.diagnosticEvent, 'create').mockResolvedValue({ id: 1 } as any);
    const chargerUpdateSpy = jest.spyOn(prisma.charger, 'update').mockResolvedValue({} as any);
    jest.spyOn(prisma.evse, 'findUnique').mockResolvedValue({ id: 10 } as any);
    jest.spyOn(prisma.connector, 'findFirst').mockResolvedValue({ connector_id: 20 } as any);
    const connUpdateSpy = jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);

    const job: any = {
      id: 'job-fault-1',
      data: {
        chargerId: 5,
        connectorId: 1,
        status: 'Faulted',
        errorCode: 'GroundFailure',
        timestamp: new Date().toISOString(),
      },
    };

    await processStatusEventJob(job);

    expect(diagCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargerId: 5,
          type: 'FaultedState',
        }),
      })
    );

    expect(chargerUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { charger_id: 5 },
        data: expect.objectContaining({
          consecutiveErrors: { increment: 1 },
        }),
      })
    );

    expect(connUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { connector_id: 20 },
        data: expect.objectContaining({ status: 'Faulted' }),
      })
    );
  });

  it('should process Available status and reset consecutive errors', async () => {
    const chargerUpdateSpy = jest.spyOn(prisma.charger, 'update').mockResolvedValue({} as any);
    jest.spyOn(prisma.evse, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.evse, 'create').mockResolvedValue({ id: 15 } as any);
    jest.spyOn(prisma.connector, 'findFirst').mockResolvedValue(null);
    const connCreateSpy = jest.spyOn(prisma.connector, 'create').mockResolvedValue({ connector_id: 30 } as any);

    const job: any = {
      id: 'job-avail-1',
      data: {
        chargerId: 7,
        connectorId: 1,
        status: 'Available',
        timestamp: new Date().toISOString(),
      },
    };

    await processStatusEventJob(job);

    expect(chargerUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { charger_id: 7 },
        data: expect.objectContaining({
          consecutiveErrors: 0,
        }),
      })
    );

    expect(connCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'Available',
          connector_name: 'Channel 1',
        }),
      })
    );
  });
});
