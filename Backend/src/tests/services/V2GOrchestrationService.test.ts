import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import { redisClient } from '../../config/redis.js';
import * as remoteControl from '../../ocpp/remoteControl.js';
import { V2GOrchestrationService } from '../../services/V2GOrchestrationService.js';

describe('V2GOrchestrationService (ENG-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerV2GDischargeForClient', () => {
    it('should dispatch negative current charging profile when currentSoc > minSoc', async () => {
      const mockTransactions = [
        {
          id: 1,
          transactionId: 'TX_1001',
          charger_id: 42,
          currentDirection: 'Charging',
          soc: 75,
          finalMeterValue: 54000, // Large energy reading in Wh - must NOT be used as SoC!
          charger: {
            charger_id: 42,
            owner_id: 10,
            power_capacity: 11, // 11 kW
          },
          rfidUser: {
            vehicleEnergyProfile: {
              minSocThreshold: 50.0,
            },
          },
        },
      ];

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue(mockTransactions as any);
      jest.spyOn(prisma.meterValue, 'findMany').mockResolvedValue([
        {
          transactionId: 'TX_1001',
          soc: 80, // Latest SoC is 80%
          timestamp: new Date(),
        } as any,
      ]);

      const mockSetChargingProfile = jest.spyOn(remoteControl, 'setChargingProfile').mockResolvedValue({
        status: 'Accepted',
      } as any);

      const mockTxUpdate = jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);

      await V2GOrchestrationService.triggerV2GDischargeForClient(10, 8.0); // 8 kW grid overload

      expect(mockSetChargingProfile).toHaveBeenCalledTimes(1);
      const profileCall = mockSetChargingProfile.mock.calls[0][0];
      expect(profileCall.chargerId).toBe(42);
      expect(profileCall.csChargingProfiles.chargingProfileId).toBe(300);
      expect(profileCall.csChargingProfiles.stackLevel).toBe(3);

      const limit = profileCall.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit;
      // 8 kW -> -8000 / 230 ≈ -34.78A
      expect(limit).toBeLessThan(0);
      expect(limit).toBeCloseTo((-8000 / 230), 1);

      expect(mockTxUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentDirection: 'Discharging',
          dischargeLimit: limit,
        },
      });
    });

    it('should use tx.soc when latestMeterValue is not available and ignore finalMeterValue', async () => {
      const mockTransactions = [
        {
          id: 2,
          transactionId: 'TX_1002',
          charger_id: 43,
          currentDirection: 'Charging',
          soc: 60, // tx.soc is 60%
          finalMeterValue: 30000, // 30,000 Wh -> NOT a percentage!
          charger: {
            charger_id: 43,
            owner_id: 10,
            power_capacity: 22,
          },
          rfidUser: null,
        },
      ];

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue(mockTransactions as any);
      jest.spyOn(prisma.meterValue, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.vehicleEnergyProfile, 'findFirst').mockResolvedValue({
        minSocThreshold: 50.0,
      } as any);

      const mockSetChargingProfile = jest.spyOn(remoteControl, 'setChargingProfile').mockResolvedValue({
        status: 'Accepted',
      } as any);

      jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);

      await V2GOrchestrationService.triggerV2GDischargeForClient(10, 6.0);

      expect(mockSetChargingProfile).toHaveBeenCalledTimes(1);
    });

    it('should not trigger discharge if currentSoc is below minSocThreshold', async () => {
      const mockTransactions = [
        {
          id: 3,
          transactionId: 'TX_1003',
          charger_id: 44,
          currentDirection: 'Charging',
          soc: 30, // 30% < 40% min threshold
          finalMeterValue: 50000,
          charger: {
            charger_id: 44,
            owner_id: 10,
            power_capacity: 11,
          },
          rfidUser: {
            vehicleEnergyProfile: {
              minSocThreshold: 40.0,
            },
          },
        },
      ];

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue(mockTransactions as any);
      jest.spyOn(prisma.meterValue, 'findMany').mockResolvedValue([
        {
          transactionId: 'TX_1003',
          soc: 30,
          timestamp: new Date(),
        } as any,
      ]);

      const mockSetChargingProfile = jest.spyOn(remoteControl, 'setChargingProfile').mockResolvedValue({
        status: 'Accepted',
      } as any);

      await V2GOrchestrationService.triggerV2GDischargeForClient(10, 8.0);

      expect(mockSetChargingProfile).not.toHaveBeenCalled();
    });

    it('should cap discharge power to charger power_capacity', async () => {
      const mockTransactions = [
        {
          id: 4,
          transactionId: 'TX_1004',
          charger_id: 45,
          currentDirection: 'Charging',
          soc: 90,
          charger: {
            charger_id: 45,
            owner_id: 10,
            power_capacity: 7.4, // Capped at 7.4 kW
          },
          rfidUser: null,
        },
      ];

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue(mockTransactions as any);
      jest.spyOn(prisma.meterValue, 'findMany').mockResolvedValue([
        {
          transactionId: 'TX_1004',
          soc: 90,
          timestamp: new Date(),
        } as any,
      ]);
      jest.spyOn(prisma.vehicleEnergyProfile, 'findFirst').mockResolvedValue({
        minSocThreshold: 20.0,
      } as any);

      const mockSetChargingProfile = jest.spyOn(remoteControl, 'setChargingProfile').mockResolvedValue({
        status: 'Accepted',
      } as any);

      jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);

      await V2GOrchestrationService.triggerV2GDischargeForClient(10, 20.0); // 20 kW requested, but cap is 7.4 kW

      const profileCall = mockSetChargingProfile.mock.calls[0][0];
      const limit = profileCall.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit;
      expect(limit).toBeCloseTo((-7400 / 230), 1);
    });
  });

  describe('stopV2GDischargeForClient', () => {
    it('should send limit 0 profile and reset transaction direction to Charging', async () => {
      const mockDischargingTransactions = [
        {
          id: 5,
          transactionId: 'TX_1005',
          charger_id: 46,
          currentDirection: 'Discharging',
        },
      ];

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue(mockDischargingTransactions as any);

      const mockSetChargingProfile = jest.spyOn(remoteControl, 'setChargingProfile').mockResolvedValue({
        status: 'Accepted',
      } as any);

      const mockTxUpdate = jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);

      await V2GOrchestrationService.stopV2GDischargeForClient(10);

      expect(mockSetChargingProfile).toHaveBeenCalledTimes(1);
      const profileCall = mockSetChargingProfile.mock.calls[0][0];
      expect(profileCall.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit).toBe(0);

      expect(mockTxUpdate).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          currentDirection: 'Charging',
          dischargeLimit: null,
        },
      });
    });
  });

  describe('evaluateAndDispatchV2G', () => {
    it('should evaluate active gateways and dispatch discharge when grid load exceeds maxGridImport', async () => {
      const mockGateways = [
        {
          id: 1,
          gateway_id: 'EMS_GW_001',
          client_id: 100,
          status: 'online',
          v2gEnabled: true,
          maxGridImport: 4.0,
        },
      ];

      jest.spyOn(prisma.emsGateway, 'findMany').mockResolvedValue(mockGateways as any);
      jest.spyOn(redisClient, 'hgetall').mockResolvedValue({
        grid_kw: '7.5',
      } as any);

      const triggerSpy = jest.spyOn(V2GOrchestrationService, 'triggerV2GDischargeForClient').mockResolvedValue(undefined as any);
      const stopSpy = jest.spyOn(V2GOrchestrationService, 'stopV2GDischargeForClient').mockResolvedValue(undefined as any);

      await V2GOrchestrationService.evaluateAndDispatchV2G();

      expect(triggerSpy).toHaveBeenCalledWith(100, 3.5); // 7.5 - 4.0 = 3.5 kW excess
      expect(stopSpy).not.toHaveBeenCalled();
    });

    it('should stop discharge if grid load is below maxGridImport', async () => {
      const mockGateways = [
        {
          id: 2,
          gateway_id: 'EMS_GW_002',
          client_id: 101,
          status: 'online',
          v2gEnabled: true,
          maxGridImport: 6.0,
        },
      ];

      jest.spyOn(prisma.emsGateway, 'findMany').mockResolvedValue(mockGateways as any);
      jest.spyOn(redisClient, 'hgetall').mockResolvedValue({
        grid_kw: '2.5',
      } as any);

      const triggerSpy = jest.spyOn(V2GOrchestrationService, 'triggerV2GDischargeForClient').mockResolvedValue(undefined as any);
      const stopSpy = jest.spyOn(V2GOrchestrationService, 'stopV2GDischargeForClient').mockResolvedValue(undefined as any);

      await V2GOrchestrationService.evaluateAndDispatchV2G();

      expect(triggerSpy).not.toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalledWith(101);
    });

    it('should stop discharge if v2gEnabled is false on the gateway', async () => {
      const mockGateways = [
        {
          id: 3,
          gateway_id: 'EMS_GW_003',
          client_id: 102,
          status: 'online',
          v2gEnabled: false,
          maxGridImport: 5.0,
        },
      ];

      jest.spyOn(prisma.emsGateway, 'findMany').mockResolvedValue(mockGateways as any);

      const triggerSpy = jest.spyOn(V2GOrchestrationService, 'triggerV2GDischargeForClient').mockResolvedValue(undefined as any);
      const stopSpy = jest.spyOn(V2GOrchestrationService, 'stopV2GDischargeForClient').mockResolvedValue(undefined as any);

      await V2GOrchestrationService.evaluateAndDispatchV2G();

      expect(triggerSpy).not.toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalledWith(102);
    });
  });
});
