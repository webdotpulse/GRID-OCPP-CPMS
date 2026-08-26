import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Primary root Screenshots directory
const SCREENSHOTS_DIR = path.resolve('/home/koen/Git/OCPP-CPMS/Screenshots');

// Ensure clean directory
if (fs.existsSync(SCREENSHOTS_DIR)) {
  const files = fs.readdirSync(SCREENSHOTS_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(SCREENSHOTS_DIR, file));
  }
} else {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Unified, complete mock dataset
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

const mockRfidTagDetail = {
  id: 1,
  rfid_tag: "E200001928390012",
  external_id: "CARD-8839-NL",
  name: "Super Administrator",
  email: "admin@webdotpulse.eu",
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
    userEmail: "admin@webdotpulse.eu",
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
    customerName: "Pulse Fleet Services B.V.",
    customerEmail: "billing@pulsefleet.eu",
    companyName: "Pulse Fleet Services B.V.",
    status: "paid",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    subtotal: 1240.50,
    tax: 260.51,
    total: 1501.01,
    currency: "EUR",
    chargingSessionsCount: 48,
    kwhTotal: 3340.2,
    items: [
      { description: "August 2026 High-Power Charging Energy (3,340.2 kWh)", quantity: 3340.2, unitPrice: 0.35, total: 1169.07 },
      { description: "Monthly Corporate EVSE Fleet Connection Fee", quantity: 1, unitPrice: 71.43, total: 71.43 }
    ]
  },
  {
    id: 2,
    invoiceNumber: "INV-2026-0043",
    customerName: "Green Mobility Logistics N.V.",
    customerEmail: "accounts@greenmobility.be",
    companyName: "Green Mobility Logistics N.V.",
    status: "pending",
    issueDate: "2026-08-15",
    dueDate: "2026-08-29",
    subtotal: 840.00,
    tax: 176.40,
    total: 1016.40,
    currency: "EUR",
    chargingSessionsCount: 31,
    kwhTotal: 2250.0,
    items: [
      { description: "August 2026 Commercial Fleet Sessions (2,250 kWh)", quantity: 2250.0, unitPrice: 0.36, total: 810.00 },
      { description: "Direct Roaming Surcharge", quantity: 1, unitPrice: 30.00, total: 30.00 }
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
  {
    id: 1,
    name: "Super Administrator",
    email: "admin@webdotpulse.eu",
    role: "superadmin",
    userType: "company",
    companyName: "Pulse Charge Network B.V.",
    status: "Active",
    createdAt: "2024-01-15T08:00:00Z"
  },
  {
    id: 2,
    name: "Dr. Willem Janssen",
    email: "w.janssen@leaseplan.nl",
    role: "admin",
    userType: "company",
    companyName: "LeasePlan Corporate Fleet",
    status: "Active",
    createdAt: "2024-03-01T10:30:00Z"
  },
  {
    id: 3,
    name: "Sophie Dupont",
    email: "s.dupont@engie.be",
    role: "user",
    userType: "employee",
    companyName: "Engie Mobility",
    status: "Active",
    createdAt: "2024-05-12T16:00:00Z"
  }
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
    if (pathName.includes('/auth/2fa/generate')) return json({ secret: 'JBSWY3DPEHPK3PXP', qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/OCPP-CPMS:superadmin@webdotpulse.eu?secret=JBSWY3DPEHPK3PXP' });
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
    if (pathName.includes('/settings/mail')) return rawJson({ fromAddress: "noreply@webdotpulse.eu", host: "smtp.sendgrid.net", port: 587, isActive: true });
    if (pathName.includes('/settings/tariffs/entsoe-key')) return json({ hasKey: true, key: "99a818e-44b2-4819-a1b2-entsoe-live-token" });
    if (pathName.includes('/media-campaigns')) return json([
      { id: 1, name: "Summer Clean Energy Promo", displayDuration: 30, targetModels: "Alfen,Raedian,Kempower", assetUrl: "/campaigns/summer-promo.mp4", active: true, createdAt: "2026-08-01T00:00:00Z" }
    ]);
    if (pathName.includes('/settings/payments')) return json({ isConfigured: true, apiKey: "live_mollie_live_998182747192", profileId: "pfl_99281a" });
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

async function takeShot(page, filename, options = {}) {
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return !text.includes('Loading tag details...') && !text.includes('Loading invoices...') && !text.includes('Loading form...') && !text.includes('Loading charger details...');
    }, { timeout: 3000 });
  } catch (e) {}

  await page.waitForTimeout(options.delay || 700);
  await page.screenshot({ path: filePath, fullPage: options.fullPage !== false });
  console.log(`[SAVED] ${filename}`);
}

async function clickTabSafe(page, selector) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      return true;
    }
  } catch (e) {}
  return false;
}

