import { jest } from "@jest/globals";

const mockSetChargingProfile = jest.fn() as any;

jest.unstable_mockModule("../../ocpp/remoteControl.js", () => ({
  setChargingProfile: mockSetChargingProfile,
}));

const { PhaseCommutationService } = await import("../../services/PhaseCommutationService.js");
const { prisma } = await import("../../config/database.js");

describe("PhaseCommutationService (1-Phase ⇄ 3-Phase Dynamic Switching)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should switch to 1-Phase when available power is between 1.4 kW and 4.1 kW", async () => {
    const mockCharger = {
      charger_id: 101,
      name: "Charger-Alpha",
      currentPhaseMode: "3-Phase",
      lastPhaseSwitchAt: null,
      phaseCommutationSupported: true,
      power_capacity: 11.0,
    };

    jest.spyOn(prisma.charger, "findUnique").mockResolvedValue(mockCharger as any);
    jest.spyOn(prisma.charger, "update").mockResolvedValue({
      ...mockCharger,
      currentPhaseMode: "1-Phase",
    } as any);
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });

    const result = await PhaseCommutationService.evaluatePhaseCommutation({
      chargerId: 101,
      availablePowerKw: 2.3, // 2.3 kW is ~10A on 1-phase (230V)
    });

    expect(result.commutationTriggered).toBe(true);
    expect(result.targetPhaseMode).toBe("1-Phase");
    expect(result.numberPhases).toBe(1);
    expect(result.targetLimitAmps).toBe(10); // floor(2300 / 230)
    expect(mockSetChargingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        chargerId: 101,
        csChargingProfiles: expect.objectContaining({
          chargingSchedule: expect.objectContaining({
            chargingSchedulePeriod: [
              expect.objectContaining({
                limit: 10,
                numberPhases: 1,
              }),
            ],
          }),
        }),
      })
    );
  });

  it("should switch to 3-Phase when available power is >= 4.14 kW", async () => {
    const mockCharger = {
      charger_id: 102,
      name: "Charger-Beta",
      currentPhaseMode: "1-Phase",
      lastPhaseSwitchAt: null,
      phaseCommutationSupported: true,
      power_capacity: 22.0,
    };

    jest.spyOn(prisma.charger, "findUnique").mockResolvedValue(mockCharger as any);
    jest.spyOn(prisma.charger, "update").mockResolvedValue({
      ...mockCharger,
      currentPhaseMode: "3-Phase",
    } as any);
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });

    const result = await PhaseCommutationService.evaluatePhaseCommutation({
      chargerId: 102,
      availablePowerKw: 11.0, // 11 kW is ~16A on 3-phase (3*230V)
    });

    expect(result.commutationTriggered).toBe(true);
    expect(result.targetPhaseMode).toBe("3-Phase");
    expect(result.numberPhases).toBe(3);
    expect(result.targetLimitAmps).toBe(15); // floor(11000 / (3 * 230)) = 15A
    expect(mockSetChargingProfile).toHaveBeenCalled();
  });

  it("should prevent rapid switching during dwell-time cooldown", async () => {
    const mockCharger = {
      charger_id: 103,
      name: "Charger-Gamma",
      currentPhaseMode: "3-Phase",
      lastPhaseSwitchAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago (< 180s dwell time)
      phaseCommutationSupported: true,
    };

    jest.spyOn(prisma.charger, "findUnique").mockResolvedValue(mockCharger as any);

    const result = await PhaseCommutationService.evaluatePhaseCommutation({
      chargerId: 103,
      availablePowerKw: 2.0, // Should want 1-Phase, but blocked by dwell time
    });

    expect(result.commutationTriggered).toBe(false);
    expect(result.reason).toContain("Dwell-time cooldown active");
    expect(mockSetChargingProfile).not.toHaveBeenCalled();
  });

  it("should support manual phase override", async () => {
    const mockCharger = {
      charger_id: 104,
      name: "Charger-Delta",
      currentPhaseMode: "3-Phase",
    };

    jest.spyOn(prisma.charger, "update").mockResolvedValue(mockCharger as any);
    mockSetChargingProfile.mockResolvedValue({ status: "Accepted" });

    const result = await PhaseCommutationService.setManualPhaseMode(104, "1-Phase", 32);

    expect(result.commutationTriggered).toBe(true);
    expect(result.targetPhaseMode).toBe("1-Phase");
    expect(result.numberPhases).toBe(1);
    expect(result.targetLimitAmps).toBe(32);
    expect(mockSetChargingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        chargerId: 104,
        csChargingProfiles: expect.objectContaining({
          chargingSchedule: expect.objectContaining({
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 32, numberPhases: 1 }],
          }),
        }),
      })
    );
  });
});
