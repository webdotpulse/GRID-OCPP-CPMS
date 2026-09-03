import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { remoteStartTransaction, setChargingProfile } from "../ocpp/remoteControl.js";
import type { SetChargingProfileRequest } from "../types/index.js";

export interface CreateScheduledChargingDto {
  chargerId: number;
  connectorId?: number;
  idTag?: string;
  name?: string;
  scheduleType?: "time_window" | "departure_time" | "cheapest_tariff" | "solar_optimal";
  recurrence?: "once" | "daily" | "weekdays" | "weekends" | "custom";
  daysOfWeek?: string[];
  startTime?: string;
  stopTime?: string;
  startDate?: string | Date;
  stopDate?: string | Date;
  departureTime?: string;
  maxCurrentAmps?: number;
  maxPowerKw?: number;
  targetSoc?: number;
  energyLimitKwh?: number;
  userId?: number;
}

export interface UpdateScheduledChargingDto {
  chargerId?: number;
  connectorId?: number;
  idTag?: string;
  name?: string;
  scheduleType?: "time_window" | "departure_time" | "cheapest_tariff" | "solar_optimal";
  recurrence?: "once" | "daily" | "weekdays" | "weekends" | "custom";
  daysOfWeek?: string[];
  startTime?: string;
  stopTime?: string;
  startDate?: string | Date;
  stopDate?: string | Date;
  departureTime?: string;
  maxCurrentAmps?: number;
  maxPowerKw?: number;
  targetSoc?: number;
  energyLimitKwh?: number;
  status?: "Active" | "Paused" | "Executing" | "Completed" | "Cancelled";
}