async function run() {
  console.log('🚀 Launching automated Playwright suite to capture full CPMS screenshot suite...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const baseUrl = 'http://localhost:3002';

  // Desktop context
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const desktopPage = await desktopContext.newPage();
  await setupApiMocks(desktopPage);
  await injectAuth(desktopPage);

  // 1. Authentication & Onboarding
  console.log('--- 1. Authentication & Onboarding ---');
  const authContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const authPage = await authContext.newPage();
  await setupApiMocks(authPage);

  await authPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await takeShot(authPage, '01_Auth_Login.png');

  await authPage.goto(`${baseUrl}/register`, { waitUntil: 'networkidle' });
  await takeShot(authPage, '02_Auth_Register.png');

  await authPage.goto(`${baseUrl}/forgot-password`, { waitUntil: 'networkidle' });
  await takeShot(authPage, '03_Auth_ForgotPassword.png');

  await authPage.goto(`${baseUrl}/reset-password?token=mock-password-reset-token`, { waitUntil: 'networkidle' });
  await takeShot(authPage, '04_Auth_ResetPassword.png');

  await authPage.goto(`${baseUrl}/verify-email?token=mock-email-verification-token`, { waitUntil: 'networkidle' });
  await takeShot(authPage, '05_Auth_VerifyEmail.png');

  await authContext.close();

  // 2. Executive Dashboard
  console.log('--- 2. Dashboard ---');
  await desktopPage.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '06_Dashboard_Executive_Overview.png');

  // 3. Chargers Fleet Management
  console.log('--- 3. Chargers ---');
  await desktopPage.goto(`${baseUrl}/chargers`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '07_Chargers_Fleet_Directory.png');

  await desktopPage.goto(`${baseUrl}/chargers/new`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '08_Chargers_Register_New.png');

  await desktopPage.goto(`${baseUrl}/chargers/unrecognized`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '09_Chargers_Unrecognized_Queue.png');

  // Charger detail & all interactive tabs
  await desktopPage.goto(`${baseUrl}/chargers/1`, { waitUntil: 'networkidle' });
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

  await desktopPage.goto(`${baseUrl}/chargers/1/edit`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '16_Charger_Edit_Form.png');

  // 4. Stations & Ground Plan
  console.log('--- 4. Stations & Ground Plan ---');
  await desktopPage.goto(`${baseUrl}/stations`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '17_Stations_Directory_Map.png');

  await desktopPage.goto(`${baseUrl}/stations/new`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '18_Stations_Create_New.png');

  await desktopPage.goto(`${baseUrl}/stations/1`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '19_Station_Detail_View.png');

  await desktopPage.goto(`${baseUrl}/stations/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '20_Station_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/stations/1/ground-plan`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1200);
  await takeShot(desktopPage, '21_Station_GroundPlan_2D_Builder.png');

  await desktopPage.goto(`${baseUrl}/stations/1/live`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1200);
  await takeShot(desktopPage, '22_Station_Live_FloorPlan_Monitor.png');

  // 5. Connectors
  console.log('--- 5. Connectors ---');
  await desktopPage.goto(`${baseUrl}/connectors`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '23_Connectors_Directory.png');

  await desktopPage.goto(`${baseUrl}/connectors/new`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '24_Connectors_Create_New.png');

  await desktopPage.goto(`${baseUrl}/connectors/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '25_Connector_Edit_Form.png');

  // 6. Charge Groups
  console.log('--- 6. Charge Groups ---');
  await desktopPage.goto(`${baseUrl}/charge-groups`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '26_ChargeGroups_DynamicLoadBalancing.png');

  await desktopPage.goto(`${baseUrl}/charge-groups/create`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '27_ChargeGroups_Create_New.png');

  await desktopPage.goto(`${baseUrl}/charge-groups/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '28_ChargeGroup_Edit_Form.png');

  // 7. V2G Smart Grid Orchestration
  console.log('--- 7. V2G Smart Grid ---');
  await desktopPage.goto(`${baseUrl}/v2g`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '29_V2G_Battery_Orchestration.png');

  // 8. RFID & Vehicle Identity Management
  console.log('--- 8. RFID & Vehicle Identity ---');
  await desktopPage.goto(`${baseUrl}/rfid`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '30_RFID_Whitelist_Directory.png');

  await desktopPage.goto(`${baseUrl}/rfid/new`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '31_RFID_Register_New.png');

  await desktopPage.goto(`${baseUrl}/rfid/1`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '32_RFID_Tag_Detail.png');

  await desktopPage.goto(`${baseUrl}/rfid/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '33_RFID_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/vehicle-identity-management`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '34_VehicleIdentity_PlugAndCharge.png');

  // 9. Transactions & Invoices
  console.log('--- 9. Transactions & Invoices ---');
  await desktopPage.goto(`${baseUrl}/transactions`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '35_Transactions_History_Records.png');

  await desktopPage.goto(`${baseUrl}/transactions/active`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '36_Transactions_Live_Active_Sessions.png');

  await desktopPage.goto(`${baseUrl}/transactions/1`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '37_Transaction_Detail_Receipt.png');

  await desktopPage.goto(`${baseUrl}/invoices`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '38_Invoices_Billing_Ledger.png');

  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Mandates")')) {
    await takeShot(desktopPage, '39_Invoices_SEPA_Mandates_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  if (await clickTabSafe(desktopPage, 'button:has-text("SEPA Direct Debit")')) {
    await takeShot(desktopPage, '40_Invoices_DirectDebit_Export_Dialog.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  await desktopPage.goto(`${baseUrl}/reimbursements`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '41_Reimbursements_HomeCharging_SEPA.png');

  // 10. Tariffs & Roaming
  console.log('--- 10. Tariffs & Roaming ---');
  await desktopPage.goto(`${baseUrl}/tariffs`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '42_Tariffs_Pricing_Structures.png');

  await desktopPage.goto(`${baseUrl}/tariffs/new`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '43_Tariffs_Create_New.png');

  await desktopPage.goto(`${baseUrl}/tariffs/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '44_Tariff_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/roaming`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '45_Roaming_OCPI_Hubs.png');

  if (await clickTabSafe(desktopPage, 'button[value="oicp"], button:has-text("OICP")')) {
    await takeShot(desktopPage, '46_Roaming_OICP_Hubject_Tab.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="settlement"], button:has-text("Settlement")')) {
    await takeShot(desktopPage, '47_Roaming_Settlement_Visualizer_Tab.png');
  }

  // 11. Operations & Protocol Inspector
  console.log('--- 11. Operations & Protocol Inspector ---');
  await desktopPage.goto(`${baseUrl}/users`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '48_Users_Accounts_Directory.png');

  await desktopPage.goto(`${baseUrl}/users/create`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '49_Users_Create_New.png');

  await desktopPage.goto(`${baseUrl}/users/1/edit`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '50_Users_Edit_Form.png');

  await desktopPage.goto(`${baseUrl}/hardware-at-risk`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '51_HardwareAtRisk_AutoHeal.png');

  await desktopPage.goto(`${baseUrl}/ocpp`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(800);
  await takeShot(desktopPage, '52_OCPP_PacketInspector_Console.png');

  if (await clickTabSafe(desktopPage, 'button[value="schema"], button:has-text("Schema")')) {
    await takeShot(desktopPage, '53_OCPP_PacketInspector_SchemaReport.png');
  }

  if (await clickTabSafe(desktopPage, 'button[value="raw"], button:has-text("Raw JSON-RPC")')) {
    await takeShot(desktopPage, '54_OCPP_PacketInspector_RawJsonRpc.png');
  }

  await desktopPage.goto(`${baseUrl}/config-profiles`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await takeShot(desktopPage, '55_ConfigProfiles_Templates.png');

  await desktopPage.goto(`${baseUrl}/quirk-profiles`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '56_QuirkProfiles_HardwareOverrides.png');

  // 12. Ad-hoc Public Payments
  console.log('--- 12. Public Checkout ---');
  await desktopPage.goto(`${baseUrl}/payments?session=TXN-TEST-9981`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '57_Public_Payments_Checkout.png');

  // 13. Settings & Subsystems
  console.log('--- 13. Settings & Subsystems ---');
  await desktopPage.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '58_Settings_Account_Security.png');

  if (await clickTabSafe(desktopPage, 'button:has-text("Authenticator App")')) {
    await takeShot(desktopPage, '59_Settings_2FA_Authenticator_Setup.png');
  }

  await desktopPage.goto(`${baseUrl}/settings/tariffs`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '60_Settings_DynamicTariffs_EPEX.png');

  await desktopPage.goto(`${baseUrl}/settings/templates`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '61_Settings_MailTemplates_Editor.png');

  await desktopPage.goto(`${baseUrl}/settings/mail`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '62_Settings_SMTP_Server.png');

  await desktopPage.goto(`${baseUrl}/settings/ad-manager`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '63_Settings_Screen_AdManager.png');

  await desktopPage.goto(`${baseUrl}/settings/hardware-at-risk`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '64_Settings_HardwareAtRisk_Rules.png');

  await desktopPage.goto(`${baseUrl}/settings/payments`, { waitUntil: 'networkidle' });
  await takeShot(desktopPage, '65_Settings_MolliePayments_Gateway.png');

  await desktopContext.close();

  // 14. Mobile Driver Companion (Mobile Viewport 390x844)
  console.log('--- 14. Mobile Driver Companion Views ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });

  const mobilePage = await mobileContext.newPage();
  await setupApiMocks(mobilePage);
  await injectAuth(mobilePage);

  await mobilePage.goto(`${baseUrl}/mobile/dashboard`, { waitUntil: 'networkidle' });
  await takeShot(mobilePage, '66_Mobile_Dashboard.png');

  await mobilePage.goto(`${baseUrl}/mobile/chargers`, { waitUntil: 'networkidle' });
  await takeShot(mobilePage, '67_Mobile_Chargers_Fleet.png');

  await mobilePage.goto(`${baseUrl}/mobile/chargers/1`, { waitUntil: 'networkidle' });
  await takeShot(mobilePage, '68_Mobile_Charger_Detail_Controller.png');

  await mobilePage.goto(`${baseUrl}/mobile/map`, { waitUntil: 'networkidle' });
  await takeShot(mobilePage, '69_Mobile_Station_Map.png');

  await mobilePage.goto(`${baseUrl}/mobile/settings`, { waitUntil: 'networkidle' });
  await takeShot(mobilePage, '70_Mobile_Driver_Settings.png');

  await mobileContext.close();
  await browser.close();

  console.log(`\n🎉 Complete! All screenshots captured directly in: ${SCREENSHOTS_DIR}`);
}

run().catch(err => {
  console.error('Error during screenshot execution:', err);
  process.exit(1);
});
