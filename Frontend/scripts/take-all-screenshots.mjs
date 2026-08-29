import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary root Screenshots directory and Frontend Screenshots directory
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../Screenshots');
const FRONTEND_SCREENSHOTS_DIR = path.resolve(__dirname, '../Screenshots');
const MANUAL_DIR = path.resolve(__dirname, '../../Manual');

// Ensure clean directories
for (const dir of [SCREENSHOTS_DIR, FRONTEND_SCREENSHOTS_DIR]) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg')) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Unified, complete mock dataset
const mockUser = {
  id: 1,
  email: 'superadmin@mobilitypulse.com',
  name: 'Super Administrator',
  role: 'superadmin',
  userType: 'company',
  companyName: 'Pulse Charge Network B.V.',
  companyId: 1,
  address: 'Keizersgracht 421, 1016 EK Amsterdam',
  phone: '+31 20 894 3200',
  taxNumber: 'NL861234567B01',
  createdAt: '2024-01-15T08:00:00.000Z',
  twoFactorEnabled: true,
  twoFactorMethod: 'authenticator',
  emailVerified: true,
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
  {
    charger_id: 1,
    name: "Alfen Eve Double Pro - Bay 1",
    status: "Charging",
    last_heartbeat: new Date().toISOString(),
    connectors: 2,
    active_sessions: 1
  },
  {
    charger_id: 2,
    name: "Kempower Hypercharge - Bay 3",
    status: "Charging",
    last_heartbeat: new Date().toISOString(),
    connectors: 4,
    active_sessions: 2
  },
  {
    charger_id: 3,
    name: "ABB Terra 184 - Bay 1",
    status: "Available",
    last_heartbeat: new Date().toISOString(),
    connectors: 2,
    active_sessions: 0
  },
  {
    charger_id: 4,
    name: "Raedian Nex - Bay 2",
    status: "Charging",
    last_heartbeat: new Date().toISOString(),
    connectors: 2,
    active_sessions: 1
  }
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
  },
  {
    id: 3,
    name: "Brussels European Quarter Station",
    station_name: "Brussels European Quarter Station",
    street_name: "Rue de la Loi 175",
    city: "Bruxelles",
    state: "Brussels",
    postal_code: "1048",
    address: "Rue de la Loi 175, 1048 Bruxelles",
    status: "Active",
    latitude: 50.8436,
    longitude: 4.3828,
    on_site_person_name: "Marc Laurent",
    on_site_contact_details: "+32 2 281 6111",
    emergency_contact: "+32 800 123 45",
    createdAt: "2024-03-20T11:00:00.000Z",
    isGroundPlanEnabled: false,
    totalPowerKw: 220,
    chargerCount: 4,
    chargers: [
      { id: 4, charger_id: 4, name: "Raedian Nex - Bay 2", model: "NEX-22K-DUAL", status: "Charging", isOnline: true }
    ]
  },
  {
    id: 4,
    name: "Utrecht Science Park Solar Hub",
    station_name: "Utrecht Science Park Solar Hub",
    street_name: "Heidelberglaan 8",
    city: "Utrecht",
    state: "Utrecht",
    postal_code: "3584 CS",
    address: "Heidelberglaan 8, 3584 CS Utrecht",
    status: "Active",
    latitude: 52.0850,
    longitude: 5.1764,
    on_site_person_name: "Emma de Jong",
    on_site_contact_details: "+31 30 253 8000",
    emergency_contact: "+31 800 022 9988",
    createdAt: "2024-04-05T14:15:00.000Z",
    isGroundPlanEnabled: true,
    totalPowerKw: 350,
    chargerCount: 5,
    chargers: []
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
      { id: 1, connectorId: 1, connector_id: 1, connector_name: "Bay 1 - CCS2 (22kW)", type: "CCS2", status: "Charging", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 21.4 },
      { id: 2, connectorId: 2, connector_id: 2, connector_name: "Bay 1 - Type 2 (22kW)", type: "Type2", status: "Available", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 0 }
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
  },
  {
    id: 3,
    charger_id: "CP-RTD-01",
    name: "ABB Terra 184 - Bay 1",
    vendor: "ABB E-Mobility",
    manufacturer: "ABB E-Mobility",
    model: "Terra 184 High Power",
    serial_number: "ABB-TERRA-2025-019",
    serialNumber: "ABB-TERRA-2025-019",
    firmware_version: "4.12.0",
    firmwareVersion: "4.12.0",
    protocol: "ocpp1.6",
    ocppProtocol: "ocpp1.6",
    power_capacity: 180,
    maxPowerKw: 180,
    status: "online",
    isOnline: true,
    last_heartbeat: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    service_contacts: "support@abb.com",
    charging_station_id: 2,
    chargingStation: { id: 2, station_name: "Rotterdam Port Fast Charging Depot" },
    stationId: 2,
    station: { id: 2, name: "Rotterdam Port Fast Charging Depot", station_name: "Rotterdam Port Fast Charging Depot" },
    Station: { id: 2, name: "Rotterdam Port Fast Charging Depot", station_name: "Rotterdam Port Fast Charging Depot" },
    tariffs: [{ tariff_id: 2 }],
    chargeGroupId: 2,
    connectors: [
      { id: 5, connectorId: 1, connector_id: 1, type: "CCS2", status: "Available", maxPowerKw: 180, max_power_kw: 180, currentPowerKw: 0 },
      { id: 6, connectorId: 2, connector_id: 2, type: "Type2", status: "Available", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 0 }
    ],
    evses: []
  },
  {
    id: 4,
    charger_id: "CP-BRU-02",
    name: "Raedian Nex - Bay 2",
    vendor: "Raedian",
    manufacturer: "Raedian",
    model: "NEX-22K-DUAL",
    serial_number: "RDN-77120-EU",
    serialNumber: "RDN-77120-EU",
    firmware_version: "1.9.0",
    firmwareVersion: "1.9.0",
    protocol: "ocpp1.6",
    ocppProtocol: "ocpp1.6",
    power_capacity: 22,
    maxPowerKw: 22,
    status: "charging",
    isOnline: true,
    last_heartbeat: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    service_contacts: "ops@raedian.eu",
    charging_station_id: 3,
    chargingStation: { id: 3, station_name: "Brussels European Quarter Station" },
    stationId: 3,
    station: { id: 3, name: "Brussels European Quarter Station", station_name: "Brussels European Quarter Station" },
    Station: { id: 3, name: "Brussels European Quarter Station", station_name: "Brussels European Quarter Station" },
    connectors: [
      { id: 7, connectorId: 1, connector_id: 1, type: "Type2", status: "Charging", maxPowerKw: 22, max_power_kw: 22, currentPowerKw: 11.0 }
    ],
    evses: []
  }
];

