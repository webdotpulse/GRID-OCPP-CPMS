import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, '../Screenshots');
const MANUAL_DIR = path.resolve(__dirname, '../../Manual');

// Ensure directories exist
for (const dir of [ROOT_SCREENSHOTS_DIR, FRONTEND_SCREENSHOTS_DIR, MANUAL_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Clean old screenshots in ROOT_SCREENSHOTS_DIR and FRONTEND_SCREENSHOTS_DIR
for (const dir of [ROOT_SCREENSHOTS_DIR, FRONTEND_SCREENSHOTS_DIR]) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      try { fs.unlinkSync(path.join(dir, file)); } catch (e) {}
    }
  }
}

// Comprehensive Mock Data
const mockUser = {
  id: 1,
  email: 'admin@webdotpulse.eu',
  name: 'Super Administrator',
  role: 'superadmin',
  userType: 'company',
  companyName: 'Pulse Charge Network B.V.',
  address: 'Keizersgracht 421, 1016 EK Amsterdam',
  phone: '+31 20 894 3200',
  taxNumber: 'NL861234567B01',
  createdAt: '2024-01-15T08:00:00.000Z',
  twoFactorEnabled: true,
  twoFactorMethod: 'authenticator',
};

const mockOverview = {
  totalChargers: 28,
  activeSessions: 8,
  energyToday: 512400,
  revenueToday: 248.80,
};

const mockDistribution = {
  distribution: {
    Available: { count: 16 },
    Charging: { count: 8 },
    Preparing: { count: 2 },
    Finishing: { count: 1 },
    Faulted: { count: 1 },
    Unavailable: { count: 0 },
  },
};

const mockLiveSessions = [
  {
    transactionId: 10842,
    chargerId: "CP-AMS-01",
    chargerName: "Alfen Eve Double Pro - Bay 1",
    connectorName: "Connector 1 (CCS2)",
    startTime: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    energyConsumed: 32400,
    currentPower: 48500,
    status: "Charging"
  },
  {
    transactionId: 10843,
    chargerId: "CP-AMS-02",
    chargerName: "Kempower Hypercharge - Bay 3",
    connectorName: "Connector 1 (CCS2 High Power)",
    startTime: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
    energyConsumed: 41200,
    currentPower: 150000,
    status: "Charging"
  },
  {
    transactionId: 10844,
    chargerId: "CP-RTD-01",
    chargerName: "ABB Terra 184 - Bay 1",
    connectorName: "Connector 2 (Type 2)",
    startTime: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    energyConsumed: 18600,
    currentPower: 22000,
    status: "Charging"
  },
  {
    transactionId: 10845,
    chargerId: "CP-BRU-02",
    chargerName: "Raedian Nex - Bay 2",
    connectorName: "Connector 1 (Type 2)",
    startTime: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    energyConsumed: 5100,
    currentPower: 11000,
    status: "Charging"
  }
];

const mockChargersStatus = [
  { charger_id: 1, name: "Alfen Eve Double Pro - Bay 1", status: "Charging", last_heartbeat: new Date().toISOString(), connectors: 2, active_sessions: 1 },
  { charger_id: 2, name: "Kempower Hypercharge - Bay 3", status: "Charging", last_heartbeat: new Date().toISOString(), connectors: 4, active_sessions: 2 },
  { charger_id: 3, name: "ABB Terra 184 - Bay 1", status: "Available", last_heartbeat: new Date().toISOString(), connectors: 2, active_sessions: 0 },
  { charger_id: 4, name: "Raedian Nex - Bay 2", status: "Charging", last_heartbeat: new Date().toISOString(), connectors: 2, active_sessions: 1 }
];

const mockStations = [
  {
    id: 1,
    name: "Amsterdam Central Charging Hub",
    station_name: "Amsterdam Central Charging Hub",
    street_name: "Stationsplein 12",
    city: "Amsterdam",
    state: "North Holland",
    postal_code: "1012 AB",
    address: "Stationsplein 12, 1012 AB Amsterdam",
    status: "Active",
    latitude: 52.379189,
    longitude: 4.900431,
    on_site_person_name: "Lars van Dijk",
    on_site_contact_details: "+31 20 555 0192",
    emergency_contact: "+31 800 022 9988",
    createdAt: "2024-01-10T08:00:00.000Z",
    isGroundPlanEnabled: true,
    totalPowerKw: 450,
    chargerCount: 6,
    chargers: [
      { id: 1, charger_id: 1, name: "Alfen Eve Double Pro - Bay 1", model: "Eve Double Pro-line", status: "Charging", isOnline: true },
      { id: 2, charger_id: 2, name: "Kempower Hypercharge - Bay 3", model: "C-Station 400V", status: "Charging", isOnline: true }
    ]
  },
  {
    id: 2,
    name: "Rotterdam Port Fast Charging Depot",
    station_name: "Rotterdam Port Fast Charging Depot",
    street_name: "Wilhelminakade 102",
    city: "Rotterdam",
    state: "South Holland",
    postal_code: "3072 AP",
    address: "Wilhelminakade 102, 3072 AP Rotterdam",
    status: "Active",
    latitude: 51.9056,
    longitude: 4.4892,
    on_site_person_name: "Dirk Bakker",
    on_site_contact_details: "+31 10 442 8190",
    emergency_contact: "+31 800 022 9988",
    createdAt: "2024-02-15T09:30:00.000Z",
    isGroundPlanEnabled: true,
    totalPowerKw: 600,
    chargerCount: 8,
    chargers: [
      { id: 3, charger_id: 3, name: "ABB Terra 184 - Bay 1", model: "Terra 184 High Power", status: "Available", isOnline: true }
    ]
  }
];

