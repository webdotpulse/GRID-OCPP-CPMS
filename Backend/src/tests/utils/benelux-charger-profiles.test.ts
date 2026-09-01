import { BENELUX_CHARGER_PROFILES } from "../../utils/benelux-charger-profiles.js";

describe("Benelux & Universal OCPP Configuration Profiles", () => {
  it("should define all major Benelux charger profiles and the Universal Baseline", () => {
    expect(BENELUX_CHARGER_PROFILES.length).toBeGreaterThanOrEqual(17);

    const profileIds = BENELUX_CHARGER_PROFILES.map((p) => p.id);
    expect(profileIds).toContain("universal-general-optimized");
    expect(profileIds).toContain("alfen-eve-pro-optimized");
    expect(profileIds).toContain("evbox-commercial-optimized");
    expect(profileIds).toContain("kempower-dc-satellite-optimized");
    expect(profileIds).toContain("abb-terra-ac-optimized");
    expect(profileIds).toContain("abb-terra-dc-fast-optimized");
    expect(profileIds).toContain("easee-charge-optimized");
    expect(profileIds).toContain("zaptec-pro-cluster-optimized");
    expect(profileIds).toContain("smappee-solar-ems-optimized");
    expect(profileIds).toContain("wallbox-pulsar-supernova-optimized");
    expect(profileIds).toContain("compleo-ebox-duo-optimized");
    expect(profileIds).toContain("ekoenergetyka-axon-hpc-optimized");
    expect(profileIds).toContain("tritium-rtm-pkm-optimized");
    expect(profileIds).toContain("mennekes-amtron-amedio-optimized");
    expect(profileIds).toContain("schneider-evlink-pro-optimized");
    expect(profileIds).toContain("phoenix-contact-charx-sec3000-dc-optimized");
    expect(profileIds).toContain("phoenix-contact-charx-sec1000-ac-optimized");
    expect(profileIds).toContain("bender-cc613-charge-controller-optimized");
  });

  it("should contain valid and complete keys in every profile", () => {
    for (const profile of BENELUX_CHARGER_PROFILES) {
      expect(profile.name).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.items.length).toBeGreaterThan(5);

      const keys = profile.items.map((i) => i.key);
      expect(keys).toContain("MeterValueSampleInterval");
      expect(keys).toContain("MeterValuesSampledData");

      // Verify that sample interval is a positive integer
      const sampleIntervalItem = profile.items.find((i) => i.key === "MeterValueSampleInterval");
      expect(sampleIntervalItem).toBeDefined();
      const sampleInterval = parseInt(sampleIntervalItem!.value, 10);
      expect(sampleInterval).toBeGreaterThanOrEqual(5);
      expect(sampleInterval).toBeLessThanOrEqual(300);

      // Verify measurands include Energy.Active.Import.Register
      const measurandsItem = profile.items.find((i) => i.key === "MeterValuesSampledData");
      expect(measurandsItem).toBeDefined();
      expect(measurandsItem!.value).toContain("Energy.Active.Import.Register");
    }
  });

  it("should configure DC fast chargers with strict cable retention safety", () => {
    const dcProfiles = BENELUX_CHARGER_PROFILES.filter((p) =>
      p.category === "High-Power DC / HPC"
    );

    expect(dcProfiles.length).toBeGreaterThanOrEqual(4);

    for (const profile of dcProfiles) {
      const stopOnEvDisconnect = profile.items.find((i) => i.key === "StopTransactionOnEVSideDisconnect");
      if (stopOnEvDisconnect) {
        expect(stopOnEvDisconnect.value).toBe("false");
      }

      const unlockOnEvDisconnect = profile.items.find((i) => i.key === "UnlockConnectorOnEVSideDisconnect");
      if (unlockOnEvDisconnect) {
        expect(unlockOnEvDisconnect.value).toBe("false");
      }
    }
  });

  it("should configure Universal baseline profile with safe defaults and resilient retry settings", () => {
    const universal = BENELUX_CHARGER_PROFILES.find((p) => p.id === "universal-general-optimized");
    expect(universal).toBeDefined();

    const itemsMap = new Map(universal!.items.map((i) => [i.key, i.value]));
    expect(itemsMap.get("MeterValueSampleInterval")).toBe("30");
    expect(itemsMap.get("AuthorizeRemoteTxRequests")).toBe("true");
    expect(itemsMap.get("StopTransactionOnEVSideDisconnect")).toBe("true");
    expect(itemsMap.get("UnlockConnectorOnEVSideDisconnect")).toBe("true");
    expect(itemsMap.get("TransactionMessageAttempts")).toBe("3");
    expect(itemsMap.get("ClockAlignedDataInterval")).toBe("900");
  });
});
