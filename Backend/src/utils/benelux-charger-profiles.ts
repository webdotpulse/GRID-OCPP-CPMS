import { prisma } from "../config/database.js";
import { logger } from "./logger.js";

export interface OcppConfigKeyItem {
  key: string;
  value: string;
}

export interface BeneluxProfileDefinition {
  id: string;
  name: string;
  manufacturer: string;
  category: "Benelux Market Leader" | "High-Power DC / HPC" | "Smart & Solar AC" | "Commercial & Fleet" | "Universal / General" | "Security & Telecom";
  models: string[];
  description: string;
  recommendedHardware: string;
  color: string;
  items: OcppConfigKeyItem[];
}

/**
 * Curated and fine-tuned OCPP Configuration Profiles for the most popular EV chargers
 * in the Benelux region (Netherlands, Belgium, Luxembourg) and a Universal Baseline Profile.
 */
export const BENELUX_CHARGER_PROFILES: BeneluxProfileDefinition[] = [
  // 1. UNIVERSAL GENERAL OPTIMIZED PROFILE (ALL OTHER CHARGERS)
  {
    id: "universal-general-optimized",
    name: "Universal General Optimized Profile (All EV Chargers)",
    manufacturer: "Universal / General Baseline",
    category: "Universal / General",
    models: ["All OCPP 1.6-J & 2.0.1 compliant AC / DC Chargers", "Generic Wallbox", "White-label Hardware"],
    description: "Battle-tested, resilient configuration profile designed for any standard OCPP compliant charge point. Enforces 30s telemetry, energy/power/current/voltage/SoC reporting, robust message retries, and safe connector unlocking.",
    recommendedHardware: "Any OCPP 1.6-J or 2.0.1 compliant AC or DC EV charging station without vendor-specific quirks.",
    color: "emerald",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "500" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "MaxChargingProfilesInstalled", value: "10" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 2. ALFEN (NETHERLANDS) - MARKET LEADER AC
  {
    id: "alfen-eve-pro-optimized",
    name: "Alfen Eve Series Optimized (Single / Double / Twin)",
    manufacturer: "Alfen",
    category: "Benelux Market Leader",
    models: ["Eve Single Pro-line", "Eve Single S-line", "Eve Double Pro-line", "Eve Double PG-line", "Twin 4XL", "Twin 5 Plus"],
    description: "Tuned specifically for Alfen firmware (v4.x - v6.x). Provides 15s high-resolution telemetry, phase rotation alignment for smart charging, remote authorization, and local RFID whitelist management without memory congestion.",
    recommendedHardware: "Alfen Eve Single / Double / Twin AC charging stations (3.7kW - 22kW dual-socket).",
    color: "blue",
    items: [
      { key: "MeterValueSampleInterval", value: "15" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Current.Offered,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalPreAuthorize", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "1000" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ConnectorPhaseRotation", value: "1.RST,2.RST" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "ChargingScheduleMaxPeriods", value: "24" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 3. EVBOX (NETHERLANDS) - COMMERCIAL & RESIDENTIAL
  {
    id: "evbox-commercial-optimized",
    name: "EVBox Smart AC & DC (Elvi / BusinessLine / Troniq)",
    manufacturer: "EVBox",
    category: "Benelux Market Leader",
    models: ["EVBox Elvi", "EVBox BusinessLine (B3322 / G4)", "EVBox Livo / Liviqo", "EVBox Troniq Modular 120-240kW"],
    description: "Configured to prevent buffer overflow issues on EVBox controllers while ensuring accurate energy tracking, robust reconnect routines, and proper EV-side disconnection handling.",
    recommendedHardware: "EVBox Elvi, BusinessLine, Livo, and Troniq series chargers.",
    color: "cyan",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "250" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "45" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "3" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current" },
    ],
  },

  // 4. KEMPOWER (FASTNED / ALLEGO / DC BENELUX HIGHWAY LEADER)
  {
    id: "kempower-dc-satellite-optimized",
    name: "Kempower Dynamic Satellite & Power Unit (DC HPC)",
    manufacturer: "Kempower",
    category: "High-Power DC / HPC",
    models: ["Kempower C-Satellite", "Kempower T-Satellite", "Kempower Power Unit 50-600kW", "Kempower Movable Charger"],
    description: "Engineered for high-power DC fast charging with dynamic power routing. Features 10s SoC and battery temperature telemetry, offered power tracking, strict cable retention until transaction finalization, and multi-profile smart charging.",
    recommendedHardware: "Kempower C/T-Series Satellites and multi-channel modular Power Units (CCS2 / CHAdeMO).",
    color: "amber",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered,Current.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "300" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "60" },
      { key: "WebSocketPingInterval", value: "30" },
      { key: "TransactionMessageAttempts", value: "4" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "10" },
      { key: "MaxChargingProfilesInstalled", value: "20" },
      { key: "ChargingScheduleMaxPeriods", value: "48" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Power,Current" },
    ],
  },

  // 5. ABB E-MOBILITY - TERRA AC WALLBOX
  {
    id: "abb-terra-ac-optimized",
    name: "ABB Terra AC Wallbox Series",
    manufacturer: "ABB",
    category: "Commercial & Fleet",
    models: ["ABB Terra AC W22-T-RD-MC-0", "ABB Terra AC W11-G5-R-0", "ABB Terra AC W7-T-R-0"],
    description: "Optimized for ABB Terra AC destination and workplace chargers. Provides 20s telemetry, smooth remote start execution, dynamic smart charging limit support, and automatic plug unlocking upon completion.",
    recommendedHardware: "ABB Terra AC Wallbox series (7.4kW, 11kW, 22kW with RFID / 4G / Ethernet).",
    color: "red",
    items: [
      { key: "MeterValueSampleInterval", value: "20" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "500" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "90" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "4" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 6. ABB E-MOBILITY - TERRA DC FAST CHARGER & HPC
  {
    id: "abb-terra-dc-fast-optimized",
    name: "ABB Terra DC Fast Charger & HPC (54 / 94 / 184 / 360)",
    manufacturer: "ABB",
    category: "High-Power DC / HPC",
    models: ["ABB Terra 54", "ABB Terra 94", "ABB Terra 124", "ABB Terra 184", "ABB Terra 360 HPC"],
    description: "Configured for ABB high-power DC charging stations widely installed across Benelux highways. Captures 10s SoC and temperature curves, ensures safety disconnects, and manages dual-connector dynamic load splitting.",
    recommendedHardware: "ABB Terra 54kW to 360kW High-Power DC chargers.",
    color: "rose",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "300" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "60" },
      { key: "WebSocketPingInterval", value: "30" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "6" },
      { key: "MaxChargingProfilesInstalled", value: "15" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Power,Current" },
    ],
  },

  // 7. EASEE (DYNAMIC BALANCING & 1/3 PHASE SWITCHING)
  {
    id: "easee-charge-optimized",
    name: "Easee Charge & Core (Dynamic 1-3 Phase Load Sharing)",
    manufacturer: "Easee",
    category: "Smart & Solar AC",
    models: ["Easee Charge", "Easee One", "Easee Charge Lite", "Easee Charge Core", "Easee Equalizer Hub"],
    description: "Fine-tuned for Easee virtual EVSE architecture. Supports dynamic single-to-three phase switching, rapid current limit adjustments for solar surplus, and reliable cloud-bridge OCPP message forwarding.",
    recommendedHardware: "Easee Charge, One, and Lite compact AC charging robots.",
    color: "indigo",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,Current.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "180" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "3" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current" },
    ],
  },

  // 8. ZAPTEC (VVE / FLEET CLUSTER PRO)
  {
    id: "zaptec-pro-cluster-optimized",
    name: "Zaptec Pro & Go (Multi-Tenant & Fleet Cluster)",
    manufacturer: "Zaptec",
    category: "Commercial & Fleet",
    models: ["Zaptec Pro (Commercial / VVE)", "Zaptec Go (Residential)", "Zaptec Sense"],
    description: "Tailored for Zaptec commercial parking and apartment cluster installations. Optimized for automated phase balancing across large circuits, offline RFID authorization, and robust network resilience.",
    recommendedHardware: "Zaptec Pro multi-charger circuits and Zaptec Go home chargers.",
    color: "sky",
    items: [
      { key: "MeterValueSampleInterval", value: "15" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "1000" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 9. SMAPPEE (BELGIUM) - SMART SOLAR & EMS LEADER
  {
    id: "smappee-solar-ems-optimized",
    name: "Smappee Smart Energy & Solar EMS (EV Wall / EV Base / Ultra)",
    manufacturer: "Smappee",
    category: "Smart & Solar AC",
    models: ["Smappee EV Wall", "Smappee EV Base (Dual AC)", "Smappee EV One", "Smappee EV Ultra (80-240kW DC)"],
    description: "Designed for Belgian smart energy ecosystems with solar surplus priority, peak shaving, and dynamic tariff optimization. Supports 15s power telemetry and flexible current/power rate schedule adjustments.",
    recommendedHardware: "Smappee EV Wall, EV Base dual charging stations, and EV Ultra DC systems.",
    color: "emerald",
    items: [
      { key: "MeterValueSampleInterval", value: "15" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Current.Offered,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "500" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "45" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "MaxChargingProfilesInstalled", value: "10" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 10. WALLBOX CHARGERS (PULSAR / COMMANDER / COPPER / SUPERNOVA)
  {
    id: "wallbox-pulsar-supernova-optimized",
    name: "Wallbox Smart Ecosystem (Pulsar / Commander / Supernova)",
    manufacturer: "Wallbox",
    category: "Smart & Solar AC",
    models: ["Wallbox Pulsar Plus / Max", "Wallbox Commander 2", "Wallbox Copper SB", "Wallbox Supernova DC (60-150kW)"],
    description: "Configured for Wallbox smart EV chargers with Power Boost and Eco-Smart solar integration. Handles fast local auth caching, connection timeouts, and automatic cable release upon session finish.",
    recommendedHardware: "Wallbox Pulsar Plus, Commander 2, Copper SB, and Supernova DC chargers.",
    color: "teal",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "250" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "ChargeProfileMaxStackLevel", value: "4" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 11. COMPLEO CHARGING SOLUTIONS (GERMANY / BENELUX ENTERPRISE)
  {
    id: "compleo-ebox-duo-optimized",
    name: "Compleo Enterprise & Public (eBox / Duo / Cito)",
    manufacturer: "Compleo",
    category: "Commercial & Fleet",
    models: ["Compleo eBox Professional", "Compleo eBox touch", "Compleo Duo / eClick (Dual 22kW)", "Compleo Cito DC 500"],
    description: "Engineered for high-availability enterprise, municipal, and fleet charging across Benelux borders. Features 15-minute clock-aligned billing records, large local RFID whitelist capacity, and dependable retry timeouts.",
    recommendedHardware: "Compleo eBox AC series and Compleo Duo dual-socket public charging columns.",
    color: "violet",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "1000" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "180" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "4" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 12. EKOENERGETYKA (HIGH-POWER BUS & FASTNED/IONITY DC)
  {
    id: "ekoenergetyka-axon-hpc-optimized",
    name: "Ekoenergetyka High-Power DC & Depot (Axon Easy / Side)",
    manufacturer: "Ekoenergetyka",
    category: "High-Power DC / HPC",
    models: ["Axon Easy 60-180kW", "Axon Side 120-360kW", "High Power Charger (HPC) 350kW+", "Quick Charge Station QCS"],
    description: "Tailored for heavy commercial transit, bus depots, and public ultra-fast hubs. Enforces 10s SoC/thermal monitoring, permanent plug locking during high-voltage DC energization, and rapid status notifications.",
    recommendedHardware: "Ekoenergetyka Axon Easy, Axon Side, and HPC liquid-cooled charging systems.",
    color: "amber",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "300" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "60" },
      { key: "WebSocketPingInterval", value: "30" },
      { key: "TransactionMessageAttempts", value: "4" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "8" },
      { key: "MaxChargingProfilesInstalled", value: "16" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Power,Current" },
    ],
  },

  // 13. TRITIUM (IONITY / SHELL RECHARGE FAST DC)
  {
    id: "tritium-rtm-pkm-optimized",
    name: "Tritium High-Power Liquid-Cooled DC (RTM75 / PKM150 / PKM350)",
    manufacturer: "Tritium",
    category: "High-Power DC / HPC",
    models: ["Tritium RTM75 (75kW)", "Tritium PKM150 (150kW)", "Tritium PKM350 (350kW HPC)", "Veefil-RT 50kW"],
    description: "Designed for liquid-cooled highway fast chargers. Provides 10s thermal & power tracking, strict connector lock-in until authenticated termination, and robust fallback for roaming transactions.",
    recommendedHardware: "Tritium RTM75 and modular PKM series DC chargers.",
    color: "orange",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "300" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "60" },
      { key: "WebSocketPingInterval", value: "30" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "6" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Power,Current" },
    ],
  },

  // 14. MENNEKES (PUBLIC & DESTINATION AC)
  {
    id: "mennekes-amtron-amedio-optimized",
    name: "Mennekes AMTRON & AMEDIO Professional",
    manufacturer: "Mennekes",
    category: "Commercial & Fleet",
    models: ["AMTRON Professional", "AMTRON 4You 500", "AMEDIO Professional (Dual 22kW)", "eMobility Gateway"],
    description: "Engineered for heavy-duty industrial and municipal destination charging. Features strict local RFID authentication list synchronization, reliable energy import registers, and standardized timeout policies.",
    recommendedHardware: "Mennekes AMTRON Professional wallboxes and AMEDIO charging columns.",
    color: "stone",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "500" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "ChargeProfileMaxStackLevel", value: "4" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 15. SCHNEIDER ELECTRIC (EVLINK PRO AC)
  {
    id: "schneider-evlink-pro-optimized",
    name: "Schneider Electric EVlink Pro AC & Smart Wallbox",
    manufacturer: "Schneider Electric",
    category: "Commercial & Fleet",
    models: ["EVlink Pro AC (3.7 - 22kW)", "EVlink Pro AC Metal", "EVlink Smart Wallbox", "EVlink City"],
    description: "Configured for commercial building energy management and multi-station car park installations. Supports phase balance monitoring, load shedding schedules, and remote unlock triggers.",
    recommendedHardware: "Schneider Electric EVlink Pro AC and Smart Wallbox series.",
    color: "emerald",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "500" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "ChargeProfileMaxStackLevel", value: "4" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 16. PHOENIX CONTACT (CHARX SEC-3000 DC FAST & HPC CONTROLLER)
  {
    id: "phoenix-contact-charx-sec3000-dc-optimized",
    name: "Phoenix Contact CHARX SEC-3000 Series (DC Fast & HPC)",
    manufacturer: "Phoenix Contact",
    category: "High-Power DC / HPC",
    models: ["CHARX SEC-3000", "CHARX SEC-3000-DC-1CCS", "CHARX SEC-3000-DC-2CCS", "CHARX SEC-3100", "CHARX control modular DC"],
    description: "Tuned specifically for Phoenix Contact CHARX SEC-3000 and SEC-3100 DC fast charging controllers running embedded Linux. Captures 10s SoC and temperature curves, controls CAN bus power modules, supports ISO 15118-2/20 Plug & Charge, and enforces permanent cable locking during high-voltage DC energization.",
    recommendedHardware: "Phoenix Contact CHARX SEC-3000 / SEC-3100 series DC charging controllers (CCS Type 2 & CHAdeMO).",
    color: "amber",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered,Current.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "300" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "HeartbeatInterval", value: "60" },
      { key: "WebSocketPingInterval", value: "30" },
      { key: "TransactionMessageAttempts", value: "4" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "8" },
      { key: "MaxChargingProfilesInstalled", value: "20" },
      { key: "ChargingScheduleMaxPeriods", value: "48" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Power,Current" },
    ],
  },

  // 17. PHOENIX CONTACT (CHARX SEC-1000 & MODULAR AC CONTROLLERS)
  {
    id: "phoenix-contact-charx-sec1000-ac-optimized",
    name: "Phoenix Contact CHARX SEC-1000 & Modular AC Series",
    manufacturer: "Phoenix Contact",
    category: "Commercial & Fleet",
    models: ["CHARX SEC-1000", "CHARX control modular AC", "CHARX control integrated", "EM-CP-PP-ETH"],
    description: "Configured for Phoenix Contact CHARX SEC-1000 series and modular AC charge controllers powering commercial and fleet charging stations across Benelux. Provides 20s telemetry, dynamic load shedding, and automatic plug release upon session completion.",
    recommendedHardware: "Phoenix Contact CHARX SEC-1000 and AC modular controllers.",
    color: "cyan",
    items: [
      { key: "MeterValueSampleInterval", value: "20" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Current.Offered,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "1000" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "120" },
      { key: "WebSocketPingInterval", value: "45" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "ChargeProfileMaxStackLevel", value: "6" },
      { key: "MaxChargingProfilesInstalled", value: "15" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 17. BENDER (CC612 / CC613 CHARGE CONTROLLER)
  {
    id: "bender-cc613-charge-controller-optimized",
    name: "Bender Charge Controller (CC612 / CC613 & ISO 15118)",
    manufacturer: "Bender",
    category: "Commercial & Fleet",
    models: ["Bender CC612", "Bender CC613 (ISO 15118)", "Bender CC614", "Bender DLM Master/Slave"],
    description: "Tailored for Bender CC612 and CC613 embedded charging controllers that power numerous Benelux commercial wallboxes and public columns. Supports ISO 15118 Plug & Charge, 30s telemetry, local authorization list caching, and dynamic load management.",
    recommendedHardware: "Bender CC612 / CC613 / CC614 charge controller embedded charging posts.",
    color: "blue",
    items: [
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ClockAlignedDataInterval", value: "900" },
      { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalAuthListEnabled", value: "true" },
      { key: "SendLocalListMaxLength", value: "1000" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "ConnectionTimeOut", value: "120" },
      { key: "HeartbeatInterval", value: "180" },
      { key: "WebSocketPingInterval", value: "60" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "MaxChargingProfilesInstalled", value: "10" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 18. RAEDIAN NEX (SMART AC WALLBOX)
  {
    id: "raedian-nex-optimized",
    name: "Raedian NEX Series Optimized (Smart AC Wallbox)",
    manufacturer: "Raedian",
    category: "Smart & Solar AC",
    models: ["Raedian NEX", "Raedian NEX 7kW", "Raedian NEX 11kW", "Raedian NEX 22kW", "Raedian NEX Solar"],
    description: "Tailored configuration profile for Raedian NEX residential and smart commercial single-socket AC chargers (OCPP 1.6-J). Features 60s sample interval telemetry, local authorization fallback with pre-authorization enabled, EV-side disconnect auto-unlock, and dynamic power/current scheduling.",
    recommendedHardware: "Raedian NEX 7.4kW / 11kW / 22kW single-connector smart AC wallboxes.",
    color: "teal",
    items: [
      { key: "HeartbeatInterval", value: "60" },
      { key: "ConnectionTimeOut", value: "30" },
      { key: "ResetRetries", value: "3" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "10" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalPreAuthorize", value: "true" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "MeterValueSampleInterval", value: "60" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "NumberOfConnectors", value: "1" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },

  // 19. RAEDIAN GEMINI (COMMERCIAL DUAL-SOCKET AC)
  {
    id: "raedian-gemini-optimized",
    name: "Raedian Gemini Series Optimized (Commercial Dual-Socket AC)",
    manufacturer: "Raedian",
    category: "Commercial & Fleet",
    models: ["Raedian Gemini", "Raedian Gemini 2x11kW", "Raedian Gemini 2x22kW", "Raedian Gemini Commercial Dual"],
    description: "Tuned configuration profile for Raedian Gemini dual-socket commercial and fleet AC charging stations (OCPP 1.6-J). Configured for 30s high-precision multi-measurand telemetry (including Offered power/current), robust 5-attempt retry policies, dual connector load sharing, and up to 10 smart charging profiles.",
    recommendedHardware: "Raedian Gemini dual-socket 22kW AC commercial charging posts.",
    color: "cyan",
    items: [
      { key: "HeartbeatInterval", value: "60" },
      { key: "ConnectionTimeOut", value: "30" },
      { key: "ResetRetries", value: "3" },
      { key: "TransactionMessageAttempts", value: "5" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalPreAuthorize", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,Current.Offered,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,Current.Import,Power.Active.Import" },
      { key: "NumberOfConnectors", value: "2" },
      { key: "MaxChargingProfilesInstalled", value: "10" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
    ],
  },
];

/**
 * Seeds or updates all Benelux and Universal Configuration Profiles in the database.
 */
export async function seedAllBeneluxProfiles() {
  logger.info(`Starting seeding of ${BENELUX_CHARGER_PROFILES.length} Benelux & Universal OCPP Configuration Profiles...`);

  const createdProfiles = [];

  for (const preset of BENELUX_CHARGER_PROFILES) {
    try {
      const existing = await prisma.configurationProfile.findUnique({
        where: { name: preset.name },
        select: { id: true },
      });

      let profile;
      if (existing) {
        await prisma.configurationProfileItem.deleteMany({
          where: { profileId: existing.id },
        });

        profile = await prisma.configurationProfile.update({
          where: { id: existing.id },
          data: {
            description: preset.description,
            items: {
              create: preset.items.map((item) => ({
                key: item.key,
                value: item.value,
              })),
            },
          },
          include: { items: true },
        });
      } else {
        profile = await prisma.configurationProfile.create({
          data: {
            name: preset.name,
            description: preset.description,
            items: {
              create: preset.items.map((item) => ({
                key: item.key,
                value: item.value,
              })),
            },
          },
          include: { items: true },
        });
      }

      createdProfiles.push(profile);
      logger.info(`[Profile Seeded] "${preset.name}" (${preset.items.length} keys)`);
    } catch (error) {
      logger.error(`Failed to seed profile "${preset.name}"`, error);
    }
  }

  logger.info(`Successfully seeded ${createdProfiles.length} configuration profiles.`);
  return createdProfiles;
}