const mockChargers = [
  {
    id: 1,
    charger_id: "CP-AMS-01",
    name: "Alfen Eve Double Pro - Bay 1",
    vendor: "Alfen ICU B.V.",
    manufacturer: "Alfen ICU B.V.",
    model: "Eve Double Pro-line",
    serial_number: "ALF-2024-99812",
    serialNumber: "ALF-2024-99812",
    firmware_version: "5.18.2-4112",
    firmwareVersion: "5.18.2-4112",
    protocol: "ocpp1.6",
    ocppProtocol: "ocpp1.6",
    power_capacity: 44,
    maxPowerKw: 44,
    status: "charging",
    isOnline: true,
    last_heartbeat: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    service_contacts: "support@alfen.com / +31 36 549 3400",
    charging_station_id: 1,
    chargingStation: { id: 1, station_name: "Amsterdam Central Charging Hub" },
    stationId: 1,
    station: { id: 1, name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    Station: { id: 1, name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    tariffs: [{ tariff_id: 1 }],
    chargeGroupId: 1,
    quirkProfileId: 1,
    isPredictiveBalancingEnabled: true,
    localSolarKwp: 25.0,
    connectors: [
      { id: 1, connectorId: 1, connector_id: 1, type: "CCS2", status: "Charging", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 21.4 },
      { id: 2, connectorId: 2, connector_id: 2, type: "Type2", status: "Available", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 0 }
    ],
    evses: [
      {
        id: 1,
        evseId: 1,
        connectors: [
          { id: 1, connectorId: 1, connector_id: 1, type: "CCS2", status: "Charging", maxPowerKw: 22 }
        ]
      },
      {
        id: 2,
        evseId: 2,
        connectors: [
          { id: 2, connectorId: 2, connector_id: 2, type: "Type2", status: "Available", maxPowerKw: 22 }
        ]
      }
    ]
  },
  {
    id: 2,
    charger_id: "CP-AMS-02",
    name: "Kempower Hypercharge - Bay 3",
    vendor: "Kempower",
    manufacturer: "Kempower",
    model: "C-Station 400V",
    serial_number: "KMP-88319-DC",
    serialNumber: "KMP-88319-DC",
    firmware_version: "2.4.11-rc3",
    firmwareVersion: "2.4.11-rc3",
    protocol: "ocpp2.0.1",
    ocppProtocol: "ocpp2.0.1",
    power_capacity: 150,
    maxPowerKw: 150,
    status: "charging",
    isOnline: true,
    last_heartbeat: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    service_contacts: "service@kempower.com",
    charging_station_id: 1,
    chargingStation: { id: 1, station_name: "Amsterdam Central Charging Hub" },
    stationId: 1,
    station: { id: 1, name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    Station: { id: 1, name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    tariffs: [{ tariff_id: 2 }],
    chargeGroupId: 1,
    connectors: [
      { id: 3, connectorId: 1, connector_id: 1, type: "CCS2", status: "Charging", maxPowerKw: 150, max_power_kw: 150, currentPowerKw: 148.0 },
      { id: 4, connectorId: 2, connector_id: 2, type: "CHAdeMO", status: "Available", maxPowerKw: 50, max_power_kw: 50, currentPowerKw: 0 }
    ],
    evses: [
      {
        id: 3,
        evseId: 1,
        connectors: [{ id: 3, connectorId: 1, type: "CCS2", status: "Charging", maxPowerKw: 150 }]
      }
    ]
  }
];

const mockConnectors = [
  { id: 1, connectorId: 1, connector_id: 1, type: "CCS2", status: "Charging", maxPowerKw: 22, chargerId: "CP-AMS-01", charger: { id: 1, name: "Alfen Eve Double Pro - Bay 1" } },
  { id: 2, connectorId: 2, connector_id: 2, type: "Type2", status: "Available", maxPowerKw: 22, chargerId: "CP-AMS-01", charger: { id: 1, name: "Alfen Eve Double Pro - Bay 1" } },
  { id: 3, connectorId: 1, connector_id: 1, type: "CCS2", status: "Charging", maxPowerKw: 150, chargerId: "CP-AMS-02", charger: { id: 2, name: "Kempower Hypercharge - Bay 3" } },
  { id: 4, connectorId: 2, connector_id: 2, type: "CHAdeMO", status: "Available", maxPowerKw: 50, chargerId: "CP-AMS-02", charger: { id: 2, name: "Kempower Hypercharge - Bay 3" } }
];

const mockChargeGroups = [
  {
    id: 1,
    name: "Amsterdam Hub - High Voltage Substation Alpha",
    description: "Multi-EVSE dynamic phase balancing with 400kW site ceiling and PV solar peak shaving.",
    maxCurrentAmps: 600,
    maxAmperage: 600,
    maxPowerKw: 400,
    maxPower: 400,
    maxPhaseCurrent: 200,
    maxPhaseUnbalance: 32,
    phaseUnbalanceLimit: 32,
    dynamicLoadBalancing: true,
    dynamic_balancing_enabled: true,
    phase_balancing_enabled: true,
    peakShaving: true,
    fail_safe_current: 16,
    activePowerKw: 198.5,
    stationId: 1,
    station: { name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    company: { id: 1, name: "Pulse Charge Network B.V." },
    createdAt: "2024-01-15T08:00:00.000Z",
    updatedAt: "2026-08-20T14:30:00.000Z",
    chargers: [
      { id: 1, charger_id: 1, name: "Alfen Eve Double Pro - Bay 1", model: "Eve Double Pro-line", manufacturer: "Alfen ICU B.V.", serial_number: "ALF-2024-99812", power_capacity: 44, maxPowerKw: 44, status: "Charging", last_heartbeat: new Date().toISOString(), chargingStation: { id: 1, station_name: "Amsterdam Central Charging Hub", city: "Amsterdam" } },
      { id: 2, charger_id: 2, name: "Kempower Hypercharge - Bay 3", model: "C-Station 400V", manufacturer: "Kempower", serial_number: "KMP-88319-DC", power_capacity: 150, maxPowerKw: 150, status: "Charging", last_heartbeat: new Date().toISOString(), chargingStation: { id: 1, station_name: "Amsterdam Central Charging Hub", city: "Amsterdam" } }
    ],
    users: [
      {
        chargeGroupId: 1,
        userId: 1,
        tariffId: 1,
        user: { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu", role: "superadmin" },
        tariff: { tariff_id: 1, name: "Standard Public AC Fast (22kW)", energy_fee: 0.38, connection_fee: 1.50, time_fee: 0.00, idle_fee: 0.05, currency: "EUR" }
      }
    ]
  }
];

const mockVehicles = [
  {
    id: 1,
    emaid: "NL-EVB-C0019283-A",
    macAddress: "00:1A:2B:3C:4D:5E",
    status: "Active",
    expirationDate: "2027-12-31T23:59:59Z",
    userId: 1,
    user: { name: "Super Administrator", email: "admin@webdotpulse.eu" }
  },
  {
    id: 2,
    emaid: "DE-BMW-C9940121-Z",
    macAddress: "44:85:00:E2:11:99",
    status: "Active",
    expirationDate: "2028-06-30T23:59:59Z",
    userId: 2,
    user: { name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl" }
  }
];

const mockRfidTags = [
  {
    id: 1,
    idTag: "E200001928390012",
    rfid_tag: "E200001928390012",
    visualNumber: "CARD-8839-NL",
    userName: "Super Administrator",
    userEmail: "admin@webdotpulse.eu",
    name: "Super Administrator",
    status: "Active",
    isActive: true,
    active: true,
    expiryDate: "2028-01-01T00:00:00Z",
    tagType: "Mifare Classic 1K",
    note: "Master Operations Fleet Tag",
    createdAt: "2024-01-10T10:00:00Z"
  }
];

const mockReservations = [
  {
    id: 1,
    reservationId: 501,
    chargerId: 1,
    connectorId: 1,
    idTag: "E200001928390012",
    expiryDate: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    status: "Active",
    createdAt: new Date().toISOString(),
    charger: { charger_id: 1, name: "Alfen Eve Double Pro - Bay 1", model: "Eve Double Pro" },
    user: { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu" },
    rfidUser: { rfid_user_id: 1, name: "Super Administrator", rfid_tag: "E200001928390012" }
  },
  {
    id: 2,
    reservationId: 502,
    chargerId: 2,
    connectorId: 1,
    idTag: "CARD-1102-EU",
    expiryDate: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: "Consumed",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    charger: { charger_id: 2, name: "Kempower Hypercharge - Bay 3", model: "C-Station 400V" },
    user: { id: 2, name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl" }
  }
];

const mockTransactions = [
  {
    id: 10842,
    transactionId: 10842,
    chargerId: "CP-AMS-01",
    chargerName: "Alfen Eve Double Pro - Bay 1",
    connectorId: 1,
    connectorName: "CCS2 - Bay 1",
    idTag: "E200001928390012",
    startTime: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    stopTime: null,
    meterStart: 124500,
    meterStop: 156900,
    energyDeliveredKwh: 32.4,
    energyConsumed: 32400,
    totalCost: 14.58,
    status: "Active",
    currentDirection: "Charging",
    soc: 72,
    user: { name: "Super Administrator", email: "admin@webdotpulse.eu" }
  },
  {
    id: 10841,
    transactionId: 10841,
    chargerId: "CP-AMS-02",
    chargerName: "Kempower Hypercharge - Bay 3",
    connectorId: 1,
    idTag: "B849201948201934",
    startTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    stopTime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    meterStart: 89000,
    meterStop: 147500,
    energyDeliveredKwh: 58.5,
    energyConsumed: 58500,
    totalCost: 26.33,
    status: "Completed",
    currentDirection: "Charging",
    soc: 94,
    user: { name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl" }
  }
];

const mockInvoicesList = [
  {
    id: 1,
    invoiceNumber: "INV-2026-0042",
    recipientName: "Pulse Fleet Services B.V.",
    recipientEmail: "billing@pulsefleet.eu",
    companyName: "Pulse Fleet Services B.V.",
    company: { id: 1, name: "Pulse Fleet Services B.V." },
    user: { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu" },
    billingAddress: "Keizersgracht 421, 1016 EK Amsterdam",
    taxNumber: "NL861234567B01",
    country: "Netherlands",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "paid",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    subtotal: 1240.50,
    vatAmount: 260.51,
    vatRate: 21,
    totalAmount: 1501.01,
    currency: "EUR",
    chargingSessionsCount: 48,
    kwhTotal: 3340.2,
    createdAt: "2026-08-01T00:00:00Z",
    items: [
      { id: 1, invoiceId: 1, description: "August 2026 High-Power Charging Energy (3,340.2 kWh)", quantity: 3340.2, unitPrice: 0.35, vatRate: 21, vatAmount: 245.51, amount: 1169.07 },
      { id: 2, invoiceId: 1, description: "Monthly Corporate EVSE Fleet Connection Fee", quantity: 1, unitPrice: 71.43, vatRate: 21, vatAmount: 15.00, amount: 71.43 }
    ],
    transactions: [
      { id: 1, transactionId: "10841", connectorName: "CCS2 Bay 1", startTime: "2026-08-10T14:20:00Z", energyConsumed: 58500, totalCost: 26.33, charger: { charger_id: 2, name: "Kempower Hypercharge - Bay 3" } }
    ]
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-0043",
    recipientName: "Green Mobility Logistics N.V.",
    recipientEmail: "accounts@greenmobility.be",
    companyName: "Green Mobility Logistics N.V.",
    company: { id: 2, name: "Green Mobility Logistics N.V." },
    user: { id: 2, name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl" },
    billingAddress: "Havenlaan 86C, 1000 Brussel",
    taxNumber: "BE0987654321",
    country: "Belgium",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "issued",
    issueDate: "2026-08-15",
    dueDate: "2026-08-29",
    subtotal: 840.00,
    vatAmount: 176.40,
    vatRate: 21,
    totalAmount: 1016.40,
    currency: "EUR",
    chargingSessionsCount: 31,
    kwhTotal: 2250.0,
    createdAt: "2026-08-15T00:00:00Z",
    items: [
      { id: 3, invoiceId: 2, description: "August 2026 Commercial Fleet Sessions (2,250 kWh)", quantity: 2250.0, unitPrice: 0.36, vatRate: 21, vatAmount: 170.10, amount: 810.00 },
      { id: 4, invoiceId: 2, description: "Direct Roaming Surcharge", quantity: 1, unitPrice: 30.00, vatRate: 21, vatAmount: 6.30, amount: 30.00 }
    ],
    transactions: []
  }
];

const mockMandates = [
  { id: 1, debtorName: "Pulse Fleet Services B.V.", customerName: "Pulse Fleet Services B.V.", iban: "NL91ABNA0417164300", bic: "ABNANL2A", mandateReference: "MAND-2024-0019", scheme: "CORE", status: "Active", signedDate: "2024-01-15" },
  { id: 2, debtorName: "Green Mobility Logistics N.V.", customerName: "Green Mobility Logistics N.V.", iban: "BE68539007547034", bic: "GEBABEBB", mandateReference: "MAND-2024-0024", scheme: "B2B", status: "Active", signedDate: "2024-03-20" }
];

const mockTariffs = [
  {
    id: 1,
    name: "Standard Public AC Fast (22kW)",
    pricingType: "fixed",
    energyFee: 0.38,
    connectionFee: 1.50,
    timeFee: 0.00,
    idleFee: 0.05,
    currency: "EUR",
    isDefault: true,
    description: "Standard daytime charging rate across all Type 2 connectors."
  },
  {
    id: 2,
    name: "Ultra-Fast DC Supercharge (150kW+)",
    pricingType: "fixed",
    energyFee: 0.58,
    connectionFee: 2.00,
    timeFee: 0.00,
    idleFee: 0.25,
    currency: "EUR",
    isDefault: false,
    description: "High-power liquid-cooled CCS2 highway charging."
  },
  {
    id: 3,
    name: "Dynamic EPEX Spot Hourly Market",
    pricingType: "dynamic_epex",
    energyFee: 0.08,
    connectionFee: 1.00,
    timeFee: 0.00,
    idleFee: 0.10,
    currency: "EUR",
    isDefault: false,
    description: "Day-ahead wholesale electricity price + 8ct/kWh operator margin."
  }
];

const mockReimbursementContracts = [
  {
    id: 1,
    userId: 1,
    rfidUserId: 1,
    rfidUser: { name: "Super Administrator", email: "admin@webdotpulse.eu" },
    stationId: 1,
    station: { name: "Amsterdam Central Charging Hub", station_name: "Amsterdam Central Charging Hub" },
    tariffId: 1,
    tariff: { name: "Standard Public AC Fast (22kW)", energyFee: 0.38 },
    iban: "NL91ABNA0417164300",
    status: "Active",
    monthlyLimitKwh: 600,
    createdAt: "2024-01-15T00:00:00Z"
  }
];

const mockReimbursementLedgers = [
  {
    id: 1,
    contractId: 1,
    month: 8,
    year: 2026,
    employeeName: "Super Administrator",
    employeeEmail: "admin@webdotpulse.eu",
    totalKwh: 342.6,
    tariffRate: 0.38,
    totalAmount: 130.19,
    iban: "NL91ABNA0417164300",
    status: "Approved",
    sepaBatchId: "SEPA-202608-BATCH-01",
    contract: {
      user: { name: "Super Administrator", email: "admin@webdotpulse.eu" },
      station: { name: "Amsterdam Central Charging Hub" },
      tariff: { name: "Standard Public AC Fast (22kW)" }
    }
  }
];

const mockUsers = [
  { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu", role: "superadmin", userType: "company", companyName: "Pulse Charge Network B.V.", status: "Active", createdAt: "2024-01-15T08:00:00Z" },
  { id: 2, name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl", role: "admin", userType: "company", companyName: "LeasePlan Corporate Fleet", status: "Active", createdAt: "2024-03-01T10:30:00Z" }
];

const mockConfigProfiles = [
  {
    id: 1,
    name: "Alfen Eve Standard 1.6-J Baseline",
    description: "Standard parameters for Eve Double Pro with 60s heartbeat and meter values sampled every 30s.",
    vendor: "Alfen ICU B.V.",
    protocol: "ocpp1.6",
    items: [
      { key: "HeartbeatInterval", value: "60" },
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "WebSocketPingInterval", value: "45" },
      { key: "AuthorizeRemoteTxRequests", value: "true" }
    ],
    createdAt: "2024-02-10T12:00:00Z"
  }
];

const mockQuirkProfiles = [
  {
    id: 1,
    name: "Alfen Firmware v5.18 Zero-TxId Quirk",
    vendor: "Alfen",
    modelMatch: "Eve*",
    description: "Fixes zero transaction ID returned during StopTransaction confirmation in certain firmware releases.",
    quirks: {
      remapZeroTxId: true,
      ignoreMissingSampledValueUnit: true,
      bypassConnectorLockStatusCheck: false
    }
  }
];

const mockMailTemplates = [
  {
    id: 1,
    name: "Session Receipt (HTML)",
    type: "session_receipt",
    language: "en",
    subject: "Your Charging Session Receipt - {{transactionId}}",
    bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;"><h2 style="color: #54a8c7;">Charging Receipt</h2><p>Thank you for charging on the Pulse Network!</p></div>`,
    bodyText: "Charging Receipt - Total: €{{totalCost}}"
  }
];

const mockRoamingTestCatalog = [
  { id: "test_ocpi_auth_01", protocol: "OCPI", version: "2.2.1", module: "tokens", name: "Token Authorization Real-Time Push", description: "Verifies token whitelist real-time authorization against CPO eMSP token cache", method: "POST", endpoint: "/ocpi/2.2.1/tokens/NL-CPMS-TEST-01/authorize", status: "passed", latencyMs: 42 },
  { id: "test_ocpi_loc_02", protocol: "OCPI", version: "2.2.1", module: "locations", name: "Location & EVSE Discovery", description: "Evaluates location payload against OCPI 2.2.1 JSON schema", method: "GET", endpoint: "/ocpi/2.2.1/locations/1", status: "passed", latencyMs: 65 },
  { id: "test_ocpi_cdr_03", protocol: "OCPI", version: "2.2.1", module: "cdrs", name: "Charge Detail Record (CDR) Push", description: "Pushes final billing CDR with signed meter values", method: "POST", endpoint: "/ocpi/2.2.1/cdrs", status: "passed", latencyMs: 89 },
  { id: "test_oicp_auth_01", protocol: "OICP", version: "2.3", module: "eRoamingAuthorize", name: "Hubject eRoaming Authorize RFID", description: "Performs eRoamingAuthorize remote RFID tag verification", method: "POST", endpoint: "/oicp/2.3/eRoamingAuthorize", status: "passed", latencyMs: 51 }
];

const mockPlaybooks = [
  { id: 1, name: "Connector Solenoid Lock Timeout Recovery", triggerCode: "GroundFault", targetVendor: "Schneider Electric", actionType: "SoftReset", maxAttempts: 3, coolOffMinutes: 10, isActive: true, totalExecutions: 14, successfulRecoveries: 12 },
  { id: 2, name: "Thermal Overload Dynamic Derating", triggerCode: "HighTemperature", targetVendor: "All", actionType: "DeratePower", maxAttempts: 1, coolOffMinutes: 30, isActive: true, totalExecutions: 8, successfulRecoveries: 8 },
  { id: 3, name: "Offline Communication Watchdog Reboot", triggerCode: "HeartbeatTimeout", targetVendor: "Alfen", actionType: "HardReset", maxAttempts: 2, coolOffMinutes: 15, isActive: true, totalExecutions: 5, successfulRecoveries: 4 }
];

const mockPlaybookStats = {
  totalPlaybooks: 3,
  activePlaybooks: 3,
  totalExecutions: 27,
  successRate: 88.9,
  avgRecoveryTimeSeconds: 45
};

const mockPlaybookExecutions = [
  { id: 1, playbookId: 1, playbookName: "Connector Solenoid Lock Timeout Recovery", chargerId: 1, chargerName: "Alfen Eve Double Pro - Bay 1", triggerReason: "GroundFault detected on Connector 1", actionExecuted: "SoftReset", status: "Resolved", executionTime: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, playbookId: 2, playbookName: "Thermal Overload Dynamic Derating", chargerId: 2, chargerName: "Kempower Hypercharge - Bay 3", triggerReason: "HighTemperature 58°C enclosure alert", actionExecuted: "DeratePower", status: "Active", executionTime: new Date(Date.now() - 7200000).toISOString() }
];

const mockScheduledCharging = [
  { id: 1, name: "Fleet Overnight Off-Peak Window", chargerId: 1, charger: { name: "Alfen Eve Double Pro - Bay 1" }, rfidTag: "E200001928390012", startTime: "23:00", endTime: "06:00", maxPowerKw: 22, daysOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], status: "Active" },
  { id: 2, name: "Solar Generation Surge Priority", chargerId: 2, charger: { name: "Kempower Hypercharge - Bay 3" }, rfidTag: "E200001928390012", startTime: "11:30", endTime: "15:00", maxPowerKw: 150, daysOfWeek: ["Saturday", "Sunday"], status: "Active" }
];

const mockSimulatorTemplates = [
  { id: "sim-alfen-eve", name: "Alfen Eve Double Pro-line", vendor: "Alfen ICU B.V.", model: "Eve Double Pro", firmwareVersion: "5.18.2", category: "AC_DUAL", powerCapacityKw: 44, defaultProtocol: "ocpp1.6", supportedProtocols: ["ocpp1.6", "ocpp2.0.1"], description: "Standard dual-socket AC charger supporting dynamic load balancing.", features: ["Smart Charging", "RFID", "15118 PnC"], connectors: [{ id: 1, connectorName: "Bay 1 (CCS2)", type: "CCS2", format: "Cable", maxPowerW: 22000, maxCurrentAmps: 32, maxVoltageVolts: 400, currentType: "AC_3_PHASE", phaseConnection: "3P" }, { id: 2, connectorName: "Bay 2 (Type 2)", type: "Type2", format: "Socket", maxPowerW: 22000, maxCurrentAmps: 32, maxVoltageVolts: 400, currentType: "AC_3_PHASE", phaseConnection: "3P" }] },
  { id: "sim-kempower-c", name: "Kempower C-Station DC Fast Charger", vendor: "Kempower", model: "C-Station 400V", firmwareVersion: "2.4.11", category: "DC_HPC", powerCapacityKw: 150, defaultProtocol: "ocpp2.0.1", supportedProtocols: ["ocpp1.6", "ocpp2.0.1", "ocpp2.1"], description: "Dynamic power routing DC high power charger.", features: ["ISO 15118-20", "V2G Bidirectional", "Dynamic Power Sharing"], connectors: [{ id: 1, connectorName: "DC HPC 1", type: "CCS2", format: "Cable", maxPowerW: 150000, maxCurrentAmps: 375, maxVoltageVolts: 920, currentType: "DC", phaseConnection: "DC" }] }
];

const mockRoles = {
  roles: [
    { role: "superadmin", name: "Super Administrator", badgeColor: "#8b5cf6", level: 100, scope: "Global Platform", description: "Full unrestricted access to all CPMS multi-tenant modules and infrastructure.", isSystem: true, userCount: 1, capabilities: ["chargers.view", "chargers.control", "invoices.view", "invoices.export", "roaming.manage"] },
    { role: "admin", name: "CPO Network Admin", badgeColor: "#e2626b", level: 80, scope: "Company Network", description: "Manages charging stations, load groups, tariffs, and corporate fleet drivers.", isSystem: true, userCount: 3, capabilities: ["chargers.view", "chargers.control", "invoices.view"] },
    { role: "driver", name: "EV Driver / Cardholder", badgeColor: "#38bdf8", level: 20, scope: "Self-Service", description: "Restricted to personal vehicle charging sessions, RFID tag, and billing receipts.", isSystem: true, userCount: 42, capabilities: ["transactions.view"] }
  ],
  capabilities: [
    { key: "invoices.view", name: "Invoicing & Billing Engine", category: "Invoicing & Billing", description: "Generate monthly PDF invoices, calculate VAT rates, and manage payment statuses." },
    { key: "invoices.export", name: "SEPA ISO 20022 Direct Debit XML", category: "Invoicing & Billing", description: "Generate and download banking XML batch transfer files (pain.008 / pain.001)." },
    { key: "reimbursements.manage", name: "Home Reimbursement Split-Billing", category: "Invoicing & Billing", description: "Calculate employee home charging compensation and employer reimbursement ledgers." },
    { key: "ocpp.raw_stream", name: "OCPP Raw Live Message Stream", category: "Operations & Logs", description: "Inspect low-level WebSocket frames (Call, CallResult, CallError) and diagnostics." },
    { key: "chargers.auto_heal", name: "Hardware Reliability & Auto-Heal", category: "Operations & Logs", description: "Inspect hardware risk flags, fault counters, and automated reboot workflows." }
  ]
};

const mockParkingSpots = [
  { id: 1, name: "Spot A1 (Fast CCS2)", chargerId: 1, connectorId: "1", connector: { connector_id: 1, connector_name: "CCS2 - Bay 1" }, x: 100, y: 180, width: 140, height: 90, status: "Charging", type: "spot" },
  { id: 2, name: "Spot A2 (Type 2 AC)", chargerId: 1, connectorId: "2", connector: { connector_id: 2, connector_name: "Type2 - Bay 1" }, x: 260, y: 180, width: 140, height: 90, status: "Available", type: "spot" },
  { id: 3, name: "Spot B1 (High-Power DC 150kW)", chargerId: 2, connectorId: "3", connector: { connector_id: 3, connector_name: "CCS2 High Power" }, x: 420, y: 180, width: 140, height: 90, status: "Charging", type: "spot" },
  { id: 4, name: "Spot B2 (CHAdeMO 50kW)", chargerId: 2, connectorId: "4", connector: { connector_id: 4, connector_name: "CHAdeMO 50kW" }, x: 580, y: 180, width: 140, height: 90, status: "Available", type: "spot" }
];

const mockTopology = {
  stationId: 1,
  stationName: "Amsterdam Central Charging Hub",
  maxPowerKw: 450,
  activePowerKw: 198.5,
  totalCurrentL1: 298.4,
  totalCurrentL2: 290.1,
  totalCurrentL3: 285.6,
  stationUnbalanceAmps: 12.8,
  isStationUnbalanced: false,
  nodes: [
    { id: 1, name: "MV/LV 630kVA Transformer Substation", type: "transformer", x: 80, y: 60, width: 140, height: 80, rotation: 0, fillColor: "#1e2228", lineColor: "#54a8c7", metadata: { ratingKva: 630, gridConnectionVoltage: 10000 } },
    { id: 2, name: "Main Distribution Board MDB-01", type: "distribution_board", x: 320, y: 60, width: 130, height: 70, rotation: 0, fillColor: "#262b32", lineColor: "#fab758", metadata: { maxCurrentAmps: 900 } },
    { id: 3, name: "Bay 1 - Alfen Eve Double Pro", type: "spot", x: 100, y: 220, width: 160, height: 100, rotation: 0, connectorId: 1, chargerId: 1, telemetry: { chargerId: 1, name: "Alfen Eve Double Pro - Bay 1", status: "Charging", activePowerKw: 42.5, currentL1: 61.2, currentL2: 60.8, currentL3: 61.0, voltageL1: 231.4, voltageL2: 230.8, voltageL3: 231.1, unbalanceAmps: 0.4, unbalancePercentage: 0.7, isUnbalanced: false } }
  ],
  feeders: [
    { id: 1, name: "Feeder Trunk 1 (Transformer -> MDB)", cableType: "4x240mm² Al XLPE", lengthMeters: 25, ratedCurrentAmps: 500, activeCurrentL1: 298.4, activeCurrentL2: 290.1, activeCurrentL3: 285.6, maxPhaseCurrent: 298.4, loadPercentage: 59.6, loadLevel: "normal" }
  ]
};

const mockAuditLogs = [
  { id: 1, createdAt: new Date().toISOString(), userId: 1, user: { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu" }, action: "CHARGER_SET_PROFILE", target: "Charger", targetId: "1", ip: "192.168.1.10", userAgent: "Mozilla/5.0 (Macintosh)", payload: { maxPowerKw: 22 } },
  { id: 2, createdAt: new Date(Date.now() - 3600000).toISOString(), userId: 1, user: { id: 1, name: "Super Administrator", email: "admin@webdotpulse.eu" }, action: "INVOICE_GENERATE", target: "Invoice", targetId: "INV-2026-0042", ip: "192.168.1.10", userAgent: "Mozilla/5.0 (Macintosh)", payload: { totalAmount: 1501.01 } }
];

const mockCaData = {
  rootCa: {
    certificatePem: "-----BEGIN CERTIFICATE-----\nMIIB...RootCA...==\n-----END CERTIFICATE-----",
    serialNumber: "7F:9A:12:00:88:FF",
    validFrom: "2024-01-01T00:00:00Z",
    validTo: "2034-01-01T00:00:00Z",
    certificateHashData: { issuerNameHash: "sha256/RootCA", issuerKeyHash: "sha256/RootKey", serialNumber: "7F9A120088FF" }
  },
  subCa: {
    certificatePem: "-----BEGIN CERTIFICATE-----\nMIIB...SubCA...==\n-----END CERTIFICATE-----",
    serialNumber: "8A:1B:33:11:99:EE",
    validFrom: "2024-01-01T00:00:00Z",
    validTo: "2029-01-01T00:00:00Z",
    certificateHashData: { issuerNameHash: "sha256/SubCA", issuerKeyHash: "sha256/SubKey", serialNumber: "8A1B331199EE" }
  }
};

async function setupApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;

    const json = (data, status = 200, extra = {}) => {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data, ...extra })
      });
    };

    const rawJson = (data, status = 200) => {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    };

    if (pathName.includes('/auth/me')) return json(mockUser);
    if (pathName.includes('/auth/2fa/generate')) return json({ secret: 'JBSWY3DPEHPK3PXP', qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/OCPP-CPMS:superadmin@webdotpulse.eu?secret=JBSWY3DPEHPK3PXP' });
    if (pathName.includes('/dashboard/overview')) return json(mockOverview);
    if (pathName.includes('/dashboard/distribution')) return json(mockDistribution.distribution, 200, mockDistribution);
    if (pathName.includes('/dashboard/live-sessions')) return json(mockLiveSessions);
    if (pathName.includes('/dashboard/chargers-status')) return json(mockChargersStatus);
    if (pathName.includes('/dashboard/fleet-capacity')) return json({ availableKwh: 348.5, connectedVehicles: 8 });
    if (pathName.includes('/energy-profile')) return json({ minSocThreshold: 45 });
    
    // Station subroutes
    if (pathName.match(/\/stations\/\d+\/parking-spots/)) return json(mockParkingSpots);
    if (pathName.match(/\/stations\/\d+\/topology/)) return json(mockTopology);
    if (pathName.match(/\/stations\/\d+\/chargers/)) return json(mockChargers);
    if (pathName.match(/\/stations\/\d+/)) return json(mockStations[0]);
    if (pathName.includes('/stations')) return json(mockStations);

    // Charger subroutes
    if (pathName.match(/\/chargers\/\d+\/logs/)) return json([
      { id: 101, timestamp: new Date(Date.now() - 5000).toISOString(), direction: "in", messageType: "CALL", action: "Heartbeat", message: [2, "hb_101", "Heartbeat", {}] },
      { id: 102, timestamp: new Date(Date.now() - 15000).toISOString(), direction: "in", messageType: "CALL", action: "MeterValues", message: [2, "mv_102", "MeterValues", { connectorId: 1, transactionId: 10842, meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{ value: "32400", context: "Sample.Periodic", measurand: "Energy.Active.Import.Register", unit: "Wh" }, { value: "48500", context: "Sample.Periodic", measurand: "Power.Active.Import", unit: "W" }] }] }] },
      { id: 103, timestamp: new Date(Date.now() - 25000).toISOString(), direction: "in", messageType: "CALL", action: "StatusNotification", message: [2, "sn_103", "StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Charging" }] },
      { id: 104, timestamp: new Date(Date.now() - 60000).toISOString(), direction: "in", messageType: "CALL", action: "BootNotification", message: [2, "bn_104", "BootNotification", { chargePointVendor: "Alfen ICU B.V.", chargePointModel: "Eve Double Pro", firmwareVersion: "5.18.2" }] }
    ]);
    if (pathName.match(/\/chargers\/\d+\/config/)) return json({
      keys: [
        { key: "HeartbeatInterval", value: "60", readonly: false },
        { key: "MeterValueSampleInterval", value: "30", readonly: false },
        { key: "ConnectionTimeOut", value: "120", readonly: false },
        { key: "WebSocketPingInterval", value: "45", readonly: false },
        { key: "AuthorizeRemoteTxRequests", value: "true", readonly: false },
        { key: "LocalAuthorizeOffline", value: "true", readonly: true }
      ]
    });
    if (pathName.match(/\/chargers\/\d+\/predictive-schedule/)) return json({
      schedule: [
        { hour: 0, price: 0.12, solarGenerationKw: 0, recommendedLimitKw: 44 },
        { hour: 4, price: 0.09, solarGenerationKw: 0, recommendedLimitKw: 44 },
        { hour: 8, price: 0.18, solarGenerationKw: 15, recommendedLimitKw: 22 },
        { hour: 12, price: 0.05, solarGenerationKw: 48, recommendedLimitKw: 44 },
        { hour: 16, price: 0.14, solarGenerationKw: 28, recommendedLimitKw: 35 },
        { hour: 20, price: 0.22, solarGenerationKw: 0, recommendedLimitKw: 15 }
      ]
    });
    if (pathName.includes('/chargers/unrecognized')) return json([
      { id: 91, chargePointId: "CP-NEW-AUTEL-01", vendor: "Autel MaxiCharger", model: "DC Compact 47kW", ipAddress: "192.168.1.185", protocol: "ocpp1.6", firstSeen: new Date().toISOString() },
      { id: 92, chargePointId: "CP-TEMP-WALLBOX-02", vendor: "Wallbox", model: "Supernova 60", ipAddress: "192.168.1.192", protocol: "ocpp2.0.1", firstSeen: new Date(Date.now() - 3600000).toISOString() }
    ]);
    if (pathName.match(/\/chargers\/\d+/)) return json(mockChargers[0]);
    if (pathName.includes('/chargers')) return json(mockChargers);

    if (pathName.includes('/connectors')) return json(mockConnectors);
    if (pathName.match(/\/charge-groups\/\d+/) || pathName.match(/\/chargeGroups\/\d+/)) return json(mockChargeGroups[0]);
    if (pathName.includes('/charge-groups') || pathName.includes('/chargeGroups')) return json(mockChargeGroups);
    if (pathName.includes('/vehicles')) return json(mockVehicles);
    if (pathName.includes('/reservations')) return json(mockReservations);
    if (pathName.match(/\/rfid\/\d+/)) return json(mockRfidTags[0]);
    if (pathName.includes('/rfid')) return json(mockRfidTags);
    if (pathName.includes('/transactions/active')) return json(mockTransactions.filter(t => t.status === "Active"));
    if (pathName.match(/\/transactions\/\d+/)) return json(mockTransactions[0]);
    if (pathName.includes('/transactions')) return json(mockTransactions);
    
    // Invoices & SEPA Mandates
    if (pathName.match(/\/invoices\/\d+/)) return json(mockInvoicesList[0]);
    if (pathName.includes('/invoices')) {
      return json(mockInvoicesList, 200, {
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        stats: { totalSubtotal: 2080.50, totalVat: 436.91, totalAmount: 2517.41, paidAmount: 1501.01, pendingAmount: 1016.40, count: 2 }
      });
    }
    if (pathName.includes('/sepa/mandates') || pathName.includes('/mandates')) return json(mockMandates);
    if (pathName.includes('/reimbursements/contracts')) return json(mockReimbursementContracts);
    if (pathName.includes('/reimbursements/ledgers')) return json(mockReimbursementLedgers);
    if (pathName.match(/\/tariffs\/\d+/)) return json(mockTariffs[0]);
    if (pathName.includes('/tariffs')) return json(mockTariffs);
    if (pathName.includes('/users')) return json(mockUsers);
    if (pathName.includes('/hardware-at-risk') || pathName.includes('/chargers/at-risk')) return json([
      {
        id: 1,
        chargerId: "CP-FLT-99",
        name: "Schneider EVlink Pro AC",
        vendor: "Schneider Electric",
        model: "EVlink Pro AC 22kW",
        riskScore: 88,
        riskLevel: "Critical",
        issueDescription: "Repeated cable lock solenoid actuator timeout (GroundFault code detected 4 times in 2h).",
        autoHealAttempts: 3,
        autoHealStatus: "SoftReset Attempted",
        recommendedAction: "Dispatch field technician for connector pin latch replacement."
      },
      {
        id: 2,
        chargerId: "CP-BRU-02",
        name: "Raedian Nex - Bay 2",
        vendor: "Raedian",
        model: "NEX-22K-DUAL",
        riskScore: 45,
        riskLevel: "Warning",
        issueDescription: "Internal enclosure temperature elevated (58°C during 22kW charging).",
        autoHealAttempts: 1,
        autoHealStatus: "Derated by LMS",
        recommendedAction: "Check ventilation filter."
      }
    ]);
    if (pathName.includes('/config-profiles')) return json(mockConfigProfiles);
    if (pathName.includes('/quirk-profiles')) return json(mockQuirkProfiles);
    if (pathName.includes('/mail/templates') || pathName.includes('/templates')) return json(mockMailTemplates);
    if (pathName.includes('/settings/mail')) return json({ fromAddress: "noreply@webdotpulse.eu", host: "smtp.sendgrid.net", port: 587, isActive: true });
    if (pathName.includes('/settings/tariffs/entsoe-key')) return json({ hasKey: true, key: "99a818e-44b2-4819-a1b2-entsoe-live-token" });
    if (pathName.includes('/media-campaigns')) return json([
      { id: 1, name: "Summer Clean Energy Promo", displayDuration: 30, targetModels: "Alfen,Raedian,Kempower", assetUrl: "/campaigns/summer-promo.mp4", active: true, createdAt: "2026-08-01T00:00:00Z" }
    ]);
    if (pathName.includes('/settings/payments/stripe')) return json({ hasSecretKey: true, publishableKey: "pk_live_51M0cpms82810283492817263548", hasWebhookSecret: true, testMode: false });
    if (pathName.includes('/settings/payments/mollie')) return json({ hasApiKey: true, profileId: "pfl_99281a", testMode: false });
    if (pathName.includes('/settings/payments')) return json({ isConfigured: true, apiKey: "live_mollie_live_998182747192", profileId: "pfl_99281a" });
    if (pathName.includes('/security/ca')) return json(mockCaData);
    if (pathName.includes('/security/certificates')) return json({
      installedCertificates: [
        { id: 1, chargerId: 1, certificateType: "ChargeStationCertificate", serialNumber: "4A:91:BB:00:12:34", validFrom: "2024-01-15T00:00:00Z", validTo: "2027-01-15T00:00:00Z", status: "Installed", charger: { name: "Alfen Eve Double Pro - Bay 1" } }
      ],
      pendingRequests: []
    });
    if (pathName.includes('/audit')) return json(mockAuditLogs, 200, { total: 2 });
    if (pathName.includes('/roaming') || pathName.includes('/ocpi') || pathName.includes('/oicp')) return json({
      stats: { totalPartners: 4, connectedHubs: 2, roamingSessionsToday: 14, roamingRevenueToday: 89.40 },
      endpoints: [
        { id: 1, name: "Hubject Intercharge OICP 2.3", role: "CPO", status: "Connected", partnerName: "Hubject GmbH", url: "https://service.hubject.com/oicp/v2.3", lastSync: new Date().toISOString() },
        { id: 2, name: "e-clearing.net OCPI 2.2.1", role: "CPO", status: "Connected", partnerName: "Smartlab Innovationsgesellschaft mbH", url: "https://ocpi.e-clearing.net/2.2.1", lastSync: new Date().toISOString() }
      ]
    });
    if (pathName.includes('/roaming/test-suite/catalog')) return json(mockRoamingTestCatalog);
    if (pathName.includes('/auto-heal-playbooks/stats')) return json(mockPlaybookStats);
    if (pathName.includes('/auto-heal-playbooks/executions')) return json(mockPlaybookExecutions);
    if (pathName.includes('/auto-heal-playbooks')) return json(mockPlaybooks);
    if (pathName.includes('/scheduled-charging')) return json(mockScheduledCharging);
    if (pathName.includes('/simulator/templates')) return json(mockSimulatorTemplates);
    if (pathName.includes('/simulator/rfid-tags')) return json(mockRfidTags);
    if (pathName.includes('/simulator/sessions')) return json([]);
    if (pathName.includes('/settings/roles') || pathName.includes('/roles')) return json(mockRoles);
    if (pathName.includes('/settings/firmware')) return json([]);
    if (pathName.includes('/settings/webhooks')) return json([]);
    if (pathName.includes('/settings/products')) return json([]);

    return json([]);
  });
}

async function injectAuth(page) {
  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-superadmin-token-2026');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);
}

async function takeShot(page, filename, options = {}) {
  // Check if page has 404 text
  try {
    const bodyText = await page.innerText('body');
    if (bodyText.includes('404') && (bodyText.includes('This page could not be found') || bodyText.includes('could not be found'))) {
      console.error(`🚨 [ERROR - 404 DETECTED] ${filename} at URL: ${page.url()}`);
    }
  } catch (e) {}

  const rootDest = path.join(ROOT_SCREENSHOTS_DIR, filename);
  const frontendDest = path.join(FRONTEND_SCREENSHOTS_DIR, filename);
  
  await page.waitForTimeout(options.delay || 500);
  await page.screenshot({ path: rootDest, fullPage: options.fullPage !== false });
  fs.copyFileSync(rootDest, frontendDest);
  console.log(`[SAVED] ${filename}`);
}

async function clickTabSafe(page, selector) {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 4000 });
    await el.click();
    await page.waitForTimeout(800);
    return true;
  } catch (e) {
    // try clicking by evaluate
    try {
      const el = page.locator(selector).first();
      await el.click({ force: true, timeout: 2000 });
      await page.waitForTimeout(800);
      return true;
    } catch (err) {}
  }
  return false;
}

async function run() {
  console.log('====================================================');
  console.log(' Starting CPMS Complete Screenshot Suite Generator ');
  console.log('====================================================');

  const frontendDir = path.resolve(__dirname, '..');
  const nextBin = path.resolve(frontendDir, 'node_modules/.bin/next');
  console.log('[Server] Spawning Next.js production server on port 3002...');
  const serverProcess = spawn(nextBin, ['start', '-p', '3002'], {
    cwd: frontendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  serverProcess.stdout.on('data', (d) => process.stdout.write(`[Next.js] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[Next.js ERR] ${d}`));
  serverProcess.on('exit', (code, sig) => console.log(`[Next.js EXITED] code=${code} sig=${sig}`));

  const cleanup = () => {
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Poll until server is ready
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:3002/login');
      if (res.status === 200 || res.status === 307 || res.status === 308) {
        serverReady = true;
        break;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
  }

  if (!serverReady) {
    console.error('Server failed to start on port 3002');
    cleanup();
    process.exit(1);
  }
  console.log('✓ Next.js server ready on http://localhost:3002\n');

  try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb']
  });

  const baseUrl = 'http://localhost:3002';

  // Desktop Context (1920x1080)
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const desktopPage = await desktopContext.newPage();
  await setupApiMocks(desktopPage);
  await injectAuth(desktopPage);

  // 1. Authentication
  console.log('\n--- 1. Authentication Screens ---');
  const authContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const authPage = await authContext.newPage();
  await setupApiMocks(authPage);

  await authPage.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await takeShot(authPage, '01_Auth_Login.png');

  await authPage.goto(`${baseUrl}/register`, { waitUntil: 'domcontentloaded' });
  await takeShot(authPage, '02_Auth_Register.png');

  await authPage.goto(`${baseUrl}/forgot-password`, { waitUntil: 'domcontentloaded' });
  await takeShot(authPage, '03_Auth_ForgotPassword.png');

  await authPage.goto(`${baseUrl}/reset-password?token=mock-token`, { waitUntil: 'domcontentloaded' });
  await takeShot(authPage, '04_Auth_ResetPassword.png');

  await authPage.goto(`${baseUrl}/verify-email?token=mock-token`, { waitUntil: 'domcontentloaded' });
  await takeShot(authPage, '05_Auth_VerifyEmail.png');

  await authContext.close();

  // 2. Executive Dashboard
  console.log('\n--- 2. Executive Dashboard ---');
  await desktopPage.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '06_Dashboard_Executive_Overview.png');

  // 3. Chargers Fleet Management
  console.log('\n--- 3. Chargers Fleet ---');
  await desktopPage.goto(`${baseUrl}/chargers`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '07_Chargers_Fleet_Directory.png');

  await desktopPage.goto(`${baseUrl}/chargers/new`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '08_Chargers_Register_New.png');

  await desktopPage.goto(`${baseUrl}/chargers/unrecognized`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '09_Chargers_Unrecognized_Queue.png');

  await desktopPage.goto(`${baseUrl}/chargers/1`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '10_Charger_Detail_Overview_Tab.png');

  if (await clickTabSafe(desktopPage, 'button[value="connectors"], button:has-text("Connectors")')) {
    await takeShot(desktopPage, '11_Charger_Detail_Connectors_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="transactions"], button:has-text("Transactions")')) {
    await takeShot(desktopPage, '12_Charger_Detail_Transactions_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="configuration"], button:has-text("Configuration")')) {
    await takeShot(desktopPage, '13_Charger_Detail_Configuration_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="profiles"], button:has-text("Profiles")')) {
    await takeShot(desktopPage, '14_Charger_Detail_Profiles_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="predictive"], button:has-text("Predictive")')) {
    await takeShot(desktopPage, '15_Charger_Detail_PredictiveLoad_Tab.png');
  }

  await desktopPage.goto(`${baseUrl}/chargers/1/edit`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '16_Charger_Edit_Form.png');

  // 4. Stations & Ground Plan
  console.log('\n--- 4. Stations & Ground Plan ---');
  await desktopPage.goto(`${baseUrl}/stations`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '17_Stations_Directory_Map.png');

  await desktopPage.goto(`${baseUrl}/stations/new`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '18_Stations_Create_New.png');

  await desktopPage.goto(`${baseUrl}/stations/1`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '19_Station_Detail_View.png');

  await desktopPage.goto(`${baseUrl}/stations/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '20_Station_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/stations/1/ground-plan`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '21_Station_GroundPlan_2D_Builder.png');
  // Copy to Manual directory
  fs.copyFileSync(path.join(ROOT_SCREENSHOTS_DIR, '21_Station_GroundPlan_2D_Builder.png'), path.join(MANUAL_DIR, 'ground_plan_builder.png'));

  await desktopPage.goto(`${baseUrl}/stations/1/live`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '22_Station_Live_FloorPlan_Monitor.png');
  // Copy to Manual directory
  fs.copyFileSync(path.join(ROOT_SCREENSHOTS_DIR, '22_Station_Live_FloorPlan_Monitor.png'), path.join(MANUAL_DIR, 'ground_plan_live_view.png'));

  // 5. Connectors
  console.log('\n--- 5. Connectors ---');
  await desktopPage.goto(`${baseUrl}/connectors`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '23_Connectors_Directory.png');

  await desktopPage.goto(`${baseUrl}/connectors/new`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '24_Connectors_Create_New.png');

  await desktopPage.goto(`${baseUrl}/connectors/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '25_Connector_Edit_Form.png');

  // 6. Charge Groups
  console.log('\n--- 6. Charge Groups ---');
  await desktopPage.goto(`${baseUrl}/charge-groups`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '26_ChargeGroups_DynamicLoadBalancing.png');

  await desktopPage.goto(`${baseUrl}/charge-groups/create`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '27_ChargeGroups_Create_New.png');

  await desktopPage.goto(`${baseUrl}/charge-groups/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '28_ChargeGroup_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/charge-groups/1`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '28b_ChargeGroup_Detail_View.png');

  // 7. V2G Smart Grid
  console.log('\n--- 7. V2G Smart Grid ---');
  await desktopPage.goto(`${baseUrl}/v2g`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '29_V2G_Battery_Orchestration.png');

  // 8. Access & Identity
  console.log('\n--- 8. Access & Identity ---');
  await desktopPage.goto(`${baseUrl}/rfid`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '30_RFID_Whitelist_Directory.png');

  await desktopPage.goto(`${baseUrl}/rfid/new`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '31_RFID_Register_New.png');

  await desktopPage.goto(`${baseUrl}/rfid/1`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '32_RFID_Tag_Detail.png');

  await desktopPage.goto(`${baseUrl}/rfid/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '33_RFID_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/vehicle-identity-management`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '34_VehicleIdentity_PlugAndCharge.png');

  // 9. Reservations
  console.log('\n--- 9. Reservations Manager ---');
  await desktopPage.goto(`${baseUrl}/reservations`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '35_Reservations_Manager.png');

  // 10. Transactions & Invoices (Facturen)
  console.log('\n--- 10. Transactions & Invoices (Facturen) ---');
  await desktopPage.goto(`${baseUrl}/transactions`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '36_Transactions_History_Records.png');

  await desktopPage.goto(`${baseUrl}/transactions/active`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '37_Transactions_Live_Active_Sessions.png');

  await desktopPage.goto(`${baseUrl}/transactions/1`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '38_Transaction_Detail_Receipt.png');

  // Facturen - Main Ledger
  await desktopPage.goto(`${baseUrl}/invoices`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '39_Invoices_Billing_Ledger.png');

  // Facturen - Detail Modal
  const viewInvoiceBtn = desktopPage.locator('button:has-text("View"), button:has-text("Details"), button[title="View Details"]').first();
  if (await viewInvoiceBtn.isVisible({ timeout: 2000 })) {
    await viewInvoiceBtn.click();
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '40_Invoices_Detail_Modal.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Facturen - Generate Invoices Modal
  if (await clickTabSafe(desktopPage, 'button:has-text("Generate Invoices"), button:has-text("Genereer Facturen")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '41_Invoices_Generate_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Facturen - SEPA Mandates Dialog
  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Mandates"), button:has-text("Mandaten")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '42_Invoices_SEPA_Mandates_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Facturen - SEPA Direct Debit XML Export Dialog
  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Direct Debit (pain.008)"), button:has-text("SEPA Direct Debit")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '43_Invoices_DirectDebit_Export_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Reimbursements
  await desktopPage.goto(`${baseUrl}/reimbursements`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '44_Reimbursements_HomeCharging_SEPA.png');

  // 11. Tariffs & Roaming
  console.log('\n--- 11. Tariffs & Roaming ---');
  await desktopPage.goto(`${baseUrl}/tariffs`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '45_Tariffs_Pricing_Structures.png');

  await desktopPage.goto(`${baseUrl}/tariffs/new`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '46_Tariffs_Create_New.png');

  await desktopPage.goto(`${baseUrl}/tariffs/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '47_Tariff_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/roaming`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1200);
  await takeShot(desktopPage, '48_Roaming_OCPI_Hubs.png');

  if (await clickTabSafe(desktopPage, '[role="tab"]:has-text("OICP"), button:has-text("OICP")')) {
    await takeShot(desktopPage, '49_Roaming_OICP_Hubject_Tab.png');
  }

  if (await clickTabSafe(desktopPage, '[role="tab"]:has-text("Settlement"), button:has-text("Settlement")')) {
    await takeShot(desktopPage, '50_Roaming_Settlement_Visualizer_Tab.png');
  }

  await desktopPage.goto(`${baseUrl}/roaming/test-suite`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '50b_Roaming_TestSuite.png');

  // 12. Users & Operations
  console.log('\n--- 12. Users, Corporate Clients & RBAC Hub ---');
  await desktopPage.goto(`${baseUrl}/users`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1200);
  await takeShot(desktopPage, '51_Users_Accounts_Directory.png');

  if (await clickTabSafe(desktopPage, '[role="tab"]:has-text("Clients"), button:has-text("Clients")')) {
    await takeShot(desktopPage, '51a_Corporate_Clients_Directory.png');
  }

  if (await clickTabSafe(desktopPage, '[role="tab"]:has-text("Roles"), button:has-text("Roles")')) {
    await takeShot(desktopPage, '51b_Roles_Permissions_Matrix.png');
  }

  await desktopPage.goto(`${baseUrl}/users/create`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '52_Users_Create_New.png');

  await desktopPage.goto(`${baseUrl}/users/1/edit`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '53_Users_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/hardware-at-risk`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '54_HardwareAtRisk_AutoHeal.png');

  await desktopPage.goto(`${baseUrl}/auto-heal-playbooks`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '54b_AutoHeal_Playbooks.png');

  await desktopPage.goto(`${baseUrl}/ocpp`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '55_OCPP_PacketInspector_Console.png');

  await desktopPage.goto(`${baseUrl}/scheduled-charging`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '56_ScheduledCharging_Calendar.png');

  await desktopPage.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '57_Charger_Simulator_Studio.png');

  await desktopPage.goto(`${baseUrl}/config-profiles`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '58_ConfigProfiles_Templates.png');

  await desktopPage.goto(`${baseUrl}/quirk-profiles`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '59_QuirkProfiles_HardwareOverrides.png');

  // Public checkout
  await desktopPage.goto(`${baseUrl}/payments?session=TXN-TEST-9981`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '60_Public_Payments_Checkout.png');

  // 13. Settings Suite
  console.log('\n--- 13. Settings Suite ---');
  await desktopPage.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '61_Settings_Account_Security.png');

  if (await clickTabSafe(desktopPage, 'button:has-text("Authenticator App")')) {
    await takeShot(desktopPage, '62_Settings_2FA_Authenticator_Setup.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  await desktopPage.goto(`${baseUrl}/settings/security`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '63_Settings_Security_Profiles_PKI.png');

  await desktopPage.goto(`${baseUrl}/settings/audit`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '64_Settings_Enterprise_Audit_Trail.png');

  await desktopPage.goto(`${baseUrl}/settings/tariffs`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '65_Settings_DynamicTariffs_EPEX.png');

  await desktopPage.goto(`${baseUrl}/settings/templates`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '66_Settings_MailTemplates_Editor.png');

  await desktopPage.goto(`${baseUrl}/settings/mail`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '67_Settings_SMTP_Server.png');

  await desktopPage.goto(`${baseUrl}/settings/ad-manager`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '68_Settings_Screen_AdManager.png');

  await desktopPage.goto(`${baseUrl}/media-campaigns`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '68b_MediaCampaigns_Scheduler.png');

  await desktopPage.goto(`${baseUrl}/settings/hardware-at-risk`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '69_Settings_HardwareAtRisk_Rules.png');

  await desktopPage.goto(`${baseUrl}/settings/payments`, { waitUntil: 'domcontentloaded' });
  await takeShot(desktopPage, '70_Settings_MolliePayments_Gateway.png');

  // 13b. Proof Modal Dialogs
  console.log('\n--- 13b. Capturing Operational Dialog Modals ---');
  async function captureModal(url, buttonSelector, filename) {
    try {
      await desktopPage.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
      await desktopPage.waitForTimeout(1200);
      const btn = desktopPage.locator(buttonSelector).first();
      await btn.waitFor({ state: 'visible', timeout: 4000 });
      await btn.click({ force: true });
      await desktopPage.waitForTimeout(800);
      await takeShot(desktopPage, filename);
      await desktopPage.keyboard.press('Escape');
      await desktopPage.waitForTimeout(400);
    } catch (e) {
      console.warn(`[WARN] Could not capture modal ${filename}:`, e.message);
    }
  }

  await captureModal('/settings/firmware', 'button:has-text("Upload Firmware Binary")', 'proof_modal_firmware.png');
  await captureModal('/settings/webhooks', 'button:has-text("Register Webhook")', 'proof_modal_webhooks.png');
  await captureModal('/settings/roles', 'button:has-text("Create Custom Role")', 'proof_modal_roles.png');
  await captureModal('/scheduled-charging', 'button:has-text("New Schedule"), button:has-text("Create Schedule")', 'proof_modal_scheduled_charging.png');
  await captureModal('/invoices', 'button:has-text("Generate Monthly Invoices"), button:has-text("Generate Invoices")', 'proof_modal_invoices_generate.png');
  await captureModal('/invoices', 'button:has-text("SEPA Direct Debit (pain.008)"), button:has-text("SEPA Direct Debit")', 'proof_modal_invoices_sepa.png');
  await captureModal('/invoices', 'button:has-text("SEPA Mandates"), button:has-text("Mandaten")', 'proof_modal_invoices_mandate.png');
  await captureModal('/settings/audit', 'button:has-text("Clear Audit Logs"), button:has-text("Clear Logs")', 'proof_modal_audit_clear.png');
  await captureModal('/quirk-profiles', 'button:has-text("New Quirk Profile"), button:has-text("Create First Profile")', 'proof_modal_quirk_profiles.png');
  await captureModal('/reservations', 'button:has-text("New Reservation")', 'proof_modal_reservations.png');
  await captureModal('/settings/products', 'button:has-text("New Subscription Product"), button:has-text("New Product")', 'proof_modal_products.png');
  await captureModal('/config-profiles', 'button:has-text("New Profile"), button:has-text("New Template")', 'proof_modal_config_profiles.png');

  await desktopContext.close();

  // 14. Mobile Driver Views
  console.log('\n--- 14. Mobile Driver Companion ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });

  const mobilePage = await mobileContext.newPage();
  await setupApiMocks(mobilePage);
  await injectAuth(mobilePage);

  await mobilePage.goto(`${baseUrl}/mobile/dashboard`, { waitUntil: 'domcontentloaded' });
  await takeShot(mobilePage, '71_Mobile_Dashboard.png');

  await mobilePage.goto(`${baseUrl}/mobile/chargers`, { waitUntil: 'domcontentloaded' });
  await takeShot(mobilePage, '72_Mobile_Chargers_Fleet.png');

  await mobilePage.goto(`${baseUrl}/mobile/chargers/1`, { waitUntil: 'domcontentloaded' });
  await takeShot(mobilePage, '73_Mobile_Charger_Detail_Controller.png');

  await mobilePage.goto(`${baseUrl}/mobile/map`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);
  await takeShot(mobilePage, '74_Mobile_Station_Map.png');

  await mobilePage.goto(`${baseUrl}/mobile/settings`, { waitUntil: 'domcontentloaded' });
  await takeShot(mobilePage, '75_Mobile_Driver_Settings.png');

  await mobileContext.close();
  await browser.close();

  // Copy manual references
  const manualDir = path.resolve(__dirname, '../../Manual');
  const gpBuilderSrc = path.join(ROOT_SCREENSHOTS_DIR, '21_Station_GroundPlan_2D_Builder.png');
  const gpLiveSrc = path.join(ROOT_SCREENSHOTS_DIR, '22_Station_Live_FloorPlan_Monitor.png');
  if (fs.existsSync(gpBuilderSrc)) {
    fs.copyFileSync(gpBuilderSrc, path.join(manualDir, 'ground_plan_builder.png'));
  }
  if (fs.existsSync(gpLiveSrc)) {
    fs.copyFileSync(gpLiveSrc, path.join(manualDir, 'ground_plan_live_view.png'));
  }

  console.log('\n====================================================');
  console.log(' All Fresh Platform Screenshots Generated Successfully! ');
  console.log('====================================================');
  } finally {
    cleanup();
  }
}

run().catch((err) => {
  console.error('Error during screenshot generation:', err);
  process.exit(1);
});
