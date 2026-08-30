import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { resolveMappedCardId } from "../ocpp/handlers/v16Handlers.js";

export interface AuthorizationResult {
  isAuthorized: boolean;
  status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
  rfidUser?: any;
  vcc?: any;
  userName?: string;
  effectiveIdTag?: string;
  reason?: string;
  isDelegatedToProxy?: boolean;
}

export class AuthorizationService {
  /**
   * Centralized authorization validator for OCPP 1.6, OCPP 2.0.1/2.1, and REST APIs.
   */
  public static async validateAuthorization(params: {
    chargerId: number;
    idTag?: string;
    rawIdTag?: string;
    hashData?: any;
  }): Promise<AuthorizationResult> {
    const { chargerId, hashData } = params;
    const rawTag = params.rawIdTag || params.idTag;

    try {
      // 1. Fetch Charger details
      const charger = await prisma.charger.findUnique({
        where: { charger_id: chargerId },
        include: { quirkProfile: true },
      });

      if (!charger) {
        return {
          isAuthorized: false,
          status: "Invalid",
          reason: `Charger #${chargerId} not found in database`,
        };
      }

      // 2. Third-Party Backend Straight-Through Connection Mode
      if (charger.isStraightThroughProxy && charger.thirdPartyBackendUrl) {
        logger.info(
          `[Straight-Through Proxy] Delegating authorization for charger ${chargerId} (tag: ${rawTag || "ISO15118"}) to Third-Party Backend`
        );
        return {
          isAuthorized: true,
          status: "Accepted",
          isDelegatedToProxy: true,
          userName: "Third-Party Proxy User",
        };
      }

      // 3. ISO 15118 Certificate Hash Data (Plug & Charge)
      if (hashData) {
        const { PkiCertificateService } = await import("./PkiCertificateService.js");
        const validation = await PkiCertificateService.validate15118CertificateHash(hashData);

        if (!validation.isValid || !validation.certificate) {
          return {
            isAuthorized: false,
            status: (validation.status as any) || "Invalid",
            reason: "ISO 15118 certificate hash validation failed",
          };
        }

        const vcc = validation.certificate;
        const userName = vcc.user?.name || `eMAID: ${vcc.emaid}`;

        // Check Charge Group if charger belongs to one
        let inChargeGroup = false;
        if (charger.chargeGroupId && vcc.userId) {
          const userInGroup = await prisma.chargeGroupUser.findUnique({
            where: {
              chargeGroupId_userId: {
                chargeGroupId: charger.chargeGroupId,
                userId: vcc.userId,
              },
            },
          });
          inChargeGroup = Boolean(userInGroup);
        }

        const isOwner = vcc.userId === charger.owner_id;

        // Apply Public vs Private rules for ISO 15118 certificate
        if (!charger.isPublic) {
          // Private charger: only owner or charge group members
          if (!isOwner && !inChargeGroup) {
            logger.warn(
              `Authorize rejected: Certificate ${vcc.emaid} is not owned by charger owner or in charge group of private charger ${chargerId}`
            );
            return {
              isAuthorized: false,
              status: "Invalid",
              vcc,
              userName,
              reason: "Private charger rejects unauthorized certificate",
            };
          }
        }

        return {
          isAuthorized: true,
          status: "Accepted",
          vcc,
          userName,
          effectiveIdTag: vcc.emaid,
        };
      }

      // 4. RFID Tag Validation
      if (!rawTag) {
        return {
          isAuthorized: false,
          status: "Invalid",
          reason: "No identification tag provided",
        };
      }

      const rules = charger.quirkProfile?.rules as any;
      const effectiveIdTag = resolveMappedCardId(rawTag, rules);

      // Look up RFID Tag in database (checking mapped tag first, fallback to raw tag)
      let rfidUser = await prisma.rfidUser.findUnique({
        where: { rfid_tag: effectiveIdTag },
      });

      if (!rfidUser && effectiveIdTag !== rawTag) {
        rfidUser = await prisma.rfidUser.findUnique({
          where: { rfid_tag: rawTag },
        });
      }

      // 5. If not found in RfidUser, check VehicleContractCertificate (EMAID fallback)
      if (!rfidUser) {
        let vcc = await prisma.vehicleContractCertificate.findUnique({
          where: { emaid: effectiveIdTag },
          include: { user: true },
        });

        if (!vcc && effectiveIdTag !== rawTag) {
          vcc = await prisma.vehicleContractCertificate.findUnique({
            where: { emaid: rawTag },
            include: { user: true },
          });
        }

        if (!vcc || vcc.status !== "Valid" || new Date(vcc.expirationDate) < new Date()) {
          const authStatus = vcc?.status === "Expired" || (vcc && new Date(vcc.expirationDate) < new Date()) ? "Expired" : "Invalid";
          return {
            isAuthorized: false,
            status: authStatus,
            effectiveIdTag,
            reason: `Unknown or invalid RFID/EMAID tag ${rawTag}`,
          };
        }

        const userName = vcc.user?.name || `eMAID: ${vcc.emaid}`;
        let inChargeGroup = false;
        if (charger.chargeGroupId && vcc.userId) {
          const userInGroup = await prisma.chargeGroupUser.findUnique({
            where: {
              chargeGroupId_userId: {
                chargeGroupId: charger.chargeGroupId,
                userId: vcc.userId,
              },
            },
          });
          inChargeGroup = Boolean(userInGroup);
        }

        const isOwner = vcc.userId === charger.owner_id;
        if (!charger.isPublic && !isOwner && !inChargeGroup) {
          logger.warn(
            `Authorize rejected: EMAID ${effectiveIdTag} is not authorized on private charger ${chargerId}`
          );
          return {
            isAuthorized: false,
            status: "Invalid",
            vcc,
            userName,
            effectiveIdTag,
            reason: "Private charger rejects unauthorized EMAID",
          };
        }

        return {
          isAuthorized: true,
          status: "Accepted",
          vcc,
          userName,
          effectiveIdTag,
        };
      }

      // 6. Check Active Status
      if (!rfidUser.active) {
        logger.warn(`Authorize rejected: RFID tag ${rawTag} (${rfidUser.name}) is inactive/blocked`);
        return {
          isAuthorized: false,
          status: "Blocked",
          rfidUser,
          userName: rfidUser.name,
          effectiveIdTag,
          reason: "RFID tag is deactivated or blocked",
        };
      }

      // 7. Check Connected Charge Group Membership
      let inChargeGroup = false;
      if (charger.chargeGroupId) {
        const userInGroup = await prisma.chargeGroupUser.findUnique({
          where: {
            chargeGroupId_userId: {
              chargeGroupId: charger.chargeGroupId,
              userId: rfidUser.owner_id,
            },
          },
        });
        inChargeGroup = Boolean(userInGroup);
      }

      const isOwner = rfidUser.owner_id === charger.owner_id;
      const isPublicCharger = Boolean(charger.isPublic);
      const cardScope = (rfidUser.cardScope || "Roaming").toLowerCase();

      // 8. Evaluation of Public/Private Charger and Local/Roaming Card Rules
      if (!isPublicCharger) {
        // PRIVATE CHARGER: accepts only own owned cards (or users in connected charge group)
        if (!isOwner && !inChargeGroup) {
          logger.warn(
            `Authorize rejected: Private charger ${chargerId} (owner: ${charger.owner_id}) rejected card ${rawTag} (owner: ${rfidUser.owner_id})`
          );
          return {
            isAuthorized: false,
            status: "Invalid",
            rfidUser,
            userName: rfidUser.name,
            effectiveIdTag,
            reason: "Private charger only accepts own owned cards or connected charge group members",
          };
        }
      } else {
        // PUBLIC CHARGER: accepts all Roaming cards, or Local cards in connected charge group / own cards
        if (cardScope === "local") {
          // Local card: only in connected charge groups or own chargers
          if (!inChargeGroup && !isOwner) {
            logger.warn(
              `Authorize rejected: Local RFID card ${rawTag} (${rfidUser.name}) cannot be used on public charger ${chargerId} outside its charge group`
            );
            return {
              isAuthorized: false,
              status: "Invalid",
              rfidUser,
              userName: rfidUser.name,
              effectiveIdTag,
              reason: "Local RFID card is restricted to connected charge groups and own chargers",
            };
          }
        }
        // If cardScope === "roaming", it is accepted on all public chargers!
      }

      logger.info(
        `Authorize accepted: Tag ${rawTag} (effective: ${effectiveIdTag}, holder: ${rfidUser.name}, scope: ${rfidUser.cardScope}, charger: ${isPublicCharger ? "Public" : "Private"})`
      );

      return {
        isAuthorized: true,
        status: "Accepted",
        rfidUser,
        userName: rfidUser.name,
        effectiveIdTag,
      };
    } catch (error: any) {
      logger.error(`Error in AuthorizationService.validateAuthorization: ${error.message || error}`);
      return {
        isAuthorized: false,
        status: "Invalid",
        reason: `Authorization error: ${error.message || error}`,
      };
    }
  }

