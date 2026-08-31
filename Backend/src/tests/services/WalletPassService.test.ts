import JSZip from "jszip";
import { WalletPassService } from "../../services/WalletPassService.js";

describe("Apple Wallet & Google Wallet NFC Passes Service", () => {
  const mockCard = {
    rfid_user_id: 42,
    rfid_tag: "NL-GRID-998877",
    name: "Alex Driver",
    cardScope: "Roaming",
    company_name: "Fleet Corp",
    active: true,
  };

  it("should generate a valid Apple Wallet .pkpass ZIP bundle with NFC tag dictionary", async () => {
    const pkpassBuffer = await WalletPassService.generateApplePkPass(mockCard);

    expect(Buffer.isBuffer(pkpassBuffer)).toBe(true);
    expect(pkpassBuffer.length).toBeGreaterThan(100);

    // Unzip and inspect package contents
    const zip = await JSZip.loadAsync(pkpassBuffer);
    expect(zip.file("pass.json")).toBeDefined();
    expect(zip.file("manifest.json")).toBeDefined();
    expect(zip.file("signature")).toBeDefined();

    const passJsonStr = await zip.file("pass.json")!.async("string");
    const passJson = JSON.parse(passJsonStr);

    expect(passJson.passTypeIdentifier).toBe("pass.com.grid.cpms.rfid");
    expect(passJson.serialNumber).toBe("RFID-NL-GRID-998877");
    expect(passJson.nfc).toEqual({ message: "NL-GRID-998877" });
    expect(passJson.storeCard.primaryFields[0].value).toBe("Alex Driver");
  });

  it("should generate a valid Google Wallet save URL with JWT claims", () => {
    const googleWalletUrl = WalletPassService.generateGoogleWalletUrl(mockCard);

    expect(googleWalletUrl).toBeDefined();
    expect(googleWalletUrl).toContain("https://pay.google.com/gp/v/save/");

    const jwtToken = googleWalletUrl.replace("https://pay.google.com/gp/v/save/", "");
    const parts = jwtToken.split(".");
    expect(parts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    expect(payload.typ).toBe("savetowallet");
    expect(payload.payload.genericObjects[0].barcode.value).toBe("NL-GRID-998877");
    expect(payload.payload.genericObjects[0].smartTap.value).toBe("NL-GRID-998877");
    expect(payload.payload.genericObjects[0].header.defaultValue.value).toBe("Alex Driver");
  });
});