const mockConnectors = [
  { id: 1, connectorId: 1, type: "CCS2", status: "Charging", maxPowerKw: 22, chargerId: "CP-AMS-01", charger: { id: 1, name: "Alfen Eve Double Pro - Bay 1" } },
  { id: 2, connectorId: 2, type: "Type2", status: "Available", maxPowerKw: 22, chargerId: "CP-AMS-01", charger: { id: 1, name: "Alfen Eve Double Pro - Bay 1" } },
  { id: 3, connectorId: 1, type: "CCS2", status: "Charging", maxPowerKw: 150, chargerId: "CP-AMS-02", charger: { id: 2, name: "Kempower Hypercharge - Bay 3" } },
  { id: 4, connectorId: 2, type: "CHAdeMO", status: "Available", maxPowerKw: 50, chargerId: "CP-AMS-02", charger: { id: 2, name: "Kempower Hypercharge - Bay 3" } },
  { id: 5, connectorId: 1, type: "CCS2", status: "Available", maxPowerKw: 180, chargerId: "CP-RTD-01", charger: { id: 3, name: "ABB Terra 184 - Bay 1" } },
  { id: 6, connectorId: 2, type: "Type2", status: "Available", maxPowerKw: 22, chargerId: "CP-RTD-01", charger: { id: 3, name: "ABB Terra 184 - Bay 1" } },
  { id: 7, connectorId: 1, type: "Type2", status: "Charging", maxPowerKw: 22, chargerId: "CP-BRU-02", charger: { id: 4, name: "Raedian Nex - Bay 2" } }
];

