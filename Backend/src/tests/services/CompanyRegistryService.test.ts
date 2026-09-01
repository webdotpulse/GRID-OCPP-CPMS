import { describe, it, expect } from "@jest/globals";
import { CompanyRegistryService } from "../../services/CompanyRegistryService.js";

describe("CompanyRegistryService (Belgian KBO & Dutch KvK)", () => {
  it("should normalize and format Belgian KBO enterprise numbers", () => {
    expect(CompanyRegistryService.formatKboNumber("0403227515")).toBe("0403.227.515");
    expect(CompanyRegistryService.formatBelgianVat("0403227515")).toBe("BE 0403.227.515");
  });

  it("should format Dutch VAT numbers", () => {
    expect(CompanyRegistryService.formatDutchVat("851406456B01")).toBe("NL851406456B01");
    expect(CompanyRegistryService.formatDutchVat("NL851406456B01")).toBe("NL851406456B01");
  });

  it("should parse standard EU VIES multiline address block correctly", () => {
    const raw = "Havenlaan 2\n1080 Sint-Jans-Molenbeek";
    const parsed = CompanyRegistryService.parseViesAddress(raw, "Belgium");
    expect(parsed.address).toBe("Havenlaan 2");
    expect(parsed.postalCode).toBe("1080");
    expect(parsed.city).toBe("Sint-Jans-Molenbeek");
  });

  it("should look up a Belgian company by KBO number", async () => {
    const res = await CompanyRegistryService.lookupCompany("0403.227.515");
    expect(res.exactMatch).not.toBeNull();
    expect(res.exactMatch?.name).toContain("KBC Groep");
    expect(res.exactMatch?.country).toBe("Belgium");
    expect(res.exactMatch?.registry).toBe("KBO");
    expect(res.exactMatch?.taxNumber).toBe("BE 0403.227.515");
  });

  it("should look up a Dutch company by KvK number", async () => {
    const res = await CompanyRegistryService.lookupCompany("54707648");
    expect(res.exactMatch).not.toBeNull();
    expect(res.exactMatch?.name).toContain("Fastned");
    expect(res.exactMatch?.country).toBe("Netherlands");
    expect(res.exactMatch?.registry).toBe("KvK");
    expect(res.exactMatch?.taxNumber).toBe("NL851406456B01");
  });

  it("should find company suggestions by name search", async () => {
    const res = await CompanyRegistryService.lookupCompany("TotalEnergies");
    expect(res.exactMatch).not.toBeNull();
    expect(res.exactMatch?.name).toContain("TotalEnergies");
  });

  it("should return sample presets for instant UI testing", () => {
    const presets = CompanyRegistryService.getQuickPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);
    expect(presets.some((p) => p.country === "Belgium")).toBe(true);
    expect(presets.some((p) => p.country === "Netherlands")).toBe(true);
  });
});
