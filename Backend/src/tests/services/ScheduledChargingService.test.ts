import { jest } from "@jest/globals";

const mockPrisma: any = {
  charger: {
    findUnique: jest.fn(),
  },
  rfidUser: {
    findFirst: jest.fn(),
  },
  scheduledCharging: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  transaction: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockRemoteControl: any = {
  remoteStartTransaction: jest.fn(),
  remoteStopTransaction: jest.fn(),
  setChargingProfile: jest.fn(),
};

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => mockRemoteControl);

jest.unstable_mockModule("../../utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("ScheduledChargingService", () => {
  let ScheduledChargingService: any;

  beforeAll(async () => {
    const mod = await import("../../services/ScheduledChargingService.js");
    ScheduledChargingService = mod.ScheduledChargingService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isScheduleDueAt", () => {
    it("should correctly evaluate daily overnight schedules (e.g. 23:00 to 07:00)", () => {
      const schedule = {
        status: "Active",
        recurrence: "daily",
        startTime: "23:00",
        stopTime: "07:00",
      };

      // 02:30 AM should be inside window
      const dateInside = new Date("2026-08-30T02:30:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateInside)).toBe(true);

      // 23:15 should be inside window
      const dateNight = new Date("2026-08-30T23:15:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateNight)).toBe(true);

      // 14:00 should be outside window
      const dateOutside = new Date("2026-08-30T14:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateOutside)).toBe(false);
    });

    it("should correctly evaluate same-day daytime schedules (e.g. 09:00 to 17:00)", () => {
      const schedule = {
        status: "Active",
        recurrence: "daily",
        startTime: "09:00",
        stopTime: "17:00",
      };

      const dateInside = new Date("2026-08-30T11:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateInside)).toBe(true);

      const dateBefore = new Date("2026-08-30T08:30:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateBefore)).toBe(false);

      const dateAfter = new Date("2026-08-30T18:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, dateAfter)).toBe(false);
    });

    it("should evaluate weekdays recurrence (Mon-Fri only)", () => {
      const schedule = {
        status: "Active",
        recurrence: "weekdays",
        startTime: "08:00",
        stopTime: "16:00",
      };

      // 2026-08-31 is Monday (getDay() === 1)
      const monday = new Date("2026-08-31T10:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, monday)).toBe(true);

      // 2026-08-30 is Sunday (getDay() === 0)
      const sunday = new Date("2026-08-30T10:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, sunday)).toBe(false);
    });

    it("should evaluate weekends recurrence (Sat-Sun only)", () => {
      const schedule = {
        status: "Active",
        recurrence: "weekends",
        startTime: "08:00",
        stopTime: "16:00",
      };

      // 2026-08-30 is Sunday
      const sunday = new Date("2026-08-30T10:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, sunday)).toBe(true);

      // 2026-08-31 is Monday
      const monday = new Date("2026-08-31T10:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, monday)).toBe(false);
    });

    it("should evaluate custom days of week recurrence", () => {
      const schedule = {
        status: "Active",
        recurrence: "custom",
        daysOfWeek: ["mon", "wed", "fri"],
        startTime: "10:00",
        stopTime: "14:00",
      };

      // Monday (2026-08-31)
      const monday = new Date("2026-08-31T11:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, monday)).toBe(true);

      // Tuesday (2026-09-01)
      const tuesday = new Date("2026-09-01T11:00:00");
      expect(ScheduledChargingService.isScheduleDueAt(schedule, tuesday)).toBe(false);
    });

    it("should return false if status is Paused or Cancelled", () => {
      const schedule = {
        status: "Paused",
        recurrence: "daily",
        startTime: "00:00",
        stopTime: "23:59",
      };

      expect(ScheduledChargingService.isScheduleDueAt(schedule, new Date())).toBe(false);
    });
  });

  describe("createSchedule", () => {
    it("should create schedule in database and sync charging profile with charger", async () => {
      const mockCharger = {
        charger_id: 1,
        owner_id: 5,
        status: "online",
        name: "Station Alpha",
      };

      mockPrisma.charger.findUnique.mockResolvedValue(mockCharger as any);
      mockPrisma.rfidUser.findFirst.mockResolvedValue({
        rfid_tag: "TAG_123",
      } as any);

      const mockCreated = {
        id: 10,
        chargerId: 1,
        name: "Night Schedule",
        recurrence: "daily",
        startTime: "23:00",
        stopTime: "07:00",
        status: "Active",
        maxCurrentAmps: 16.0,
      };

      mockPrisma.scheduledCharging.create.mockResolvedValue(mockCreated as any);
      mockRemoteControl.setChargingProfile.mockResolvedValue({
        status: "Accepted",
      } as any);

      const res = await ScheduledChargingService.createSchedule(
        {
          chargerId: 1,
          name: "Night Schedule",
          recurrence: "daily",
          startTime: "23:00",
          stopTime: "07:00",
        },
        5,
        "user"
      );

      expect(res.id).toBe(10);
      expect(mockRemoteControl.setChargingProfile).toHaveBeenCalled();
    });
  });

  describe("executeNow", () => {
    it("should dispatch remoteStartTransaction if no active session and apply charging profile", async () => {
      const mockSchedule = {
        id: 15,
        chargerId: 2,
        connectorId: 1,
        idTag: "CARD_999",
        maxCurrentAmps: 32.0,
        status: "Active",
      };

      mockPrisma.scheduledCharging.findUnique.mockResolvedValue(mockSchedule as any);
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockRemoteControl.remoteStartTransaction.mockResolvedValue({
        status: "Accepted",
      } as any);
      mockRemoteControl.setChargingProfile.mockResolvedValue({
        status: "Accepted",
      } as any);
      mockPrisma.scheduledCharging.update.mockResolvedValue({
        ...mockSchedule,
        status: "Executing",
      } as any);

      const result = await ScheduledChargingService.executeNow(15, 1, "admin");

      expect(result.success).toBe(true);
      expect(mockRemoteControl.remoteStartTransaction).toHaveBeenCalledWith({
        chargerId: 2,
        connectorId: 1,
        idTag: "CARD_999",
      });
      expect(mockRemoteControl.setChargingProfile).toHaveBeenCalled();
    });
  });

  describe("toggleSchedule", () => {
    it("should flip status between Active and Paused", async () => {
      const mockSchedule = {
        id: 20,
        status: "Active",
      };

      mockPrisma.scheduledCharging.findUnique.mockResolvedValue(mockSchedule as any);
      mockPrisma.scheduledCharging.update.mockResolvedValue({
        id: 20,
        status: "Paused",
      } as any);

      const result = await ScheduledChargingService.toggleSchedule(20, 1, "admin");
      expect(result.status).toBe("Paused");
    });
  });
});
