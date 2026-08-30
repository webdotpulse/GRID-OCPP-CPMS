import { jest } from '@jest/globals';
import { prisma } from '../../config/database.js';
import { AuthorizationService } from '../../services/AuthorizationService.js';

describe('AuthorizationService - Public/Private Chargers & Local/Roaming Cards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Private Charger Access Control', () => {
    const privateCharger = {
      charger_id: 101,
      owner_id: 5,
      isPublic: false,
      chargeGroupId: null,
      isStraightThroughProxy: false,
      quirkProfile: null,
    };

    it('should ACCEPT own owned card on Private charger', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(privateCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 1,
        rfid_tag: 'CARD_OWNER',
        owner_id: 5, // Matches charger owner_id
        active: true,
        cardScope: 'Roaming',
        name: 'Owner User',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 101,
        rawIdTag: 'CARD_OWNER',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
      expect(result.userName).toBe('Owner User');
    });

    it('should ACCEPT own owned card even if cardScope is Local on Private charger', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(privateCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 1,
        rfid_tag: 'CARD_OWNER_LOCAL',
        owner_id: 5, // Matches charger owner_id
        active: true,
        cardScope: 'Local',
        name: 'Owner User',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 101,
        rawIdTag: 'CARD_OWNER_LOCAL',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
    });

    it('should REJECT other user card on Private charger without charge group', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(privateCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 2,
        rfid_tag: 'STRANGER_CARD',
        owner_id: 99, // Different owner
        active: true,
        cardScope: 'Roaming',
        name: 'Stranger User',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 101,
        rawIdTag: 'STRANGER_CARD',
      });

      expect(result.isAuthorized).toBe(false);
      expect(result.status).toBe('Invalid');
      expect(result.reason).toContain('Private charger');
    });

    it('should ACCEPT other user card on Private charger if user is in charger charge group', async () => {
      const groupedPrivateCharger = {
        ...privateCharger,
        chargeGroupId: 20,
      };

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(groupedPrivateCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 3,
        rfid_tag: 'GROUP_MEMBER_CARD',
        owner_id: 12,
        active: true,
        cardScope: 'Local',
        name: 'Group Member',
      } as any);

      jest.spyOn(prisma.chargeGroupUser, 'findUnique').mockResolvedValue({
        chargeGroupId: 20,
        userId: 12,
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 101,
        rawIdTag: 'GROUP_MEMBER_CARD',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
    });
  });

  describe('Public Charger Access Control & Card Scopes', () => {
    const publicCharger = {
      charger_id: 202,
      owner_id: 5,
      isPublic: true,
      chargeGroupId: null,
      isStraightThroughProxy: false,
      quirkProfile: null,
    };

    it('should ACCEPT any active Roaming card on Public charger', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(publicCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 10,
        rfid_tag: 'ROAMING_CARD',
        owner_id: 77, // Any user
        active: true,
        cardScope: 'Roaming',
        name: 'Roaming Driver',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 202,
        rawIdTag: 'ROAMING_CARD',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
    });

    it('should REJECT Local card on standalone Public charger (outside charge group)', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(publicCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 11,
        rfid_tag: 'LOCAL_CARD',
        owner_id: 88, // Different owner
        active: true,
        cardScope: 'Local',
        name: 'Local Only Driver',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 202,
        rawIdTag: 'LOCAL_CARD',
      });

      expect(result.isAuthorized).toBe(false);
      expect(result.status).toBe('Invalid');
      expect(result.reason).toContain('Local RFID card is restricted');
    });

    it('should ACCEPT Local card on Public charger if charger is in the same charge group', async () => {
      const groupedPublicCharger = {
        ...publicCharger,
        chargeGroupId: 30,
      };

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(groupedPublicCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 12,
        rfid_tag: 'LOCAL_GROUP_CARD',
        owner_id: 88,
        active: true,
        cardScope: 'Local',
        name: 'Local Group Driver',
      } as any);

      jest.spyOn(prisma.chargeGroupUser, 'findUnique').mockResolvedValue({
        chargeGroupId: 30,
        userId: 88,
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 202,
        rawIdTag: 'LOCAL_GROUP_CARD',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
    });

    it('should ACCEPT Local card on Public charger if card belongs to charger owner', async () => {
      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(publicCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 13,
        rfid_tag: 'OWNER_LOCAL_ON_PUBLIC',
        owner_id: 5, // Same as charger.owner_id
        active: true,
        cardScope: 'Local',
        name: 'Owner User',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 202,
        rawIdTag: 'OWNER_LOCAL_ON_PUBLIC',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.status).toBe('Accepted');
    });
  });

  describe('Deactivated Cards & Edge Cases', () => {
    it('should REJECT deactivated/inactive RFID card on both Public and Private chargers', async () => {
      const publicCharger = {
        charger_id: 303,
        owner_id: 5,
        isPublic: true,
      };

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(publicCharger as any);
      jest.spyOn(prisma.rfidUser, 'findUnique').mockResolvedValue({
        rfid_user_id: 14,
        rfid_tag: 'BLOCKED_CARD',
        owner_id: 5,
        active: false, // Inactive!
        cardScope: 'Roaming',
        name: 'Blocked User',
      } as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 303,
        rawIdTag: 'BLOCKED_CARD',
      });

      expect(result.isAuthorized).toBe(false);
      expect(result.status).toBe('Blocked');
    });

    it('should delegate authorization to Third-Party backend if Straight-Through mode is enabled', async () => {
      const proxyCharger = {
        charger_id: 404,
        owner_id: 5,
        isPublic: false,
        isStraightThroughProxy: true,
        thirdPartyBackendUrl: 'wss://external-backend.com/ocpp',
      };

      jest.spyOn(prisma.charger, 'findUnique').mockResolvedValue(proxyCharger as any);

      const result = await AuthorizationService.validateAuthorization({
        chargerId: 404,
        rawIdTag: 'ANY_TAG',
      });

      expect(result.isAuthorized).toBe(true);
      expect(result.isDelegatedToProxy).toBe(true);
      expect(result.status).toBe('Accepted');
    });
  });
});