export class ScheduledChargingService {
  /**
   * Create a new scheduled charging plan
   */
  public static async createSchedule(data: CreateScheduledChargingDto, currentUserId?: number, role?: string) {
    const {
      chargerId,
      connectorId = 1,
      idTag,
      name = "Scheduled Charge",
      scheduleType = "time_window",
      recurrence = "once",
      daysOfWeek,
      startTime,
      stopTime,
      startDate,
      stopDate,
      departureTime,
      maxCurrentAmps = 16.0,
      maxPowerKw = 11.0,
      targetSoc,
      energyLimitKwh,
      userId,
    } = data;

    // Verify charger exists
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: { owner: true, chargingStation: true },
    });

    if (!charger) {
      throw new Error(`Charger ${chargerId} not found`);
    }

    // Role check: non-admin can only create schedules for chargers they own or have company access to
    if (role !== "admin" && role !== "superadmin" && currentUserId) {
      if (charger.owner_id !== currentUserId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { id: true, companyId: true, role: true },
        });
        const hasCompanyAccess = !!(currentUser?.companyId && (
          charger.chargingStation?.companyId === currentUser.companyId ||
          charger.ownerCompanyId === currentUser.companyId
        ));
        if (!hasCompanyAccess) {
          throw new Error("Unauthorized to schedule charging on this charger");
        }
      }
    }

    // Resolve owner user id
    const finalUserId = (role === "admin" || role === "superadmin")
      ? (userId || charger.owner_id || currentUserId)
      : (currentUserId || charger.owner_id);

    // Resolve RFID tag if not explicitly given
    let finalIdTag = idTag;
    if (!finalIdTag && finalUserId) {
      const userTag = await prisma.rfidUser.findFirst({
        where: {
          OR: [
            { owner_id: finalUserId },
            { holderUserId: finalUserId },
          ],
          active: true,
        },
        orderBy: { rfid_user_id: "desc" },
      });
      if (userTag) {
        finalIdTag = userTag.rfid_tag;
      }
    }

    // Create DB record
    const schedule = await prisma.scheduledCharging.create({
      data: {
        chargerId,
        connectorId,
        userId: finalUserId || null,
        idTag: finalIdTag || "AUTO_SCHEDULED",
        name,
        scheduleType,
        recurrence,
        daysOfWeek: daysOfWeek || [],
        startTime: startTime || null,
        stopTime: stopTime || null,
        startDate: startDate ? new Date(startDate) : null,
        stopDate: stopDate ? new Date(stopDate) : null,
        departureTime: departureTime || null,
        maxCurrentAmps: Number(maxCurrentAmps) || 16.0,
        maxPowerKw: Number(maxPowerKw) || 11.0,
        targetSoc: targetSoc ? Number(targetSoc) : null,
        energyLimitKwh: energyLimitKwh ? Number(energyLimitKwh) : null,
        status: "Active",
        lastStatus: "Idle",
      },
      include: {
        charger: {
          select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info(`Scheduled charging plan #${schedule.id} ("${schedule.name}") created for charger #${chargerId}`);

    // If charger is online and hardware supports it, attempt to sync profile
    if (charger.status !== "offline") {
      this.syncChargingProfileWithCharger(schedule).catch((err) =>
        logger.warn(`Failed to push smart charging profile for schedule #${schedule.id}: ${err.message}`)
      );
    }

    return schedule;
  }

  /**
   * Get list of scheduled charging plans with filtering and pagination
   */
  public static async getSchedules(filter: {
    userId?: number;
    role?: string;
    chargerId?: number;
    status?: string;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const { userId, role, chargerId, status, search, skip = 0, take = 50 } = filter;

    const where: any = {};

    // Multi-tenant isolation: non-admin can only see own schedules
    if (role !== "admin" && role !== "superadmin" && userId) {
      where.userId = userId;
    }

    if (chargerId) {
      where.chargerId = Number(chargerId);
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { charger: { name: { contains: search, mode: "insensitive" } } },
        { idTag: { contains: search, mode: "insensitive" } },
      ];
    }

    const [schedules, total] = await Promise.all([
      prisma.scheduledCharging.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: "desc" },
        include: {
          charger: {
            select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.scheduledCharging.count({ where }),
    ]);

    return { data: schedules, total };
  }

  /**
   * Get single schedule by ID
   */
  public static async getScheduleById(id: number, currentUserId?: number, role?: string) {
    const schedule = await prisma.scheduledCharging.findUnique({
      where: { id },
      include: {
        charger: {
          select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!schedule) {
      throw new Error(`Scheduled charging plan #${id} not found`);
    }

    if (role !== "admin" && role !== "superadmin" && currentUserId && schedule.userId !== currentUserId) {
      throw new Error("Unauthorized access to scheduled charging plan");
    }

    return schedule;
  }

  /**
   * Update an existing schedule
   */
  public static async updateSchedule(
    id: number,
    data: UpdateScheduledChargingDto,
    currentUserId?: number,
    role?: string
  ) {
    const existing = await this.getScheduleById(id, currentUserId, role);

    const updated = await prisma.scheduledCharging.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        scheduleType: data.scheduleType !== undefined ? data.scheduleType : existing.scheduleType,
        recurrence: data.recurrence !== undefined ? data.recurrence : existing.recurrence,
        daysOfWeek: data.daysOfWeek !== undefined ? data.daysOfWeek : (existing.daysOfWeek as any),
        startTime: data.startTime !== undefined ? data.startTime : existing.startTime,
        stopTime: data.stopTime !== undefined ? data.stopTime : existing.stopTime,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : existing.startDate,
        stopDate: data.stopDate !== undefined ? (data.stopDate ? new Date(data.stopDate) : null) : existing.stopDate,
        departureTime: data.departureTime !== undefined ? data.departureTime : existing.departureTime,
        maxCurrentAmps: data.maxCurrentAmps !== undefined ? Number(data.maxCurrentAmps) : existing.maxCurrentAmps,
        maxPowerKw: data.maxPowerKw !== undefined ? Number(data.maxPowerKw) : existing.maxPowerKw,
        targetSoc: data.targetSoc !== undefined ? (data.targetSoc ? Number(data.targetSoc) : null) : existing.targetSoc,
        energyLimitKwh: data.energyLimitKwh !== undefined ? (data.energyLimitKwh ? Number(data.energyLimitKwh) : null) : existing.energyLimitKwh,
        status: data.status !== undefined ? data.status : existing.status,
        idTag: data.idTag !== undefined ? data.idTag : existing.idTag,
        connectorId: data.connectorId !== undefined ? Number(data.connectorId) : existing.connectorId,
      },
      include: {
        charger: {
          select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info(`Scheduled charging plan #${id} updated`);

    if (updated.status === "Active") {
      this.syncChargingProfileWithCharger(updated).catch((err) =>
        logger.warn(`Failed to sync profile for schedule #${id}: ${err.message}`)
      );
    }

    return updated;
  }

  /**
   * Delete a scheduled charging plan
   */
  public static async deleteSchedule(id: number, currentUserId?: number, role?: string) {
    const existing = await this.getScheduleById(id, currentUserId, role);

    await prisma.scheduledCharging.delete({
      where: { id: existing.id },
    });

    logger.info(`Scheduled charging plan #${id} deleted`);
    return { success: true, message: `Schedule #${id} successfully deleted` };
  }

  /**
   * Toggle active/paused status of a schedule
   */
  public static async toggleSchedule(id: number, currentUserId?: number, role?: string) {
    const existing = await this.getScheduleById(id, currentUserId, role);
    const newStatus = existing.status === "Active" ? "Paused" : "Active";

    const updated = await prisma.scheduledCharging.update({
      where: { id },
      data: { status: newStatus },
      include: {
        charger: {
          select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info(`Schedule #${id} toggled to ${newStatus}`);
    return updated;
  }

  /**
   * Immediately trigger execution of the scheduled charging session
   */
  public static async executeNow(id: number, currentUserId?: number, role?: string) {
    const schedule = await this.getScheduleById(id, currentUserId, role);

    logger.info(`Manually triggering execution for schedule #${id} on charger #${schedule.chargerId}`);

    // Check for active transactions on this charger
    const activeTx = await prisma.transaction.findFirst({
      where: {
        charger_id: schedule.chargerId,
        status: { in: ["initiated", "charging"] },
      },
      orderBy: { id: "desc" },
    });

    let remoteStartRes: any = null;

    if (!activeTx) {
      // Send RemoteStartTransaction
      remoteStartRes = await remoteStartTransaction({
        chargerId: schedule.chargerId,
        connectorId: schedule.connectorId,
        idTag: schedule.idTag || "SCHEDULED-EXEC-NOW",
      });

      if (remoteStartRes.status !== "Accepted") {
        await prisma.scheduledCharging.update({
          where: { id },
          data: {
            lastStatus: "Failed",
            lastError: `Charger returned ${remoteStartRes.status}: ${remoteStartRes.error || "Unable to start"}`,
          },
        });
        throw new Error(`Failed to start session on charger: ${remoteStartRes.error || remoteStartRes.status}`);
      }
    }

    // Apply smart charging profile
    await this.syncChargingProfileWithCharger(schedule);

    const updated = await prisma.scheduledCharging.update({
      where: { id },
      data: {
        status: "Executing",
        lastExecutedAt: new Date(),
        lastStatus: "Started",
        lastError: null,
      },
      include: {
        charger: {
          select: { charger_id: true, name: true, model: true, manufacturer: true, status: true },
        },
      },
    });

    return {
      success: true,
      message: `Scheduled charge #${id} executed successfully`,
      schedule: updated,
      remoteStart: remoteStartRes,
    };
  }

  /**
   * Helper: Check if a schedule window is due at given date and time
   */
  public static isScheduleDueAt(schedule: any, targetDate: Date = new Date()): boolean {
    if (schedule.status !== "Active" && schedule.status !== "Executing") {
      return false;
    }

    // 1. One-time schedule with explicit Date bounds
    if (schedule.recurrence === "once") {
      if (schedule.startDate && schedule.stopDate) {
        return targetDate >= new Date(schedule.startDate) && targetDate <= new Date(schedule.stopDate);
      }
      if (schedule.startDate && !schedule.stopDate) {
        // If only start date is given, valid for 4 hours by default
        const start = new Date(schedule.startDate);
        const end = new Date(start.getTime() + 4 * 3600 * 1000);
        return targetDate >= start && targetDate <= end;
      }
    }

    // 2. Departure Time mode: e.g. "07:30" - charging window is the 4-6 hours leading up to departure
    if (schedule.scheduleType === "departure_time" && schedule.departureTime) {
      const [depH, depM] = schedule.departureTime.split(":").map(Number);
      const currentH = targetDate.getHours();
      const currentM = targetDate.getMinutes();
      const currentMinutes = currentH * 60 + currentM;
      const depMinutes = depH * 60 + depM;

      // Charge in the 5 hours prior to departure time
      const windowStart = (depMinutes - 5 * 60 + 24 * 60) % (24 * 60);
      if (windowStart < depMinutes) {
        return currentMinutes >= windowStart && currentMinutes <= depMinutes;
      } else {
        // Overnight window
        return currentMinutes >= windowStart || currentMinutes <= depMinutes;
      }
    }

    // 3. Recurring schedules (Daily, Weekdays, Weekends, Custom) with startTime & stopTime (HH:mm)
    if (schedule.startTime && schedule.stopTime) {
      const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const currentDayKey = dayKeys[dayOfWeek];

      let dayMatches = false;
      if (schedule.recurrence === "daily" || schedule.recurrence === "once") {
        dayMatches = true;
      } else if (schedule.recurrence === "weekdays") {
        dayMatches = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (schedule.recurrence === "weekends") {
        dayMatches = dayOfWeek === 0 || dayOfWeek === 6;
      } else if (schedule.recurrence === "custom") {
        const customDays = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
        dayMatches = customDays.map((d: string) => d.toLowerCase()).includes(currentDayKey);
      }

      if (!dayMatches) {
        return false;
      }

      const [startH, startM] = schedule.startTime.split(":").map(Number);
      const [stopH, stopM] = schedule.stopTime.split(":").map(Number);

      const currentMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
      const startMinutes = startH * 60 + startM;
      const stopMinutes = stopH * 60 + stopM;

      if (startMinutes < stopMinutes) {
        // Same-day window (e.g. 09:00 -> 17:00)
        return currentMinutes >= startMinutes && currentMinutes <= stopMinutes;
      } else {
        // Overnight window (e.g. 23:00 -> 07:00)
        return currentMinutes >= startMinutes || currentMinutes <= stopMinutes;
      }
    }

    return false;
  }

  /**
   * Background sweep engine called every minute by node-cron
   */
  public static async processDueSchedules(now: Date = new Date()): Promise<void> {
    try {
      const schedules = await prisma.scheduledCharging.findMany({
        where: {
          status: { in: ["Active", "Executing"] },
        },
        include: {
          charger: true,
        },
      });

      for (const schedule of schedules) {
        try {
          const isDue = this.isScheduleDueAt(schedule, now);

          if (isDue) {
            // Should be charging!
            if (schedule.status === "Active") {
              logger.info(`[ScheduledChargingEngine] Schedule #${schedule.id} ("${schedule.name}") entering active window`);

              // Check if session is already active
              const activeTx = await prisma.transaction.findFirst({
                where: {
                  charger_id: schedule.chargerId,
                  status: { in: ["initiated", "charging"] },
                },
              });

              if (!activeTx) {
                // Charger ready, trigger RemoteStart
                if (schedule.charger.status !== "offline") {
                  logger.info(`[ScheduledChargingEngine] Sending RemoteStart to charger #${schedule.chargerId}`);
                  await remoteStartTransaction({
                    chargerId: schedule.chargerId,
                    connectorId: schedule.connectorId,
                    idTag: schedule.idTag || "AUTO_SCHEDULED",
                  }).catch((err) =>
                    logger.warn(`RemoteStart failed for schedule #${schedule.id}: ${err.message}`)
                  );
                }
              }

              // Apply power/current limit
              await this.syncChargingProfileWithCharger(schedule).catch((err) =>
                logger.warn(`Profile sync failed for schedule #${schedule.id}: ${err.message}`)
              );

              await prisma.scheduledCharging.update({
                where: { id: schedule.id },
                data: {
                  status: "Executing",
                  lastExecutedAt: now,
                  lastStatus: "Started",
                  lastError: null,
                },
              });
            }
          } else {
            // Not due or window ended
            if (schedule.status === "Executing") {
              logger.info(`[ScheduledChargingEngine] Schedule #${schedule.id} ("${schedule.name}") completed active window`);

              // Mark as Completed if one-time, or return to Active if recurring
              const nextStatus = schedule.recurrence === "once" ? "Completed" : "Active";

              await prisma.scheduledCharging.update({
                where: { id: schedule.id },
                data: {
                  status: nextStatus,
                  lastStatus: "CompletedCycle",
                },
              });
            }
          }
        } catch (scheduleErr: any) {
          logger.error(`Error processing schedule #${schedule.id}: ${scheduleErr.message}`);
          await prisma.scheduledCharging.update({
            where: { id: schedule.id },
            data: {
              lastError: scheduleErr.message,
            },
          }).catch(() => {});
        }
      }
    } catch (globalErr: any) {
      logger.error(`[ScheduledChargingEngine] Global processing error: ${globalErr.message}`);
    }
  }

  /**
   * Synchronize charging profile with charger over OCPP
   */
  public static async syncChargingProfileWithCharger(schedule: any): Promise<void> {
    try {
      const profileId = 500 + (schedule.id % 500); // Stable profile ID 500-999

      const profileRequest: SetChargingProfileRequest = {
        chargerId: schedule.chargerId,
        connectorId: schedule.connectorId || 1,
        csChargingProfiles: {
          chargingProfileId: profileId,
          stackLevel: 2,
          chargingProfilePurpose: "TxDefaultProfile",
          chargingProfileKind: schedule.recurrence === "once" ? "Absolute" : "Recurring",
          recurrencyKind: schedule.recurrence === "daily" ? "Daily" : undefined,
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              {
                startPeriod: 0,
                limit: schedule.maxCurrentAmps || 16.0,
              },
            ],
          },
        },
      };

      const result = await setChargingProfile(profileRequest);
      logger.info(`OCPP SetChargingProfile dispatched for schedule #${schedule.id} -> ${result.status}`);
    } catch (err: any) {
      logger.warn(`Could not sync charging profile for schedule #${schedule.id}: ${err.message}`);
    }
  }
}