  /**
   * Determine which whitelist entries should be synced to a charger for offline local authorization.
   */
  public static async getAuthorizedEntriesForCharger(chargerId: number) {
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) return [];

    const isPublic = Boolean(charger.isPublic);
    let chargeGroupUserIds: number[] = [];

    if (charger.chargeGroupId) {
      const groupUsers = await prisma.chargeGroupUser.findMany({
        where: { chargeGroupId: charger.chargeGroupId },
        select: { userId: true },
      });
      chargeGroupUserIds = groupUsers.map((gu) => gu.userId);
    }

    const activeRfidUsers = await prisma.rfidUser.findMany({
      where: { active: true },
    });

    const activeCertificates = await prisma.vehicleContractCertificate.findMany({
      where: {
        status: "Valid",
        expirationDate: { gte: new Date() },
      },
    });

    const authorizedTags: Array<{ idTag: string; status: "Accepted"; expiryDate?: string }> = [];

    for (const rfid of activeRfidUsers) {
      const isOwner = rfid.owner_id === charger.owner_id;
      const inGroup = chargeGroupUserIds.includes(rfid.owner_id);
      const scope = (rfid.cardScope || "Roaming").toLowerCase();

      if (!isPublic) {
        // Private: only owner or in charge group
        if (isOwner || inGroup) {
          authorizedTags.push({ idTag: rfid.rfid_tag, status: "Accepted" });
        }
      } else {
        // Public: all roaming cards, plus local cards if owner or in group
        if (scope === "roaming" || isOwner || inGroup) {
          authorizedTags.push({ idTag: rfid.rfid_tag, status: "Accepted" });
        }
      }
    }

    for (const cert of activeCertificates) {
      const isOwner = cert.userId === charger.owner_id;
      const inGroup = chargeGroupUserIds.includes(cert.userId);

      if (!isPublic) {
        if (isOwner || inGroup) {
          if (!authorizedTags.some((t) => t.idTag === cert.emaid)) {
            authorizedTags.push({
              idTag: cert.emaid,
              status: "Accepted",
              expiryDate: cert.expirationDate.toISOString(),
            });
          }
        }
      } else {
        if (!authorizedTags.some((t) => t.idTag === cert.emaid)) {
          authorizedTags.push({
            idTag: cert.emaid,
            status: "Accepted",
            expiryDate: cert.expirationDate.toISOString(),
          });
        }
      }
    }

    return authorizedTags;
  }
}