const mockChargeGroups = [
  {
    id: 1,
    name: "Amsterdam Hub - High Voltage Substation Alpha",
    maxCurrentAmps: 600,
    maxPowerKw: 400,
    dynamicLoadBalancing: true,
    peakShaving: true,
    activePowerKw: 198.5,
    stationId: 1,
    station: { name: "Amsterdam Central Charging Hub" },
    chargers: [
      { id: 1, name: "Alfen Eve Double Pro - Bay 1", maxPowerKw: 44 },
      { id: 2, name: "Kempower Hypercharge - Bay 3", maxPowerKw: 150 }
    ]
  },
  {
    id: 2,
    name: "Rotterdam Depot Grid Cluster Beta",
    maxCurrentAmps: 900,
    maxPowerKw: 600,
    dynamicLoadBalancing: true,
    peakShaving: true,
    activePowerKw: 180.0,
    stationId: 2,
    station: { name: "Rotterdam Port Fast Charging Depot" },
    chargers: [
      { id: 3, name: "ABB Terra 184 - Bay 1", maxPowerKw: 180 }
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
    user: { name: "Super Administrator", email: "superadmin@mobilitypulse.com" }
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

const mockRfidTagDetail = {
  id: 1,
  rfid_tag: "E200001928390012",
  external_id: "CARD-8839-NL",
  name: "Super Administrator",
  email: "superadmin@mobilitypulse.com",
  phone: "+31 20 894 3200",
  company: "Pulse Charge Network B.V.",
  address: "Keizersgracht 421, Amsterdam",
  active: true,
  createdAt: "2024-01-10T10:00:00Z"
};

const mockRfidTags = [
  {
    id: 1,
    idTag: "E200001928390012",
    rfid_tag: "E200001928390012",
    visualNumber: "CARD-8839-NL",
    userName: "Super Administrator",
    userEmail: "superadmin@mobilitypulse.com",
    name: "Super Administrator",
    status: "Active",
    isActive: true,
    active: true,
    expiryDate: "2028-01-01T00:00:00Z",
    tagType: "Mifare Classic 1K",
    note: "Master Operations Fleet Tag",
    createdAt: "2024-01-10T10:00:00Z"
  },
  {
    id: 2,
    idTag: "B849201948201934",
    rfid_tag: "B849201948201934",
    visualNumber: "CARD-1102-EU",
    userName: "Dr. Willem Janssen",
    userEmail: "w.janssen@leaseplan.nl",
    name: "Dr. Willem Janssen",
    status: "Active",
    isActive: true,
    active: true,
    expiryDate: "2027-06-15T00:00:00Z",
    tagType: "ISO 14443 Type A",
    note: "Corporate Lease Driver",
    createdAt: "2024-03-12T14:30:00Z"
  }
];

const mockReservations = [
  {
    id: 1,
    reservationId: 4012,
    chargerId: 1,
    connectorId: 1,
    idTag: "E200001928390012",
    parentIdTag: null,
    expiryDate: new Date(Date.now() + 1800000).toISOString(),
    status: "Active",
    createdAt: new Date().toISOString(),
    charger: { charger_id: 1, name: "Alfen Eve Double Pro - Bay 1", model: "Eve Double Pro" },
    user: { id: 1, name: "Super Administrator", email: "superadmin@mobilitypulse.com" }
  },
  {
    id: 2,
    reservationId: 4011,
    chargerId: 2,
    connectorId: 1,
    idTag: "B849201948201934",
    parentIdTag: null,
    expiryDate: new Date(Date.now() - 3600000).toISOString(),
    status: "Consumed",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
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
    user: { name: "Super Administrator", email: "superadmin@mobilitypulse.com" }
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
    company: { name: "Pulse Fleet Services B.V." },
    status: "paid",
    createdAt: "2026-08-01T08:00:00Z",
    dueDate: "2026-08-15T00:00:00Z",
    subtotal: 1240.50,
    vatRate: 21,
    vatAmount: 260.51,
    totalAmount: 1501.01,
    currency: "EUR",
    chargingSessionsCount: 48,
    kwhTotal: 3340.2,
    items: [
      { id: 1, description: "August 2026 High-Power Charging Energy (3,340.2 kWh)", quantity: 3340.2, unitPrice: 0.35, vatRate: 21, vatAmount: 245.50, amount: 1169.07, total: 1169.07 },
      { id: 2, description: "Monthly Corporate EVSE Fleet Connection Fee", quantity: 1, unitPrice: 71.43, vatRate: 21, vatAmount: 15.01, amount: 71.43, total: 71.43 }
    ]
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-0043",
    recipientName: "Green Mobility Logistics N.V.",
    recipientEmail: "accounts@greenmobility.be",
    company: { name: "Green Mobility Logistics N.V." },
    status: "issued",
    createdAt: "2026-08-15T09:30:00Z",
    dueDate: "2026-08-29T00:00:00Z",
    subtotal: 840.00,
    vatRate: 21,
    vatAmount: 176.40,
    totalAmount: 1016.40,
    currency: "EUR",
    chargingSessionsCount: 31,
    kwhTotal: 2250.0,
    items: [
      { id: 3, description: "August 2026 Commercial Fleet Sessions (2,250 kWh)", quantity: 2250.0, unitPrice: 0.36, vatRate: 21, vatAmount: 170.10, amount: 810.00, total: 810.00 },
      { id: 4, description: "Direct Roaming Surcharge", quantity: 1, unitPrice: 30.00, vatRate: 21, vatAmount: 6.30, amount: 30.00, total: 30.00 }
    ]
  }
];

const mockInvoicesResponse = {
  invoices: mockInvoicesList,
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
  stats: {
    totalSubtotal: 2080.50,
    totalVat: 436.91,
    totalAmount: 2517.41,
    paidAmount: 1501.01,
    pendingAmount: 1016.40,
    count: 2
  }
};

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
    rfidUser: { name: "Super Administrator", email: "superadmin@mobilitypulse.com" },
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
    employeeEmail: "superadmin@mobilitypulse.com",
    totalKwh: 342.6,
    tariffRate: 0.38,
    totalAmount: 130.19,
    iban: "NL91ABNA0417164300",
    status: "Approved",
    sepaBatchId: "SEPA-202608-BATCH-01",
    contract: {
      user: { name: "Super Administrator", email: "superadmin@mobilitypulse.com" },
      station: { name: "Amsterdam Central Charging Hub" },
      tariff: { name: "Standard Public AC Fast (22kW)" }
    }
  }
];

const mockUsers = [
  {
    id: 1,
    name: "Super Administrator",
    email: "superadmin@mobilitypulse.com",
    role: "superadmin",
    userType: "company",
    companyName: "Pulse Charge Network B.V.",
    companyId: 1,
    company: { id: 1, name: "Pulse Charge Network B.V.", clientNumber: "CLI-1000" },
    status: "Active",
    createdAt: "2024-01-15T08:00:00Z",
    emailVerified: true,
    twoFactorEnabled: true,
  },
  {
    id: 2,
    name: "Dr. Willem Janssen",
    email: "w.janssen@leaseplan.nl",
    role: "client_admin",
    userType: "company",
    companyName: "LeasePlan Corporate Fleet",
    companyId: 2,
    company: { id: 2, name: "LeasePlan Corporate Fleet", clientNumber: "CLI-1001" },
    status: "Active",
    createdAt: "2024-03-01T10:30:00Z",
    emailVerified: true,
    twoFactorEnabled: true,
  },
  {
    id: 3,
    name: "Sophie Dupont",
    email: "s.dupont@engie.be",
    role: "operator",
    userType: "employee",
    companyName: "Engie Mobility",
    companyId: 3,
    company: { id: 3, name: "Engie Mobility", clientNumber: "CLI-1002" },
    status: "Active",
    createdAt: "2024-05-12T16:00:00Z",
    emailVerified: true,
    twoFactorEnabled: false,
  },
  {
    id: 4,
    name: "Lars van Dijk",
    email: "lars.vandijk@greenlogistics.nl",
    role: "user",
    userType: "employee",
    companyName: "Green Logistics B.V.",
    companyId: 4,
    company: { id: 4, name: "Green Logistics B.V.", clientNumber: "CLI-1003" },
    status: "Active",
    createdAt: "2024-06-20T11:00:00Z",
    emailVerified: true,
    twoFactorEnabled: false,
  }
];

const mockCompanies = [
  {
    id: 1,
    name: "Pulse Charge Network B.V.",
    clientNumber: "CLI-1000",
    vatNumber: "NL861234567B01",
    chamberOfCommerce: "78912345",
    contactName: "Super Administrator",
    contactEmail: "admin@webdotpulse.eu",
    contactPhone: "+31 20 894 3200",
    city: "Amsterdam",
    status: "Active",
    _count: { users: 12, chargingStations: 6, invoices: 24 },
    users: mockUsers.filter(u => u.companyId === 1)
  },
  {
    id: 2,
    name: "LeasePlan Corporate Fleet",
    clientNumber: "CLI-1001",
    vatNumber: "NL001928374B01",
    chamberOfCommerce: "33182941",
    contactName: "Dr. Willem Janssen",
    contactEmail: "w.janssen@leaseplan.nl",
    contactPhone: "+31 20 555 0192",
    city: "Almere",
    status: "Active",
    _count: { users: 48, chargingStations: 14, invoices: 88 },
    users: mockUsers.filter(u => u.companyId === 2)
  },
  {
    id: 3,
    name: "Engie Mobility Services",
    clientNumber: "CLI-1002",
    vatNumber: "BE0403014728",
    chamberOfCommerce: "0403014728",
    contactName: "Sophie Dupont",
    contactEmail: "s.dupont@engie.be",
    contactPhone: "+32 2 281 6111",
    city: "Bruxelles",
    status: "Active",
    _count: { users: 22, chargingStations: 8, invoices: 42 },
    users: mockUsers.filter(u => u.companyId === 3)
  }
];

const mockRoles = {
  roles: [
    { role: "superadmin", name: "Super Administrator", badgeColor: "#8b5cf6", level: 100, scope: "Global Platform", description: "Full unrestricted access across all client organizations, hardware endpoints, roaming partners, audit logs, and system settings.", isSystem: true },
    { role: "admin", name: "Platform / CPO Administrator", badgeColor: "#e2626b", level: 80, scope: "Organization / CPO", description: "Manages charging networks, site locations, dynamic tariffs, billing & SEPA, client accounts, and user permissions.", isSystem: true },
    { role: "operator", name: "Operations & Field Technician", badgeColor: "#3f78e0", level: 60, scope: "Hardware & Network", description: "Responsible for charger reliability, live monitoring, diagnostics, firmware deployment, and remote controls. Restricted from billing and financial accounts.", isSystem: false },
    { role: "client_admin", name: "Corporate Client / Fleet Manager", badgeColor: "#45c4a0", level: 40, scope: "Corporate Client / Tenant", description: "Administers corporate fleet drivers, employee RFID cards, assigned stations/chargers, and monthly company invoices.", isSystem: false },
    { role: "user", name: "EV Driver / Standard User", badgeColor: "#54a8c7", level: 20, scope: "Individual Account", description: "Standard EV driver initiating charging sessions, managing personal RFID cards, vehicle battery profiles, and receipts.", isSystem: false }
  ],
  capabilities: [
    { key: "chargers.view", name: "View Chargers & Status", category: "Infrastructure", description: "Browse connected chargers, EVSE connector states, and real-time telemetry", allowedRoles: ["superadmin", "admin", "operator", "client_admin", "user"] },
    { key: "chargers.control", name: "Remote Charger Commands", category: "Infrastructure", description: "Execute Remote Start/Stop, Reset (Soft/Hard), Unlock Connector, and Change Availability", allowedRoles: ["superadmin", "admin", "operator", "client_admin"] },
    { key: "chargers.edit", name: "Configure Hardware & Profiles", category: "Infrastructure", description: "Create or modify charger parameters, OCPP configuration keys, and quirk overrides", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "stations.manage", name: "Manage Site Locations & Ground Plans", category: "Infrastructure", description: "Create charging stations, configure max site power limits, and design 2D ground plans", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "chargegroups.manage", name: "Dynamic Load Balancing Groups", category: "Infrastructure", description: "Define dynamic phase-balancing clusters, current allocations, and fail-safe power limits", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "v2g.manage", name: "V2G & Grid Discharge Orchestration", category: "Energy & Smart Grid", description: "Configure dynamic vehicle-to-grid limits, peak shaving schedules, and minimum SoC reserves", allowedRoles: ["superadmin", "admin"] },
    { key: "tariffs.manage", name: "Dynamic Tariffs & EPEX Pricing", category: "Energy & Smart Grid", description: "Manage fixed pricing templates and dynamic EPEX day-ahead wholesale electricity formulas", allowedRoles: ["superadmin", "admin"] },
    { key: "rfid.manage", name: "RFID Whitelist & Cards", category: "Fleet & Access", description: "Enroll, assign, block, and whitelist RFID driver tags with real-time sync", allowedRoles: ["superadmin", "admin", "operator", "client_admin"] },
    { key: "vehicles.manage", name: "Vehicle Profiles & ISO 15118 PnC", category: "Fleet & Access", description: "Manage eMAID contract certificates and vehicle battery energy capacities", allowedRoles: ["superadmin", "admin", "client_admin", "user"] },
    { key: "invoices.view", name: "View Invoices & Billing Ledger", category: "Invoices & Finance", description: "Access aggregated monthly invoices, line-item transactions, and tax summaries", allowedRoles: ["superadmin", "admin", "client_admin"] },
    { key: "invoices.export", name: "SEPA Direct Debit & Export", category: "Invoices & Finance", description: "Generate ISO 20022 SEPA Direct Debit XML batches (pain.008) and manage mandates", allowedRoles: ["superadmin", "admin"] },
    { key: "reimbursements.manage", name: "Employee Home Reimbursements", category: "Invoices & Finance", description: "Calculate home charging expenses and export SEPA Credit Transfer (pain.001)", allowedRoles: ["superadmin", "admin"] },
    { key: "roaming.manage", name: "OCPI & OICP Roaming Hubs", category: "Operations & Logs", description: "Configure roaming connections (Hubject, e-clearing) and inspect roaming settlement visualizer", allowedRoles: ["superadmin", "admin"] },
    { key: "ocpp.logs", name: "Live OCPP WebSocket Inspector", category: "Operations & Logs", description: "Real-time raw JSON-RPC frame debugger with schema validation and packet inspector", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "hardware.autoheal", name: "Hardware at Risk & Auto-Heal", category: "Operations & Logs", description: "Monitor fault heuristics, lock solenoid alarms, and automated recovery actions", allowedRoles: ["superadmin", "admin", "operator"] },
    { key: "users.manage", name: "User Account Administration", category: "Administration", description: "Create and edit platform logins, change passwords, and manage email verification", allowedRoles: ["superadmin", "admin"] },
    { key: "clients.manage", name: "Corporate Client Management", category: "Administration", description: "Create and administer B2B corporate client accounts, billing entities, and assigned fleets", allowedRoles: ["superadmin", "admin"] },
    { key: "roles.assign", name: "Role & Permission Assignment", category: "Administration", description: "Assign and modify system access roles and organizational scoping", allowedRoles: ["superadmin", "admin"] },
    { key: "audit.view", name: "Enterprise Audit Trail", category: "Administration", description: "Inspect tamper-evident immutable security logs for all platform state mutations", allowedRoles: ["superadmin"] }
  ]
};

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
  },
  {
    id: 2,
    name: "Kempower Hypercharge Fast DC Preset",
    description: "High speed DC parameter preset with ISO 15118 PnC contract verification.",
    vendor: "Kempower",
    protocol: "ocpp2.0.1",
    items: [
      { key: "HeartbeatInterval", value: "30" },
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "Iso15118PnCEnabled", value: "true" },
      { key: "DynamicLoadControl", value: "true" }
    ],
    createdAt: "2024-04-18T09:00:00Z"
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
  },
  {
    id: 2,
    name: "Schneider EVlink Strict Heartbeat Override",
    vendor: "Schneider",
    modelMatch: "EVlink*",
    description: "Permits slight heartbeat drift without flagging offline.",
    quirks: {
      heartbeatGraceMultiplier: 2.5
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
    bodyHtml: `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #54a8c7;">Charging Receipt</h2>
      <p>Thank you for charging on the Pulse Network!</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td><strong>Station:</strong></td><td>{{stationName}}</td></tr>
        <tr><td><strong>Energy Delivered:</strong></td><td>{{energyDeliveredKwh}} kWh</td></tr>
        <tr><td><strong>Total Amount:</strong></td><td><strong>€{{totalCost}}</strong></td></tr>
      </table>
    </div>`,
    bodyText: "Charging Receipt - Total: €{{totalCost}}"
  },
  {
    id: 2,
    name: "Password Reset Request",
    type: "password_reset",
    language: "en",
    subject: "Reset your OCPP CPMS Password",
    bodyHtml: `<div style="font-family: sans-serif; padding: 20px;"><h2>Reset Password</h2><p>Click below to reset your operator password:</p><a href="{{resetUrl}}" style="background:#54a8c7;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Reset Password</a></div>`,
    bodyText: "Reset your password: {{resetUrl}}"
  }
];

