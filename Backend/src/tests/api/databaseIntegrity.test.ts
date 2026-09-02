import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as chargersController from '../../api/chargers/chargers.controller.js';
import * as stationsController from '../../api/stations/stations.controller.js';
import * as vehiclesController from '../../api/vehicles/vehicles.controller.js';

describe('Database Schema & Data Integrity Tests (DB-01, DB-02, DB-03)', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      params: {},
      query: {},
      body: {},
      userId: 1,
      userRole: 'superadmin',
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  describe('Charger Cascade Deletion (DB-01)', () => {
    it('should return 400 for invalid charger ID', async () => {
      mockReq.params.id = 'invalid';

      await chargersController.deleteCharger(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Invalid charger ID' })
      );
    });

    it('should return 404 if charger does not exist', async () => {
      mockReq.params.id = '999';
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(null);

      await chargersController.deleteCharger(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Charger not found' })
      );
    });

    it('should transactionally delete charger and dependent child records', async () => {
      mockReq.params.id = '101';
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({ charger_id: 101 } as any);

      const mockTx: any = {
        meterValue: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 5 }) },
        chargerAlert: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        chargingSchedulePlan: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        diagnosticEvent: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        deviceComponent: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 3 }) },
        transaction: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 4 }) },
        ocppLog: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 10 }) },
        rfidSession: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 4 }) },
        chargerConfiguration: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 8 }) },
        chargingProfile: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        connector: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        evse: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        charger: { delete: (jest.fn() as any).mockResolvedValue({ charger_id: 101 }) },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return await callback(mockTx);
        }
        return callback;
      });

      await chargersController.deleteCharger(mockReq, mockRes);

      expect(mockTx.meterValue.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.chargerAlert.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.chargingSchedulePlan.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.diagnosticEvent.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.deviceComponent.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.transaction.deleteMany).toHaveBeenCalledWith({ where: { charger_id: 101 } });
      expect(mockTx.ocppLog.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.rfidSession.deleteMany).toHaveBeenCalledWith({ where: { charger_id: 101 } });
      expect(mockTx.chargerConfiguration.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.chargingProfile.deleteMany).toHaveBeenCalledWith({ where: { chargerId: 101 } });
      expect(mockTx.connector.deleteMany).toHaveBeenCalledWith({ where: { evse: { charger_id: 101 } } });
      expect(mockTx.evse.deleteMany).toHaveBeenCalledWith({ where: { charger_id: 101 } });
      expect(mockTx.charger.delete).toHaveBeenCalledWith({ where: { charger_id: 101 } });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Charger deleted',
      });
    });
  });

  describe('Station Cascade Deletion (DB-01)', () => {
    it('should return 400 for invalid station ID', async () => {
      mockReq.params.id = 'abc';

      await stationsController.deleteStation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Invalid station ID' })
      );
    });

    it('should return 404 if station is not found', async () => {
      mockReq.params.id = '50';
      jest.spyOn(prisma.chargingStation, 'findUnique').mockResolvedValue(null);

      await stationsController.deleteStation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Station not found' })
      );
    });

    it('should delete station and cascade all associated chargers, spots, and roaming sessions', async () => {
      mockReq.params.id = '10';
      jest.spyOn(prisma.chargingStation, 'findUnique').mockResolvedValue({
        id: 10,
        chargers: [{ charger_id: 101 }, { charger_id: 102 }],
      } as any);

      const mockTx: any = {
        meterValue: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 5 }) },
        chargerAlert: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        chargingSchedulePlan: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        diagnosticEvent: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        deviceComponent: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 3 }) },
        transaction: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 4 }) },
        ocppLog: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 10 }) },
        rfidSession: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 4 }) },
        chargerConfiguration: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 8 }) },
        chargingProfile: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        connector: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        evse: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        charger: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        parkingSpot: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 4 }) },
        roamingSession: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        cDR: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 2 }) },
        mediaCampaign: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        reimbursementContract: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 1 }) },
        chargingStation: { delete: (jest.fn() as any).mockResolvedValue({ id: 10 }) },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return await callback(mockTx);
        }
        return callback;
      });

      await stationsController.deleteStation(mockReq, mockRes);

      expect(mockTx.meterValue.deleteMany).toHaveBeenCalledWith({ where: { chargerId: { in: [101, 102] } } });
      expect(mockTx.charger.deleteMany).toHaveBeenCalledWith({ where: { charger_id: { in: [101, 102] } } });
      expect(mockTx.parkingSpot.deleteMany).toHaveBeenCalledWith({ where: { stationId: 10 } });
      expect(mockTx.roamingSession.deleteMany).toHaveBeenCalledWith({ where: { stationId: 10 } });
      expect(mockTx.cDR.deleteMany).toHaveBeenCalledWith({ where: { stationId: 10 } });
      expect(mockTx.chargingStation.delete).toHaveBeenCalledWith({ where: { id: 10 } });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Station deleted',
      });
    });
  });

  describe('Consolidated Vehicle Certificate Controller (DB-02)', () => {
    it('getCertificates should return paginated list of certificates', async () => {
      mockReq.query = { page: '1', limit: '10' };

      const mockCerts = [
        { id: 1, emaid: 'DE*ABC*E123', status: 'Valid', userId: 1 },
        { id: 2, emaid: 'NL*XYZ*E456', status: 'Valid', userId: 2 },
      ];

      jest.spyOn(prisma.vehicleContractCertificate, 'count').mockResolvedValue(2);
      jest.spyOn(prisma.vehicleContractCertificate, 'findMany').mockResolvedValue(mockCerts as any);

      await vehiclesController.getCertificates(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCerts,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('getCertificateById should return certificate details', async () => {
      mockReq.params.id = '1';

      const mockCert = { id: 1, emaid: 'DE*ABC*E123', status: 'Valid', userId: 1 };
      jest.spyOn(prisma.vehicleContractCertificate, 'findUnique').mockResolvedValue(mockCert as any);

      await vehiclesController.getCertificateById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockCert,
      });
    });

    it('createCertificate should validate required fields', async () => {
      mockReq.body = { emaid: 'DE*ABC*E123' }; // Missing userId

      await vehiclesController.createCertificate(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'emaid and userId are required',
      });
    });

    it('createCertificate should handle duplicate EMAID with HTTP 409 Conflict', async () => {
      mockReq.body = { emaid: 'DE*ABC*E123', userId: 1 };

      const duplicateError: any = new Error('Unique constraint failed');
      duplicateError.code = 'P2002';
      jest.spyOn(prisma.vehicleContractCertificate, 'create').mockRejectedValue(duplicateError);

      await vehiclesController.createCertificate(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'EMAID already registered',
      });
    });

    it('createCertificate should create certificate with default expiration when omitted', async () => {
      mockReq.body = { emaid: 'DE*NEW*E999', userId: 2 };

      const createdCert = {
        id: 3,
        emaid: 'DE*NEW*E999',
        userId: 2,
        status: 'Valid',
        expirationDate: new Date(),
      };

      const createSpy = jest.spyOn(prisma.vehicleContractCertificate, 'create').mockResolvedValue(createdCert as any);

      await vehiclesController.createCertificate(mockReq, mockRes);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emaid: 'DE*NEW*E999',
            userId: 2,
            status: 'Valid',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdCert,
      });
    });

    it('updateCertificate should update existing certificate', async () => {
      mockReq.params.id = '1';
      mockReq.body = { status: 'Expired', macAddress: '00:11:22:33:44:55' };

      const updatedCert = {
        id: 1,
        emaid: 'DE*ABC*E123',
        status: 'Expired',
        macAddress: '00:11:22:33:44:55',
      };

      jest.spyOn(prisma.vehicleContractCertificate, 'update').mockResolvedValue(updatedCert as any);

      await vehiclesController.updateCertificate(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedCert,
      });
    });

    it('deleteCertificate should delete certificate by ID', async () => {
      mockReq.params.id = '1';
      mockReq.userRole = 'superadmin';

      jest.spyOn(prisma.vehicleContractCertificate, 'findUnique').mockResolvedValue({
        id: 1,
        userId: 1,
        user: { id: 1, companyId: 1 },
      } as any);
      jest.spyOn(prisma.vehicleContractCertificate, 'delete').mockResolvedValue({ id: 1 } as any);

      await vehiclesController.deleteCertificate(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Certificate deleted successfully',
      });
    });
  });
});
