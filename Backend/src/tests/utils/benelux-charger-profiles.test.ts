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
    expect(profileIds).toContain("raedian-nex-optimized");
    expect(profileIds).toContain("raedian-gemini-optimized");
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

  it("should configure Raedian NEX and Gemini profiles with exact specifications", () => {
    const nex = BENELUX_CHARGER_PROFILES.find((p) => p.id === "raedian-nex-optimized");
    expect(nex).toBeDefined();
    expect(nex?.manufacturer).toBe("Raedian");
    expect(nex?.category).toBe("Smart & Solar AC");

    const nexKeys = new Map(nex!.items.map((i) => [i.key, i.value]));
    expect(nexKeys.get("HeartbeatInterval")).toBe("60");
    expect(nexKeys.get("ConnectionTimeOut")).toBe("30");
    expect(nexKeys.get("ResetRetries")).toBe("3");
    expect(nexKeys.get("TransactionMessageAttempts")).toBe("3");
    expect(nexKeys.get("TransactionMessageRetryInterval")).toBe("10");
    expect(nexKeys.get("AuthorizeRemoteTxRequests")).toBe("true");
    expect(nexKeys.get("LocalAuthorizeOffline")).toBe("true");
    expect(nexKeys.get("LocalPreAuthorize")).toBe("true");
    expect(nexKeys.get("AllowOfflineTxForUnknownId")).toBe("false");
    expect(nexKeys.get("UnlockConnectorOnEVSideDisconnect")).toBe("true");
    expect(nexKeys.get("StopTransactionOnEVSideDisconnect")).toBe("true");
    expect(nexKeys.get("StopTransactionOnInvalidId")).toBe("true");
    expect(nexKeys.get("MeterValueSampleInterval")).toBe("60");
    expect(nexKeys.get("MeterValuesSampledData")).toBe("Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage");
    expect(nexKeys.get("StopTxnSampledData")).toBe("Energy.Active.Import.Register");
    expect(nexKeys.get("NumberOfConnectors")).toBe("1");
    expect(nexKeys.get("ChargingScheduleAllowedChargingRateUnit")).toBe("Current,Power");

    const gemini = BENELUX_CHARGER_PROFILES.find((p) => p.id === "raedian-gemini-optimized");
    expect(gemini).toBeDefined();
    expect(gemini?.manufacturer).toBe("Raedian");
    expect(gemini?.category).toBe("Commercial & Fleet");

    const geminiKeys = new Map(gemini!.items.map((i) => [i.key, i.value]));
    expect(geminiKeys.get("HeartbeatInterval")).toBe("60");
    expect(geminiKeys.get("ConnectionTimeOut")).toBe("30");
    expect(geminiKeys.get("ResetRetries")).toBe("3");
    expect(geminiKeys.get("TransactionMessageAttempts")).toBe("5");
    expect(geminiKeys.get("TransactionMessageRetryInterval")).toBe("15");
    expect(geminiKeys.get("AuthorizeRemoteTxRequests")).toBe("true");
    expect(geminiKeys.get("LocalAuthorizeOffline")).toBe("true");
    expect(geminiKeys.get("LocalPreAuthorize")).toBe("false");
    expect(geminiKeys.get("AllowOfflineTxForUnknownId")).toBe("false");
    expect(geminiKeys.get("UnlockConnectorOnEVSideDisconnect")).toBe("true");
    expect(geminiKeys.get("StopTransactionOnEVSideDisconnect")).toBe("true");
    expect(geminiKeys.get("StopTransactionOnInvalidId")).toBe("true");
    expect(geminiKeys.get("MeterValueSampleInterval")).toBe("30");
    expect(geminiKeys.get("MeterValuesSampledData")).toBe("Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,Current.Offered,Power.Offered");
    expect(geminiKeys.get("StopTxnSampledData")).toBe("Energy.Active.Import.Register,Current.Import,Power.Active.Import");
    expect(geminiKeys.get("NumberOfConnectors")).toBe("2");
    expect(geminiKeys.get("MaxChargingProfilesInstalled")).toBe("10");
    expect(geminiKeys.get("ChargingScheduleAllowedChargingRateUnit")).toBe("Current,Power");
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