const mockAuditLogs = [
  {
    id: 1,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    userId: 1,
    user: { id: 1, name: "Super Administrator", email: "superadmin@mobilitypulse.com" },
    action: "UPDATE_TARIFF",
    target: "Tariff",
    targetId: "3",
    ip: "192.168.1.100",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0",
    payload: { oldRate: 0.07, newRate: 0.08, mode: "dynamic_epex" }
  },
  {
    id: 2,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    userId: 1,
    user: { id: 1, name: "Super Administrator", email: "superadmin@mobilitypulse.com" },
    action: "REMOTE_START_TRANSACTION",
    target: "Charger",
    targetId: "CP-AMS-01",
    ip: "192.168.1.100",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0",
    payload: { connectorId: 1, idTag: "E200001928390012" }
  },
  {
    id: 3,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    userId: 2,
    user: { id: 2, name: "Dr. Willem Janssen", email: "w.janssen@leaseplan.nl" },
    action: "GENERATE_SEPA_DIRECT_DEBIT",
    target: "Invoice",
    targetId: "BATCH-2026-08",
    ip: "192.168.1.105",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0",
    payload: { totalInvoices: 14, totalAmount: 2517.41 }
  }
];

const mockCertificates = [
  {
    id: 1,
    chargerId: 1,
    certificateType: "ChargingStationCertificate",
    certificatePem: "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIUQ7... (Valid TLS Client Cert)\n-----END CERTIFICATE-----",
    serialNumber: "SN-CERT-2026-9901",
    issuer: "C=NL, O=Pulse CA, CN=Pulse Root CA",
    subject: "C=NL, CN=CP-AMS-01.ev.mobilitypulse.com",
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2028-01-01T00:00:00Z",
    status: "Installed",
    charger: { charger_id: 1, name: "Alfen Eve Double Pro - Bay 1" }
  }
];

