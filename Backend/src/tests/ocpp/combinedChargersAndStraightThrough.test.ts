import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import * as v16Handlers from '../../ocpp/handlers/v16Handlers.js';
import * as v21Handlers from '../../ocpp/handlers/v21Handlers.js';
import { resolveTargetChargerAndConnector } from '../../ocpp/remoteControl.js';
import { combineChargers, uncombineChargers } from '../../api/chargers/chargers.controller.js';
import { loadManagementService } from '../../services/LoadManagementService.js';

describe("Combined Dual-Socket Chargers & Straight-Through Proxy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma.ocppLog, 'create').mockResolvedValue({} as any);
  });

  describe("Combine Chargers Controller", () => {
    it("should reject combining chargers of different manufacturer or model", async () => {
      jest.spyOn(prisma.charger, 'findUnique')
        .mockResolvedValueOnce({
          charger_id: 101,
          name: "Alfen Single 1",
          manufacturer: "Alfen",
          model: "Eve Single Pro",
          evses: [],
        } as any)
        .mockResolvedValueOnce({
          charger_id: 102,
          name: "Easee Single 1",
          manufacturer: "Easee",
          model: "Charge Lite",
          evses: [],
        } as any);

      const req: any = {
        body: { primaryChargerId: 101, secondaryChargerId: 102 },
        userRole: "admin",
        userId: 1,
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await combineChargers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("must have the same brand and model"),
        })
      );
    });

    it("should successfully combine two chargers of identical brand and model", async () => {
      jest.spyOn(prisma.charger, 'findUnique')
        .mockResolvedValueOnce({
          charger_id: 101,
          name: "Alfen Single Primary",
          manufacturer: "Alfen",
          model: "Eve Single Pro",
          power_capacity: 11,
          status: "active",
          evses: [
            {
              id: 1,
              evse_id: 1,
              connectors: [{ connector_id: 1, connector_name: "Connector 1" }],
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          charger_id: 102,
          name: "Alfen Single Secondary",
          manufacturer: "Alfen",
          model: "Eve Single Pro",
          power_capacity: 11,
          status: "active",
          evses: [
            {
              id: 2,
              evse_id: 1,
              connectors: [{ connector_id: 2, connector_name: "Connector 1" }],
            },
          ],
        } as any);

      jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.connector, 'create').mockResolvedValue({} as any);
      jest.spyOn(prisma.charger, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([{}, {}] as any);

      const req: any = {
        body: { primaryChargerId: 101, secondaryChargerId: 102 },
        userRole: "admin",
        userId: 1,
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await combineChargers(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { primaryChargerId: 101, secondaryChargerId: 102 },
        })
      );
    });

    it("should successfully uncombine paired chargers", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 101,
        name: "Alfen Combined Primary",
        isCombined: true,
        pairedChargerId: 102,
        pairedRole: "primary",
        owner_id: 1,
      } as any);

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return callback;
      });
      jest.spyOn(prisma.charger, 'update').mockResolvedValue({} as any);

      const req: any = {
        body: { chargerId: 101 },
        userRole: "admin",
        userId: 1,
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await uncombineChargers(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("uncombined successfully"),
        })
      );
    });
  });

  describe("Straight-Through Proxy Mode in OCPP 1.6 & 2.1 Handlers", () => {
    it("OCPP 1.6: handleAuthorize should delegate directly to Third-Party Backend when straight-through proxy is active", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 201,
        isStraightThroughProxy: true,
        thirdPartyBackendUrl: "wss://thirdparty.cpo.com/ocpp",
      } as any);
      const rfidSpy = jest.spyOn(prisma.rfidUser, 'findUnique');

      const response = await v16Handlers.handleAuthorize(201, { idTag: "UNKNOWN_UNWHITELISTED_CARD" });

      expect(response).toEqual({
        idTagInfo: { status: "Accepted" },
      });
      expect(rfidSpy).not.toHaveBeenCalled();
    });

    it("OCPP 1.6: handleStartTransaction should accept unwhitelisted tag in Straight-Through mode and trigger load balancing", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 201,
        isStraightThroughProxy: true,
        thirdPartyBackendUrl: "wss://thirdparty.cpo.com/ocpp",
        charging_station_id: 10,
        chargeGroupId: 5,
        quirkProfile: null,
      } as any);

      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue({
        id: 1,
        transactionId: "998877",
        charger: {
          charging_station_id: 10,
          chargeGroupId: 5,
        },
      } as any);
      jest.spyOn(prisma.connector, 'findFirst').mockResolvedValue({ connector_id: 1 } as any);
      jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);
      const balanceSiteSpy = jest.spyOn(loadManagementService, 'balanceSiteLoad').mockResolvedValue(undefined as any);
      const balanceGroupSpy = jest.spyOn(loadManagementService, 'balanceChargeGroupLoad').mockResolvedValue(undefined as any);

      const response = await v16Handlers.handleStartTransaction(201, {
        connectorId: 1,
        idTag: "EXTERNAL_ROAMING_CARD_123",
        meterStart: 1000,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo).toEqual({ status: "Accepted" });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            charger_id: 201,
            connectorName: "Channel 1",
            idTag: "EXTERNAL_ROAMING_CARD_123",
          }),
        })
      );
      expect(balanceSiteSpy).toHaveBeenCalledWith(10);
      expect(balanceGroupSpy).toHaveBeenCalledWith(5);
    });

    it("OCPP 2.1: handleAuthorize should delegate to Third-Party Backend when straight-through proxy is active", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 301,
        isStraightThroughProxy: true,
        thirdPartyBackendUrl: "wss://thirdparty.cpo.com/ocpp",
      } as any);

      const response = await v21Handlers.handleAuthorize(301, {
        idToken: { idToken: "EXTERNAL_TAG_201", type: "ISO14443" },
      });

      expect(response).toEqual({
        idTokenInfo: { status: "Accepted" },
      });
    });
  });

  describe("Combined Charger Secondary Channel Mapping & Remote Dispatching", () => {
    it("should resolve Channel 2 command on primary charger to paired secondary charger", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 501,
        isCombined: true,
        pairedRole: "primary",
        pairedChargerId: 502,
      } as any);

      const target = await resolveTargetChargerAndConnector(501, 2);
      expect(target).toEqual({
        targetChargerId: 502,
        targetConnectorId: 1,
      });
    });

    it("should resolve Channel 1 command on primary charger to itself", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 501,
        isCombined: true,
        pairedRole: "primary",
        pairedChargerId: 502,
      } as any);

      const target = await resolveTargetChargerAndConnector(501, 1);
      expect(target).toEqual({
        targetChargerId: 501,
        targetConnectorId: 1,
      });
    });

    it("OCPP 1.6: handleStartTransaction from secondary paired charger should map to Channel 2 and sync primary connector", async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue({
        charger_id: 502,
        isCombined: true,
        pairedRole: "secondary",
        pairedChargerId: 501,
        charging_station_id: 1,
        chargeGroupId: null,
        quirkProfile: null,
      } as any);

      jest.spyOn(prisma.transaction, 'create').mockResolvedValue({
        id: 2,
        transactionId: "12345",
        charger: { charging_station_id: 1, chargeGroupId: null },
      } as any);
      jest.spyOn(prisma.connector, 'findFirst')
        .mockResolvedValueOnce({ connector_id: 20 } as any) // local secondary connector
        .mockResolvedValueOnce({ connector_id: 10 } as any); // primary Channel 2 connector
      jest.spyOn(prisma.connector, 'update').mockResolvedValue({} as any);

      const response = await v16Handlers.handleStartTransaction(502, {
        connectorId: 1, // Arrives as connector 1 from physical secondary charger
        meterStart: 500,
        timestamp: new Date().toISOString(),
      });

      expect(response.idTagInfo).toEqual({ status: "Accepted" });
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            charger_id: 502,
            connectorName: "Channel 2",
          }),
        })
      );
      // Verify primary charger's Channel 2 connector was synced
      expect(prisma.connector.findFirst).toHaveBeenCalledWith({
        where: {
          evse: { charger_id: 501 },
          connector_name: "Channel 2",
        },
      });
    });
  });
});
