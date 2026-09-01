import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prisma, pgliteInstance } from "../config/database.js";
import { PkiCertificateService } from "../services/PkiCertificateService.js";
import { DEFAULT_MAIL_TEMPLATES } from "../services/MailTemplateDefaults.js";
import { seedAllBeneluxProfiles } from "../utils/benelux-charger-profiles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log("==================================================");
  console.log("  Seeding Fresh OCPP-CPMS Enterprise Demo Dataset  ");
  console.log("==================================================");

  // 0. Ensure schema DDL is created in database
  const schemaSqlPath = path.resolve(__dirname, "schema.sql");
  if (fs.existsSync(schemaSqlPath)) {
    try {
      const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");
      await pgliteInstance.exec(schemaSql);
      console.log("[0/10] Database schema DDL initialized.");
    } catch (e: any) {
      console.log("[0/10] Database schema already initialized.");
    }
  }

  // 1. Clean existing records in reverse dependency order
  console.log("[1/10] Cleaning existing records...");
  await prisma.auditLog.deleteMany({});
  await prisma.mailTemplate.deleteMany({});
  await prisma.meterValue.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.rfidSession.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.localAuthListEntry.deleteMany({});
  await prisma.localAuthList.deleteMany({});
  await prisma.installedCertificate.deleteMany({});
  await prisma.certificateRequest.deleteMany({});
  await prisma.vehicleContractCertificate.deleteMany({});
  await prisma.vehicleEnergyProfile.deleteMany({});
  await prisma.sepaMandate.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.reimbursementLedger.deleteMany({});
  await prisma.reimbursementContract.deleteMany({});
  await prisma.connector.deleteMany({});
  await prisma.evse.deleteMany({});
  await prisma.chargerConfiguration.deleteMany({});
  await prisma.chargingProfile.deleteMany({});
  await prisma.chargingSchedulePlan.deleteMany({});
  await prisma.deviceComponent.deleteMany({});
  await prisma.diagnosticEvent.deleteMany({});
  await prisma.mediaCampaign.deleteMany({});
  await prisma.charger.deleteMany({});
  await prisma.configurationProfileItem.deleteMany({});
  await prisma.configurationProfile.deleteMany({});
  await prisma.chargerQuirkProfile.deleteMany({});
  await prisma.chargeGroupUser.deleteMany({});
  await prisma.chargeGroup.deleteMany({});
  await prisma.chargingStation.deleteMany({});
  await prisma.tariff.deleteMany({});
  await prisma.rfidUser.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});

  // 2. Create Companies
  console.log("[2/10] Creating Multi-Tenant Companies...");
  const companyVolt = await prisma.company.create({
    data: {
      name: "VoltFleet Logistics B.V.",
    },
  });

  const companyEco = await prisma.company.create({
    data: {
      name: "EcoCharge Benelux",
    },
  });

  // 3. Create Superadmin and Users
  console.log("[3/10] Creating Superadmin and Operator Accounts...");
  const passwordHash = await bcrypt.hash("password123", 10);

  const superadmin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: passwordHash,
      name: "Super Admin",
      role: "superadmin",
      userType: "company",
      companyName: "OCPP-CPMS Global Operations",
      phone: "+31 20 555 0199",
      address: "Keizersgracht 421, 1016 EK Amsterdam",
      taxNumber: "NL889900112B01",
      emailVerified: true,
    },
  });

  const operatorUser = await prisma.user.create({
    data: {
      email: "operator@ecocharge.nl",
      password: passwordHash,
      name: "Mark van der Berg",
      role: "admin",
      userType: "company",
      companyId: companyEco.id,
      companyName: "EcoCharge Benelux",
      phone: "+31 10 444 0288",
      address: "Coolsingel 104, 3011 AG Rotterdam",
      emailVerified: true,
    },
  });

  const driverUser = await prisma.user.create({
    data: {
      email: "driver@voltfleet.com",
      password: passwordHash,
      name: "Sophie de Vries",
      role: "user",
      userType: "employee",
      companyId: companyVolt.id,
      companyName: "VoltFleet Logistics B.V.",
      phone: "+31 6 12345678",
      emailVerified: true,
    },
  });

  // 4. Create Tariffs (Fixed & EPEX Spot Dynamic)
  console.log("[4/10] Creating Pricing Matrix & Tariffs...");
  const fixedTariff = await prisma.tariff.create({
    data: {
      tariff_name: "Green Standard Rate",
      charge: 1.50,
      electricity_rate: 0.35,
      tariffType: "FIXED",
      idle_fee: 0.05,
    },
  });

  const dynamicTariff = await prisma.tariff.create({
    data: {
      tariff_name: "EPEX Spot Day-Ahead Dynamic",
      charge: 1.00,
      electricity_rate: 0.28,
      tariffType: "DYNAMIC_EPEX",
      country: "NL",
      dynamicProvider: "EnergyZero",
      markupPerKwh: 0.04,
      idle_fee: 0.10,
    },
  });

  // 5. Create Stations & Ground Plan layouts
  console.log("[5/10] Creating Stations & Ground Plans...");
  const stationAms = await prisma.chargingStation.create({
    data: {
      station_name: "Amsterdam Central EV Hub",
      street_name: "De Ruijterkade 105",
      city: "Amsterdam",
      state: "North Holland",
      postal_code: "1011 AB",
      country: "Netherlands",
      latitude: 52.379189,
      longitude: 4.900308,
      owner_id: superadmin.id,
      isGroundPlanEnabled: true,
    },
  });

  const stationRot = await prisma.chargingStation.create({
    data: {
      station_name: "Rotterdam Port Fast Charging Hub",
      street_name: "Wilhelminakade 905",
      city: "Rotterdam",
      state: "South Holland",
      postal_code: "3072 AP",
      country: "Netherlands",
      latitude: 51.902220,
      longitude: 4.492210,
      owner_id: operatorUser.id,
      isGroundPlanEnabled: true,
    },
  });

  // 6. Create Charge Groups (Load Balancing)
  console.log("[6/10] Creating Charge Groups & Smart Balancing Profiles...");
  const chargeGroupAms = await prisma.chargeGroup.create({
    data: {
      name: "Amsterdam Site Load Cluster",
      description: "Grid capacity protection cluster with PV peak shaving",
      maxPower: 250,
      maxAmperage: 360,
    },
  });

  // 7. Create Hardware Quirk Profiles
  const alfenQuirk = await prisma.chargerQuirkProfile.create({
    data: {
      name: "Alfen Eve Single Firmware Quirk",
      description: "Bypasses meterStart check and normalizes connector indexing",
      rules: {
        ignoreMeterStart: false,
        normalizeConnectorIds: true,
      },
    },
  });

  // 8. Create Physical Chargers and Connectors
  console.log("[7/10] Provisioning Physical Chargers & EVSE Connectors...");
  const charger1 = await prisma.charger.create({
    data: {
      name: "AMS-ALFEN-01",
      model: "Eve Single Pro",
      manufacturer: "Alfen",
      serial_number: "ALF-2026-9901",
      status: "active",
      power_capacity: 22,
      charging_station_id: stationAms.id,
      chargeGroupId: chargeGroupAms.id,
      owner_id: superadmin.id,
      quirkProfileId: alfenQuirk.id,
      firmware_version: "v5.12.0-4102",
      service_contacts: "support@alfen.com",
      last_heartbeat: new Date(),
    },
  });

  const evse1 = await prisma.evse.create({
    data: {
      charger_id: charger1.charger_id,
      evse_id: 1,
    },
  });

  await prisma.connector.create({
    data: {
      evse_id: evse1.id,
      connector_name: "Channel 1",
      current_type: "AC",
      max_power: 22,
      max_current: 32,
      max_voltage: 400,
      status: "Available",
    },
  });

  const charger2 = await prisma.charger.create({
    data: {
      name: "AMS-ABB-DC180",
      model: "Terra 184 Supercharger",
      manufacturer: "ABB",
      serial_number: "ABB-DC-88401",
      status: "active",
      power_capacity: 180,
      charging_station_id: stationAms.id,
      chargeGroupId: chargeGroupAms.id,
      owner_id: superadmin.id,
      firmware_version: "v3.4.1",
      service_contacts: "support@abb.com",
      last_heartbeat: new Date(),
    },
  });

  const evse2_1 = await prisma.evse.create({
    data: { charger_id: charger2.charger_id, evse_id: 1 },
  });
  const evse2_2 = await prisma.evse.create({
    data: { charger_id: charger2.charger_id, evse_id: 2 },
  });

  await prisma.connector.create({
    data: {
      evse_id: evse2_1.id,
      connector_name: "Channel 1",
      current_type: "DC",
      max_power: 180,
      max_current: 300,
      max_voltage: 1000,
      status: "Charging",
    },
  });

  await prisma.connector.create({
    data: {
      evse_id: evse2_2.id,
      connector_name: "Channel 2",
      current_type: "DC",
      max_power: 62.5,
      max_current: 125,
      max_voltage: 500,
      status: "Available",
    },
  });

  const charger3 = await prisma.charger.create({
    data: {
      name: "ROT-EVBOX-240",
      model: "Troniq Modular 240",
      manufacturer: "EVBox",
      serial_number: "EVB-TM-7721",
      status: "active",
      power_capacity: 240,
      charging_station_id: stationRot.id,
      owner_id: operatorUser.id,
      firmware_version: "v4.0.0-rc2",
      service_contacts: "support@evbox.com",
      last_heartbeat: new Date(),
    },
  });

  const evse3 = await prisma.evse.create({
    data: { charger_id: charger3.charger_id, evse_id: 1 },
  });

  await prisma.connector.create({
    data: {
      evse_id: evse3.id,
      connector_name: "Channel 1",
      current_type: "DC",
      max_power: 240,
      max_current: 400,
      max_voltage: 1000,
      status: "Reserved",
    },
  });

  // 9. Create RFID Whitelist and ISO 15118 Vehicle Certificates
  console.log("[8/10] Creating RFID Cards & Plug & Charge Vehicle Certificates...");
  const rfidAlice = await prisma.rfidUser.create({
    data: {
      rfid_tag: "NL-RFID-990123",
      name: "Alice Jansen",
      email: "alice.jansen@example.com",
      company_name: "VoltFleet Logistics",
      owner_id: superadmin.id,
      active: true,
    },
  });

  const rfidBob = await prisma.rfidUser.create({
    data: {
      rfid_tag: "NL-RFID-881244",
      name: "Bob Operator",
      email: "bob@ecocharge.nl",
      company_name: "EcoCharge Benelux",
      owner_id: operatorUser.id,
      active: true,
    },
  });

  // Issue ISO 15118 Vehicle Contract Certificate
  const vccCert = await PkiCertificateService.issueVehicleContractCertificate({
    userId: driverUser.id,
    emaid: "EMAID-NL-VOLT-001",
    validityDays: 730,
  });

  // 10. Create Local Authorization Lists (Phase 1)
  console.log("[9/10] Synchronizing Local Authorization Lists...");
  const localListAms = await prisma.localAuthList.create({
    data: {
      chargerId: charger1.charger_id,
      listVersion: 1,
      status: "Synchronized",
      lastSyncedAt: new Date(),
    },
  });

  await prisma.localAuthListEntry.createMany({
    data: [
      { localAuthListId: localListAms.id, idTag: rfidAlice.rfid_tag, status: "Accepted" },
      { localAuthListId: localListAms.id, idTag: rfidBob.rfid_tag, status: "Accepted" },
      { localAuthListId: localListAms.id, idTag: "EMAID-NL-VOLT-001", status: "Accepted" },
    ],
  });

  // 11. Create Reservations (Phase 2)
  console.log("[10/10] Seeding Active & Completed Reservations...");
  const activeReservation = await prisma.reservation.create({
    data: {
      reservationId: 778811,
      chargerId: charger3.charger_id,
      connectorId: 1,
      idTag: rfidAlice.rfid_tag,
      expiryDate: new Date(Date.now() + 2 * 3600 * 1000), // 2 hours in future
      status: "Active",
      userId: superadmin.id,
      rfidUserId: rfidAlice.rfid_user_id,
    },
  });

  await prisma.reservation.create({
    data: {
      reservationId: 665522,
      chargerId: charger2.charger_id,
      connectorId: 1,
      idTag: rfidBob.rfid_tag,
      expiryDate: new Date(Date.now() - 1 * 3600 * 1000),
      status: "Consumed",
      userId: operatorUser.id,
      rfidUserId: rfidBob.rfid_user_id,
    },
  });

  // 12. Create Active and Past Transactions with Meter Values
  const activeTx = await prisma.transaction.create({
    data: {
      transactionId: "TX-LIVE-8801",
      charger_id: charger2.charger_id,
      connectorName: "Channel 1",
      status: "charging",
      initialMeterValue: 12000,
      energyConsumed: 45000, // 45 kWh
      currentPower: 150000, // 150 kW DC Fast Charging
      soc: 68,
      startTime: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago
      rfidUserId: rfidAlice.rfid_user_id,
    },
  });

  await prisma.meterValue.createMany({
    data: [
      {
        transactionId: activeTx.transactionId,
        chargerId: charger2.charger_id,
        connectorId: 1,
        energy: 15000,
        power: 150000,
        soc: 25,
        voltage: 750,
        current: 200,
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
      },
      {
        transactionId: activeTx.transactionId,
        chargerId: charger2.charger_id,
        connectorId: 1,
        energy: 35000,
        power: 148000,
        soc: 50,
        voltage: 770,
        current: 192,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        transactionId: activeTx.transactionId,
        chargerId: charger2.charger_id,
        connectorId: 1,
        energy: 57000,
        power: 140000,
        soc: 68,
        voltage: 785,
        current: 178,
        timestamp: new Date(),
      },
    ],
  });

  // Completed Transaction
  await prisma.transaction.create({
    data: {
      transactionId: "TX-COMPLETED-4401",
      charger_id: charger1.charger_id,
      connectorName: "Channel 1",
      status: "completed",
      initialMeterValue: 5000,
      finalMeterValue: 27000,
      energyConsumed: 22000, // 22 kWh
      totalCost: 9.20,
      startTime: new Date(Date.now() - 4 * 3600 * 1000),
      endTime: new Date(Date.now() - 3 * 3600 * 1000),
      rfidUserId: rfidBob.rfid_user_id,
    },
  });

  // 13. Create Audit Logs (Phase 3)
  await prisma.auditLog.createMany({
    data: [
      {
        userId: superadmin.id,
        action: "AUTH_LOGIN",
        target: "User",
        targetId: String(superadmin.id),
        ip: "127.0.0.1",
        payload: { method: "Password", role: "superadmin" },
      },
      {
        userId: superadmin.id,
        action: "LOCAL_AUTH_SYNC",
        target: "Charger",
        targetId: String(charger1.charger_id),
        ip: "127.0.0.1",
        payload: { listVersion: 1, updateType: "Full", tokenCount: 3 },
      },
      {
        userId: superadmin.id,
        action: "RESERVATION_CREATE",
        target: "Reservation",
        targetId: String(activeReservation.reservationId),
        ip: "127.0.0.1",
        payload: { chargerId: charger3.charger_id, connectorId: 1, idTag: rfidAlice.rfid_tag },
      },
      {
        userId: superadmin.id,
        action: "CERTIFICATE_SIGNED",
        target: "Certificate",
        targetId: vccCert.serialNumber,
        ip: "127.0.0.1",
        payload: { certificateType: "V2GCertificate", emaid: vccCert.emaid },
      },
    ],
  });

  // 14. Seed Default Multilingual Mail Templates
  console.log("[14/15] Seeding Multilingual Mail Templates (EN, NL, FR)...");
  for (const tpl of DEFAULT_MAIL_TEMPLATES) {
    await prisma.mailTemplate.create({
      data: {
        name: tpl.name,
        type: tpl.type,
        language: tpl.language,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
      },
    });
  }

  // 15. Seed Optimized Benelux & Universal OCPP Configuration Profiles
  console.log("[15/15] Seeding Optimized Benelux & Universal OCPP Configuration Profiles...");
  await seedAllBeneluxProfiles();

  console.log("==================================================");
  console.log("  Demo Data Seeding Completed Successfully!       ");
  console.log("  Superadmin: admin@example.com / password123      ");
  console.log("==================================================");
}

seed()
  .catch((e) => {
    console.error("Error seeding demo database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