const mockCaInfo = {
  certificatePem: "-----BEGIN CERTIFICATE-----\nMIIDITCCAgmgAwIBAgIUH9... (Pulse Authority Root CA)\n-----END CERTIFICATE-----",
  serialNumber: "ROOT-CA-2024-001",
  validFrom: "2024-01-01T00:00:00Z",
  validTo: "2034-01-01T00:00:00Z",
  certificateHashData: {
    issuerNameHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    issuerKeyHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    serialNumber: "ROOT-CA-2024-001"
  }
};

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
    {
      id: 1,
      name: "MV/LV 630kVA Transformer Substation",
      type: "transformer",
      x: 80,
      y: 60,
      width: 140,
      height: 80,
      rotation: 0,
      fillColor: "#1e2228",
      lineColor: "#54a8c7",
      metadata: { ratingKva: 630, gridConnectionVoltage: 10000 }
    },
    {
      id: 2,
      name: "Main Distribution Board MDB-01",
      type: "distribution_board",
      x: 320,
      y: 60,
      width: 130,
      height: 70,
      rotation: 0,
      fillColor: "#262b32",
      lineColor: "#fab758",
      metadata: { maxCurrentAmps: 900 }
    },
    {
      id: 3,
      name: "Bay 1 - Alfen Eve Double Pro",
      type: "spot",
      x: 100,
      y: 220,
      width: 160,
      height: 100,
      rotation: 0,
      connectorId: 1,
      chargerId: 1,
      telemetry: {
        chargerId: 1,
        name: "Alfen Eve Double Pro - Bay 1",
        status: "Charging",
        activePowerKw: 42.5,
        currentL1: 61.2,
        currentL2: 60.8,
        currentL3: 61.0,
        voltageL1: 231.4,
        voltageL2: 230.8,
        voltageL3: 231.1,
        unbalanceAmps: 0.4,
        unbalancePercentage: 0.7,
        isUnbalanced: false
      }
    },
    {
      id: 4,
      name: "Bay 2 - Kempower Hypercharge 150kW",
      type: "spot",
      x: 340,
      y: 220,
      width: 160,
      height: 100,
      rotation: 0,
      connectorId: 3,
      chargerId: 2,
      telemetry: {
        chargerId: 2,
        name: "Kempower Hypercharge - Bay 3",
        status: "Charging",
        activePowerKw: 150.0,
        currentL1: 217.4,
        currentL2: 216.8,
        currentL3: 215.9,
        voltageL1: 230.1,
        voltageL2: 229.8,
        voltageL3: 230.4,
        unbalanceAmps: 1.5,
        unbalancePercentage: 0.9,
        isUnbalanced: false
      }
    }
  ],
  feeders: [
    {
      id: 1,
      name: "Feeder Trunk 1 (Transformer -> MDB)",
      cableType: "4x240mm² Al XLPE",
      lengthMeters: 25,
      ratedCurrentAmps: 500,
      activeCurrentL1: 298.4,
      activeCurrentL2: 290.1,
      activeCurrentL3: 285.6,
      maxPhaseCurrent: 298.4,
      loadPercentage: 59.6,
      loadLevel: "normal"
    },
    {
      id: 2,
      name: "Feeder 2 (MDB -> DC Hypercharger Bay 2)",
      cableType: "4x150mm² Cu XLPE",
      lengthMeters: 45,
      ratedCurrentAmps: 300,
      activeCurrentL1: 217.4,
      activeCurrentL2: 216.8,
      activeCurrentL3: 215.9,
      maxPhaseCurrent: 217.4,
      loadPercentage: 72.5,
      loadLevel: "normal"
    }
  ]
};

const mockParkingSpots = [
  { id: 1, name: "Spot A1 (Fast CCS2)", chargerId: 1, connectorId: "1", connector: { connector_id: 1, connector_name: "CCS2 - Bay 1" }, x: 100, y: 180, width: 140, height: 90, status: "Charging", type: "spot" },
  { id: 2, name: "Spot A2 (Type 2 AC)", chargerId: 1, connectorId: "2", connector: { connector_id: 2, connector_name: "Type2 - Bay 1" }, x: 260, y: 180, width: 140, height: 90, status: "Available", type: "spot" },
  { id: 3, name: "Spot B1 (High-Power DC 150kW)", chargerId: 2, connectorId: "3", connector: { connector_id: 3, connector_name: "CCS2 High Power" }, x: 420, y: 180, width: 140, height: 90, status: "Charging", type: "spot" },
  { id: 4, name: "Spot B2 (CHAdeMO 50kW)", chargerId: 2, connectorId: "4", connector: { connector_id: 4, connector_name: "CHAdeMO 50kW" }, x: 580, y: 180, width: 140, height: 90, status: "Available", type: "spot" }
];

