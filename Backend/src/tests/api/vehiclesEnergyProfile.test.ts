import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as vehiclesController from '../../api/vehicles/vehicles.controller.js';

describe('Vehicle Energy Profile API (ENG-02)', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      userId: 10,
      userRole: 'user',
      body: {},
      params: {},
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  describe('getEnergyProfile', () => {
    it('should return default profile if no profile exists for user', async () => {
      jest.spyOn(prisma.vehicleEnergyProfile, 'findFirst').mockResolvedValue(null);

      await vehiclesController.getEnergyProfile(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          minSocThreshold: 40.0,
          userId: 10,
        })
      );
    });

    it('should return saved profile when one exists', async () => {
      const mockProfile = {
        id: 1,
        userId: 10,
        rfidUserId: null,
        minSocThreshold: 65.0,
        batteryCapacity: 77.0,
      };

      jest.spyOn(prisma.vehicleEnergyProfile, 'findFirst').mockResolvedValue(mockProfile as any);

      await vehiclesController.getEnergyProfile(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          minSocThreshold: 65.0,
          batteryCapacity: 77.0,
          userId: 10,
        })
      );
    });

    it('should reject unauthenticated requests with 401 when userId is missing', async () => {
      mockReq.userId = undefined;

      await vehiclesController.getEnergyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });
  });

  describe('saveEnergyProfile', () => {
    it('should allow regular authenticated user to save energy profile', async () => {
      const mockSaved = {
        id: 1,
        userId: 10,
        rfidUserId: null,
        minSocThreshold: 55.0,
        batteryCapacity: 60.0,
      };

      const upsertSpy = jest.spyOn(prisma.vehicleEnergyProfile, 'upsert').mockResolvedValue(mockSaved as any);

      mockReq.body = { minSocThreshold: 55, batteryCapacity: 60 };

      await vehiclesController.saveEnergyProfile(mockReq, mockRes);

      expect(upsertSpy).toHaveBeenCalledWith({
        where: { userId: 10 },
        update: {
          minSocThreshold: 55,
          batteryCapacity: 60,
        },
        create: {
          userId: 10,
          minSocThreshold: 55,
          batteryCapacity: 60,
          rfidUserId: null,
        },
      });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          minSocThreshold: 55.0,
          batteryCapacity: 60.0,
          userId: 10,
        })
      );
    });

    it('should reject invalid minSocThreshold outside 0-100', async () => {
      mockReq.body = { minSocThreshold: 150 };

      await vehiclesController.saveEnergyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'minSocThreshold must be a valid number between 0 and 100',
      });
    });

    it('should reject negative minSocThreshold', async () => {
      mockReq.body = { minSocThreshold: -5 };

      await vehiclesController.saveEnergyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'minSocThreshold must be a valid number between 0 and 100',
      });
    });

    it('should reject unauthenticated save requests with 401', async () => {
      mockReq.userId = undefined;
      mockReq.body = { minSocThreshold: 50 };

      await vehiclesController.saveEnergyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
