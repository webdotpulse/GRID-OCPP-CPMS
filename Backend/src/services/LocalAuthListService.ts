import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { sendLocalList, getLocalListVersion } from "../ocpp/remoteControl.js";

export interface LocalAuthListItem {
  idTag: string;
  status: "Accepted" | "Blocked" | "Expired" | "Invalid" | "ConcurrentTx";
  parentIdTag?: string;
  expiryDate?: string;
}

export class LocalAuthListService {
  /**
   * Retrieve the local authorization list status and cached entries for a given charger
   */
  public static async getLocalAuthList(chargerId: number) {
    let localList = await prisma.localAuthList.findUnique({
      where: { chargerId },
      include: {
        entries: {
          orderBy: { idTag: "asc" },
        },
      },
    });

    if (!localList) {
      localList = await prisma.localAuthList.create({
        data: {
          chargerId,
          listVersion: 0,
          status: "Outdated",
        },
        include: {
          entries: true,
        },
      });
    }

    return localList;
  }

  /**
   * Synchronize the local authorization list to a specific charger
   */
  public static async syncLocalAuthList(
    chargerId: number,
    updateType: "Full" | "Differential" = "Full"
  ): Promise<{ success: boolean; status: string; listVersion: number; count: number; error?: string }> {
    try {
      const charger = await prisma.charger.findUnique({
        where: { charger_id: chargerId },
        include: { localAuthList: true },
      });

      if (!charger) {
        return { success: false, status: "Failed", listVersion: 0, count: 0, error: "Charger not found" };
      }

      // Fetch authorized RFID tags and ISO 15118 EMAID tokens filtered by charger access and card scope
      const { AuthorizationService } = await import("./AuthorizationService.js");
      const authItems: LocalAuthListItem[] = await AuthorizationService.getAuthorizedEntriesForCharger(chargerId);

      const currentVersion = charger.localAuthList?.listVersion || 0;
      const targetVersion = currentVersion + 1;

      logger.info(
        `Synchronizing LocalAuthList for charger ${chargerId} (Version: ${targetVersion}, Type: ${updateType}, Items: ${authItems.length})`
      );

      // Send OCPP SendLocalList call
      const rpcResult = await sendLocalList(
        chargerId,
        targetVersion,
        updateType,
        authItems.map((item) => ({
          idTag: item.idTag,
          idTagInfo: {
            status: item.status,
            expiryDate: item.expiryDate,
            parentIdTag: item.parentIdTag,
          },
        }))
      );

      const isAccepted = rpcResult.status === "Accepted";
      const finalStatus = isAccepted ? "Synchronized" : rpcResult.status || "Failed";

      // Upsert local auth list record
      const localListRecord = await prisma.localAuthList.upsert({
        where: { chargerId },
        create: {
          chargerId,
          listVersion: isAccepted ? targetVersion : currentVersion,
          status: finalStatus,
          lastSyncedAt: isAccepted ? new Date() : undefined,
        },
        update: {
          listVersion: isAccepted ? targetVersion : currentVersion,
          status: finalStatus,
          lastSyncedAt: isAccepted ? new Date() : undefined,
        },
      });

      if (isAccepted) {
        // Replace entries with current synchronized snapshot
        await prisma.localAuthListEntry.deleteMany({
          where: { localAuthListId: localListRecord.id },
        });

        if (authItems.length > 0) {
          await prisma.localAuthListEntry.createMany({
            data: authItems.map((item) => ({
              localAuthListId: localListRecord.id,
              idTag: item.idTag,
              status: item.status,
              parentIdTag: item.parentIdTag || null,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            })),
          });
        }
      }

      return {
        success: isAccepted,
        status: finalStatus,
        listVersion: localListRecord.listVersion,
        count: authItems.length,
        error: rpcResult.error,
      };
    } catch (error: any) {
      logger.error(`Error in syncLocalAuthList for charger ${chargerId}: ${error.message}`);
      return {
        success: false,
        status: "Failed",
        listVersion: 0,
        count: 0,
        error: error.message || "Synchronization failed",
      };
    }
  }

  /**
   * Query the charger hardware directly for its active Local List Version
   */
  public static async queryChargerListVersion(chargerId: number): Promise<{ listVersion: number; status: string }> {
    try {
      const result = await getLocalListVersion(chargerId);
      const hardwareVersion = result.listVersion || 0;

      // Update local db if status matches
      const localList = await prisma.localAuthList.findUnique({
        where: { chargerId },
      });

      if (localList) {
        const isMatched = localList.listVersion === hardwareVersion;
        await prisma.localAuthList.update({
          where: { id: localList.id },
          data: {
            status: isMatched ? "Synchronized" : "Outdated",
          },
        });
      }

      return {
        listVersion: hardwareVersion,
        status: result.status,
      };
    } catch (error: any) {
      logger.error(`Error querying list version for charger ${chargerId}: ${error.message}`);
      return { listVersion: 0, status: "Failed" };
    }
  }

  /**
   * Trigger automatic synchronization across all active chargers
   */
  public static async syncAllChargers(): Promise<void> {
    try {
      const chargers = await prisma.charger.findMany({
        select: { charger_id: true, status: true },
      });

      logger.info(`Triggering background LocalAuthList sync for ${chargers.length} chargers`);
      for (const ch of chargers) {
        this.syncLocalAuthList(ch.charger_id, "Full").catch((err) =>
          logger.warn(`Background sync failed for charger ${ch.charger_id}: ${err.message}`)
        );
      }
    } catch (error) {
      logger.error(`Error in syncAllChargers: ${error}`);
    }
  }
}