async function setupApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname;

    const json = (data, status = 200) => {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data })
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
    if (pathName.includes('/auth/2fa/generate')) return json({ secret: 'JBSWY3DPEHPK3PXP', qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/OCPP-CPMS:superadmin@mobilitypulse.com?secret=JBSWY3DPEHPK3PXP' });
    if (pathName.includes('/dashboard/overview')) return json(mockOverview);
    if (pathName.includes('/dashboard/distribution')) return rawJson(mockDistribution);
    if (pathName.includes('/dashboard/live-sessions')) return rawJson(mockLiveSessions);
    if (pathName.includes('/dashboard/chargers-status')) return rawJson(mockChargersStatus);
    if (pathName.includes('/dashboard/fleet-capacity')) return rawJson({ availableKwh: 348.5, connectedVehicles: 8 });
    if (pathName.includes('/energy-profile')) return json({ minSocThreshold: 45 });
    
    // Station subroutes
    if (pathName.match(/\/stations\/\d+\/parking-spots/)) return rawJson(mockParkingSpots);
    if (pathName.match(/\/stations\/\d+\/topology/)) return json(mockTopology);
    if (pathName.match(/\/stations\/\d+\/chargers/)) return json(mockChargers.filter(c => c.stationId === 1));
    if (pathName.match(/\/stations\/\d+/)) return json(mockStations[0]);
    if (pathName.endsWith('/stations')) return json(mockStations);

    // Charger subroutes
    if (pathName.match(/\/chargers\/\d+\/logs/)) return json([
      { id: 101, timestamp: new Date(Date.now() - 5000).toISOString(), direction: "in", messageType: "CALL", action: "Heartbeat", message: [2, "hb_101", "Heartbeat", {}] },
      { id: 102, timestamp: new Date(Date.now() - 15000).toISOString(), direction: "in", messageType: "CALL", action: "MeterValues", message: [2, "mv_102", "MeterValues", { connectorId: 1, transactionId: 10842, meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{ value: "32400", context: "Sample.Periodic", measurand: "Energy.Active.Import.Register", unit: "Wh" }, { value: "48500", context: "Sample.Periodic", measurand: "Power.Active.Import", unit: "W" }] }] }] },
      { id: 103, timestamp: new Date(Date.now() - 25000).toISOString(), direction: "in", messageType: "CALL", action: "StatusNotification", message: [2, "sn_103", "StatusNotification", { connectorId: 1, errorCode: "NoError", status: "Charging" }] },
      { id: 104, timestamp: new Date(Date.now() - 60000).toISOString(), direction: "in", messageType: "CALL", action: "BootNotification", message: [2, "bn_104", "BootNotification", { chargePointVendor: "Alfen ICU B.V.", chargePointModel: "Eve Double Pro", firmwareVersion: "5.18.2" }] }
    ]);
    if (pathName.match(/\/chargers\/\d+\/configurations/)) return rawJson([
      { key: "HeartbeatInterval", value: "60", readonly: false },
      { key: "MeterValueSampleInterval", value: "30", readonly: false },
      { key: "ConnectionTimeOut", value: "120", readonly: false },
      { key: "WebSocketPingInterval", value: "45", readonly: false },
      { key: "AuthorizeRemoteTxRequests", value: "true", readonly: false },
      { key: "LocalAuthorizeOffline", value: "true", readonly: true }
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
    if (pathName.endsWith('/chargers')) return json(mockChargers);

    if (pathName.includes('/connectors')) return json(mockConnectors);
    if (pathName.includes('/charge-groups') || pathName.includes('/chargeGroups')) return json(mockChargeGroups);
    if (pathName.includes('/vehicles')) return rawJson(mockVehicles);
    if (pathName.match(/\/rfid\/\d+/)) return json(mockRfidTagDetail);
    if (pathName.includes('/rfid')) return rawJson(mockRfidTags);
    if (pathName.includes('/reservations')) return json(mockReservations);
    if (pathName.includes('/transactions/active')) return json(mockTransactions.filter(t => t.status === "Active"));
    if (pathName.match(/\/transactions\/\d+/)) return json(mockTransactions[0]);
    if (pathName.includes('/transactions')) return json(mockTransactions);
    
    if (pathName.match(/\/invoices\/\d+/)) return json(mockInvoicesList[0]);
    if (pathName.includes('/invoices')) return rawJson(mockInvoicesResponse);
    if (pathName.includes('/sepa/mandates') || pathName.includes('/mandates')) return json([
      { id: 1, debtorName: "Pulse Fleet Services B.V.", customerName: "Pulse Fleet Services B.V.", iban: "NL91ABNA0417164300", bic: "ABNANL2A", mandateReference: "MAND-2024-0019", scheme: "CORE", status: "Active", signedDate: "2024-01-15" },
      { id: 2, debtorName: "Green Mobility Logistics N.V.", customerName: "Green Mobility Logistics N.V.", iban: "BE68539007547034", bic: "GEBABEBB", mandateReference: "MAND-2024-0024", scheme: "B2B", status: "Active", signedDate: "2024-03-20" }
    ]);
    if (pathName.includes('/reimbursements/contracts')) return json(mockReimbursementContracts);
    if (pathName.includes('/reimbursements/ledgers')) return json(mockReimbursementLedgers);
    if (pathName.match(/\/tariffs\/\d+/)) return json(mockTariffs[0]);
    if (pathName.includes('/tariffs')) return json(mockTariffs);

    if (pathName.includes('/roles')) return json(mockRoles);
    if (pathName.includes('/companies')) return json({ companies: mockCompanies, total: mockCompanies.length });
    if (pathName.match(/\/users\/\d+/)) return json(mockUsers[0]);
    if (pathName.includes('/users')) return rawJson(mockUsers);

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
    if (pathName.includes('/mail/templates')) return rawJson(mockMailTemplates);
    if (pathName.includes('/settings/mail')) return rawJson({ fromAddress: "noreply@mobilitypulse.com", host: "smtp.sendgrid.net", port: 587, isActive: true });
    if (pathName.includes('/settings/tariffs/entsoe-key')) return json({ hasKey: true, key: "99a818e-44b2-4819-a1b2-entsoe-live-token" });
    if (pathName.includes('/media-campaigns')) return json([
      { id: 1, name: "Summer Clean Energy Promo", displayDuration: 30, targetModels: "Alfen,Raedian,Kempower", assetUrl: "/campaigns/summer-promo.mp4", active: true, createdAt: "2026-08-01T00:00:00Z" }
    ]);
    if (pathName.includes('/settings/payments/stripe')) return json({ hasSecretKey: true, publishableKey: "pk_live_51M0cpms82810283492817263548", hasWebhookSecret: true, testMode: false });
    if (pathName.includes('/settings/payments/mollie')) return json({ hasApiKey: true, profileId: "pfl_99281a", testMode: false });
    if (pathName.includes('/settings/payments')) return json({ isConfigured: true, apiKey: "live_mollie_live_998182747192", profileId: "pfl_99281a" });
    if (pathName.includes('/audit')) return json({ logs: mockAuditLogs, total: mockAuditLogs.length });
    if (pathName.includes('/security/ca')) return json(mockCaInfo);
    if (pathName.includes('/security/certificates')) return json(mockCertificates);
    if (pathName.includes('/roaming') || pathName.includes('/ocpi') || pathName.includes('/oicp')) return json({
      stats: { totalPartners: 4, connectedHubs: 2, roamingSessionsToday: 14, roamingRevenueToday: 89.40 },
      endpoints: [
        { id: 1, name: "Hubject Intercharge OICP 2.3", role: "CPO", status: "Connected", partnerName: "Hubject GmbH", url: "https://service.hubject.com/oicp/v2.3", lastSync: new Date().toISOString() },
        { id: 2, name: "e-clearing.net OCPI 2.2.1", role: "CPO", status: "Connected", partnerName: "Smartlab Innovationsgesellschaft mbH", url: "https://ocpi.e-clearing.net/2.2.1", lastSync: new Date().toISOString() }
      ]
    });

    return json({ message: "Mock API success" });
  });
}

async function injectAuth(page) {
  await page.addInitScript((userData) => {
    window.localStorage.setItem('token', 'mock-jwt-superadmin-token-2026');
    window.localStorage.setItem('user', JSON.stringify(userData));
  }, mockUser);
}

async function safeGoto(page, url, delay = 1000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.warn(`[WARN] Navigation issue on ${url}: ${e.message}, retrying...`);
    await page.waitForTimeout(1000);
    await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  }
  await page.waitForTimeout(delay);
}

async function takeShot(page, filename, options = {}) {
  const rootPath = path.join(SCREENSHOTS_DIR, filename);
  const frontendPath = path.join(FRONTEND_SCREENSHOTS_DIR, filename);
  
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return !text.includes('Loading tag details...') && !text.includes('Loading invoices...') && !text.includes('Loading form...') && !text.includes('Loading charger details...') && !text.includes('Loading users...');
    }, { timeout: 2500 });
  } catch (e) {}

  await page.waitForTimeout(options.delay || 600);
  await page.screenshot({ path: rootPath, fullPage: options.fullPage !== false });
  fs.copyFileSync(rootPath, frontendPath);
  console.log(`[SAVED] ${filename}`);
}

async function clickTabSafe(page, selectorOrText) {
  try {
    const el = page.locator(selectorOrText).first();
    if (await el.isVisible({ timeout: 2500 })) {
      await el.click({ timeout: 2500 });
      await page.waitForTimeout(600);
      return true;
    }
  } catch (e) {}
  return false;
}

async function run() {
  console.log('🚀 Launching automated Playwright suite to capture full CPMS screenshot suite...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb']
  });

  const baseUrl = 'http://localhost:3002';

  // Desktop context
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const desktopPage = await desktopContext.newPage();
  desktopPage.setDefaultTimeout(60000);
  desktopPage.setDefaultNavigationTimeout(60000);

  await setupApiMocks(desktopPage);
  await injectAuth(desktopPage);

  // 1. Authentication & Onboarding
  console.log('--- 1. Authentication & Onboarding ---');
  const authContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const authPage = await authContext.newPage();
  authPage.setDefaultTimeout(60000);
  authPage.setDefaultNavigationTimeout(60000);
  await setupApiMocks(authPage);

  await safeGoto(authPage, `${baseUrl}/login`, 1000);
  await takeShot(authPage, '01_Auth_Login.png');

  await safeGoto(authPage, `${baseUrl}/register`, 1000);
  await takeShot(authPage, '02_Auth_Register.png');

  await safeGoto(authPage, `${baseUrl}/forgot-password`, 1000);
  await takeShot(authPage, '03_Auth_ForgotPassword.png');

  await safeGoto(authPage, `${baseUrl}/reset-password?token=mock-password-reset-token`, 1000);
  await takeShot(authPage, '04_Auth_ResetPassword.png');

  await safeGoto(authPage, `${baseUrl}/verify-email?token=mock-email-verification-token`, 1000);
  await takeShot(authPage, '05_Auth_VerifyEmail.png');

  await authContext.close();

  // 2. Executive Dashboard
  console.log('--- 2. Dashboard ---');
  await safeGoto(desktopPage, `${baseUrl}/dashboard`, 1500);
  await takeShot(desktopPage, '06_Dashboard_Executive_Overview.png');

  // 3. Chargers Fleet Management
  console.log('--- 3. Chargers ---');
  await safeGoto(desktopPage, `${baseUrl}/chargers`, 1200);
  await takeShot(desktopPage, '07_Chargers_Fleet_Directory.png');

  await safeGoto(desktopPage, `${baseUrl}/chargers/new`, 1200);
  await takeShot(desktopPage, '08_Chargers_Register_New.png');

  await safeGoto(desktopPage, `${baseUrl}/chargers/unrecognized`, 1200);
  await takeShot(desktopPage, '09_Chargers_Unrecognized_Queue.png');

  // Charger detail & all interactive tabs
  await safeGoto(desktopPage, `${baseUrl}/chargers/1`, 1200);
  await takeShot(desktopPage, '10_Charger_Detail_Overview_Tab.png');

  if (await clickTabSafe(desktopPage, 'button[value="connectors"], button:has-text("Connectors")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '11_Charger_Detail_Connectors_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="transactions"], button:has-text("Transactions")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '12_Charger_Detail_Transactions_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="configuration"], button:has-text("Configuration Parameters"), button:has-text("Configuration")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '13_Charger_Detail_Configuration_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="profiles"], button:has-text("Configuration Profiles"), button:has-text("Profiles")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '14_Charger_Detail_Profiles_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="predictive"], button:has-text("Predictive Load"), button:has-text("Predictive")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '15_Charger_Detail_PredictiveLoad_Tab.png');
  }

  await safeGoto(desktopPage, `${baseUrl}/chargers/1/edit`, 1200);
  await takeShot(desktopPage, '16_Charger_Edit_Form.png');

  // 4. Stations & Ground Plan
  console.log('--- 4. Stations & Ground Plan ---');
  await safeGoto(desktopPage, `${baseUrl}/stations`, 1200);
  await takeShot(desktopPage, '17_Stations_Directory_Map.png');

  await safeGoto(desktopPage, `${baseUrl}/stations/new`, 1200);
  await takeShot(desktopPage, '18_Stations_Create_New.png');

  await safeGoto(desktopPage, `${baseUrl}/stations/1`, 1200);
  await takeShot(desktopPage, '19_Station_Detail_View.png');

  await safeGoto(desktopPage, `${baseUrl}/stations/1/edit`, 1200);
  await takeShot(desktopPage, '20_Station_Edit_Form.png');

  await safeGoto(desktopPage, `${baseUrl}/stations/1/ground-plan`, 1500);
  await takeShot(desktopPage, '21_Station_GroundPlan_2D_Builder.png');

  await safeGoto(desktopPage, `${baseUrl}/stations/1/live`, 1500);
  await takeShot(desktopPage, '22_Station_Live_FloorPlan_Monitor.png');

  // Copy ground plan screenshots to Manual directory
  fs.copyFileSync(path.join(SCREENSHOTS_DIR, '21_Station_GroundPlan_2D_Builder.png'), path.join(MANUAL_DIR, 'ground_plan_builder.png'));
  fs.copyFileSync(path.join(SCREENSHOTS_DIR, '22_Station_Live_FloorPlan_Monitor.png'), path.join(MANUAL_DIR, 'ground_plan_live_view.png'));

  // 5. Connectors
  console.log('--- 5. Connectors ---');
  await safeGoto(desktopPage, `${baseUrl}/connectors`, 1200);
  await takeShot(desktopPage, '23_Connectors_Directory.png');

  await safeGoto(desktopPage, `${baseUrl}/connectors/new`, 1200);
  await takeShot(desktopPage, '24_Connectors_Create_New.png');

  await safeGoto(desktopPage, `${baseUrl}/connectors/1/edit`, 1200);
  await takeShot(desktopPage, '25_Connector_Edit_Form.png');

  // 6. Charge Groups
  console.log('--- 6. Charge Groups ---');
  await safeGoto(desktopPage, `${baseUrl}/charge-groups`, 1200);
  await takeShot(desktopPage, '26_ChargeGroups_DynamicLoadBalancing.png');

  await safeGoto(desktopPage, `${baseUrl}/charge-groups/create`, 1200);
  await takeShot(desktopPage, '27_ChargeGroups_Create_New.png');

  await safeGoto(desktopPage, `${baseUrl}/charge-groups/1/edit`, 1200);
  await takeShot(desktopPage, '28_ChargeGroup_Edit_Form.png');

  // 7. V2G Smart Grid Orchestration
  console.log('--- 7. V2G Smart Grid ---');
  await safeGoto(desktopPage, `${baseUrl}/v2g`, 1200);
  await takeShot(desktopPage, '29_V2G_Battery_Orchestration.png');

  // 8. RFID & Vehicle Identity Management
  console.log('--- 8. RFID & Vehicle Identity ---');
  await safeGoto(desktopPage, `${baseUrl}/rfid`, 1200);
  await takeShot(desktopPage, '30_RFID_Whitelist_Directory.png');

  await safeGoto(desktopPage, `${baseUrl}/rfid/new`, 1200);
  await takeShot(desktopPage, '31_RFID_Register_New.png');

  await safeGoto(desktopPage, `${baseUrl}/rfid/1`, 1200);
  await takeShot(desktopPage, '32_RFID_Tag_Detail.png');

  await safeGoto(desktopPage, `${baseUrl}/rfid/1/edit`, 1200);
  await takeShot(desktopPage, '33_RFID_Edit_Form.png');

  await safeGoto(desktopPage, `${baseUrl}/vehicle-identity-management`, 1200);
  await takeShot(desktopPage, '34_VehicleIdentity_PlugAndCharge.png');

  // 9. Reservations Manager
  console.log('--- 9. Reservations ---');
  await safeGoto(desktopPage, `${baseUrl}/reservations`, 1200);
  await takeShot(desktopPage, '35_Reservations_Manager.png');

  // 10. Transactions & Invoices
  console.log('--- 10. Transactions & Invoices ---');
  await safeGoto(desktopPage, `${baseUrl}/transactions`, 1000);
  await takeShot(desktopPage, '36_Transactions_History_Records.png');

  await safeGoto(desktopPage, `${baseUrl}/transactions/active`, 1000);
  await takeShot(desktopPage, '37_Transactions_Live_Active_Sessions.png');

  await safeGoto(desktopPage, `${baseUrl}/transactions/1`, 1000);
  await takeShot(desktopPage, '38_Transaction_Detail_Receipt.png');

  await safeGoto(desktopPage, `${baseUrl}/invoices`, 1200);
  await takeShot(desktopPage, '39_Invoices_Billing_Ledger.png');

  // Invoices Detail Modal
  if (await clickTabSafe(desktopPage, 'button.hover\\:underline, table tbody tr td:first-child button, button:has(svg.lucide-file-text)')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '40_Invoices_Detail_Modal.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(300);
  }

  // Generate Invoices Dialog
  if (await clickTabSafe(desktopPage, 'button:has-text("Generate Invoices"), button:has-text("Facturen Genereren")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '41_Invoices_Generate_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(300);
  }

  // SEPA Mandates Dialog
  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Mandates"), button:has-text("SEPA Mandaten")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '42_Invoices_SEPA_Mandates_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(300);
  }

  // SEPA Direct Debit Export Dialog
  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Direct Debit"), button:has-text("SEPA Incasso")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '43_Invoices_DirectDebit_Export_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(300);
  }

  // Reimbursements
  await safeGoto(desktopPage, `${baseUrl}/reimbursements`, 1000);
  await takeShot(desktopPage, '44_Reimbursements_HomeCharging_SEPA.png');

  // 11. Tariffs & Roaming
  console.log('--- 11. Tariffs & Roaming ---');
  await safeGoto(desktopPage, `${baseUrl}/tariffs`, 1000);
  await takeShot(desktopPage, '45_Tariffs_Pricing_Structures.png');

  await safeGoto(desktopPage, `${baseUrl}/tariffs/new`, 1000);
  await takeShot(desktopPage, '46_Tariffs_Create_New.png');

  await safeGoto(desktopPage, `${baseUrl}/tariffs/1/edit`, 1000);
  await takeShot(desktopPage, '47_Tariff_Edit_Form.png');

  await safeGoto(desktopPage, `${baseUrl}/roaming`, 1000);
  await takeShot(desktopPage, '48_Roaming_OCPI_Hubs.png');

  if (await clickTabSafe(desktopPage, 'button[value="oicp"], button:has-text("OICP")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '49_Roaming_OICP_Hubject_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="settlement"], button:has-text("Settlement")')) {
    await desktopPage.waitForTimeout(500);
    await takeShot(desktopPage, '50_Roaming_Settlement_Visualizer_Tab.png');
  }

  // 12. Users, Corporate Clients & RBAC Hub
  console.log('--- 12. Users, Corporate Clients & Roles Matrix ---');
  await safeGoto(desktopPage, `${baseUrl}/users`, 1200);
  await takeShot(desktopPage, '51_Users_Accounts_Directory.png');

  if (await clickTabSafe(desktopPage, 'button[value="clients"], button:has-text("Clients")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '51a_Corporate_Clients_Directory.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="roles"], button:has-text("Roles & Permissions")')) {
    await desktopPage.waitForTimeout(600);
    await takeShot(desktopPage, '51b_Roles_Permissions_Matrix.png');
  }

  await safeGoto(desktopPage, `${baseUrl}/users/create`, 1200);
  await takeShot(desktopPage, '52_Users_Create_New.png');

  await safeGoto(desktopPage, `${baseUrl}/users/1/edit`, 1200);
  await takeShot(desktopPage, '53_Users_Edit_Form.png');

  // 13. Reliability, Auto-Heal & OCPP Packet Inspector
  console.log('--- 13. Operations & Protocol ---');
  await safeGoto(desktopPage, `${baseUrl}/hardware-at-risk`, 1200);
  await takeShot(desktopPage, '54_HardwareAtRisk_AutoHeal.png');

  await safeGoto(desktopPage, `${baseUrl}/ocpp`, 1200);
  await takeShot(desktopPage, '55_OCPP_PacketInspector_Console.png');

  await safeGoto(desktopPage, `${baseUrl}/config-profiles`, 1200);
  await takeShot(desktopPage, '58_ConfigProfiles_Templates.png');

  await safeGoto(desktopPage, `${baseUrl}/quirk-profiles`, 1200);
  await takeShot(desktopPage, '59_QuirkProfiles_HardwareOverrides.png');

  // 14. Ad-hoc Public Payments Checkout
  console.log('--- 14. Public Checkout ---');
  await safeGoto(desktopPage, `${baseUrl}/payments?session=TXN-TEST-9981`, 1200);
  await takeShot(desktopPage, '60_Public_Payments_Checkout.png');

  // 15. Settings & Subsystems
  console.log('--- 15. Settings & Subsystems ---');
  await safeGoto(desktopPage, `${baseUrl}/settings`, 1200);
  await takeShot(desktopPage, '61_Settings_Account_Security.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/security`, 1200);
  await takeShot(desktopPage, '63_Settings_Security_Profiles_PKI.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/audit`, 1200);
  await takeShot(desktopPage, '64_Settings_Enterprise_Audit_Trail.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/tariffs`, 1200);
  await takeShot(desktopPage, '65_Settings_DynamicTariffs_EPEX.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/templates`, 1200);
  await takeShot(desktopPage, '66_Settings_MailTemplates_Editor.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/mail`, 1200);
  await takeShot(desktopPage, '67_Settings_SMTP_Server.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/ad-manager`, 1200);
  await takeShot(desktopPage, '68_Settings_Screen_AdManager.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/hardware-at-risk`, 1200);
  await takeShot(desktopPage, '69_Settings_HardwareAtRisk_Rules.png');

  await safeGoto(desktopPage, `${baseUrl}/settings/payments`, 1200);
  await takeShot(desktopPage, '70_Settings_MolliePayments_Gateway.png');

  await desktopContext.close();

  // 16. Mobile Driver Companion (Mobile Viewport 390x844)
  console.log('--- 16. Mobile Driver Companion Views ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });

  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(60000);
  mobilePage.setDefaultNavigationTimeout(60000);

  await setupApiMocks(mobilePage);
  await injectAuth(mobilePage);

  await safeGoto(mobilePage, `${baseUrl}/mobile/dashboard`, 1200);
  await takeShot(mobilePage, '71_Mobile_Dashboard.png');

  await safeGoto(mobilePage, `${baseUrl}/mobile/chargers`, 1000);
  await takeShot(mobilePage, '72_Mobile_Chargers_Fleet.png');

  await safeGoto(mobilePage, `${baseUrl}/mobile/chargers/1`, 1200);
  await takeShot(mobilePage, '73_Mobile_Charger_Detail_Controller.png');

  await safeGoto(mobilePage, `${baseUrl}/mobile/map`, 1500);
  await takeShot(mobilePage, '74_Mobile_Station_Map.png');

  await safeGoto(mobilePage, `${baseUrl}/mobile/settings`, 1000);
  await takeShot(mobilePage, '75_Mobile_Driver_Settings.png');

  await mobileContext.close();
  await browser.close();

  // Copy manual ground plan assets
  const gpBuilderSrc = path.join(SCREENSHOTS_DIR, '21_Station_GroundPlan_2D_Builder.png');
  const gpLiveSrc = path.join(SCREENSHOTS_DIR, '22_Station_Live_FloorPlan_Monitor.png');
  if (fs.existsSync(gpBuilderSrc)) {
    fs.copyFileSync(gpBuilderSrc, path.join(MANUAL_DIR, 'ground_plan_builder.png'));
  }
  if (fs.existsSync(gpLiveSrc)) {
    fs.copyFileSync(gpLiveSrc, path.join(MANUAL_DIR, 'ground_plan_live_view.png'));
  }

  console.log(`\n🎉 Complete! All screenshots captured directly in: ${SCREENSHOTS_DIR} and ${FRONTEND_SCREENSHOTS_DIR}`);
}

run().catch(err => {
  console.error('Error during screenshot execution:', err);
  process.exit(1);
});
