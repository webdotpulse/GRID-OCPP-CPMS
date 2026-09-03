"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  Download,
  Upload,
  Save,
  Edit,
  Zap,
  Sparkles,
  ShieldCheck,
  BatteryCharging,
  Gauge,
  Wifi,
  Globe,
  Sliders,
  ChevronRight,
  Search,
  CheckCircle2,
  Cpu,
  Layers,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface ProfileItem {
  key: string;
  value: string;
}

interface ConfigProfile {
  id: number;
  name: string;
  description: string | null;
  items: ProfileItem[];
  createdAt: string;
}

interface PresetDefinition {
  id: string;
  name: string;
  manufacturer: string;
  category: "Universal / General" | "Benelux Leaders" | "High-Power DC / HPC" | "Smart & Solar AC" | "Commercial & Fleet" | "Security & Telecom";
  models: string[];
  description: string;
  recommendedHardware: string;
  icon: any;
  color: string;
  badgeClass: string;
  items: ProfileItem[];
}

export const BENELUX_AND_GENERAL_PRESETS: PresetDefinition[] = [
  // 1. UNIVERSAL GENERAL OPTIMIZED PROFILE (FOR ALL OTHER EV CHARGERS)
  {
    id: "universal-general-optimized",
    name: "Universal General Baseline (All EV Chargers)",
    manufacturer: "Universal Standard",
    category: "Universal / General",
    models: ["All OCPP 1.6-J & 2.0.1 compliant AC / DC Chargers", "Generic Wallboxes", "White-label Hardware"],
    description: "Battle-tested, resilient configuration profile designed for any standard OCPP compliant charge point. Enforces 30s telemetry, energy/power/current/voltage/SoC reporting, robust message retries, and safe connector unlocking.",
    recommendedHardware: "Any OCPP 1.6-J or 2.0.1 compliant AC or DC EV charging station without vendor-specific quirks.",
    icon: Globe,
    color: "text-[#45c4a0] bg-[#45c4a0]/15 border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
    category: "Benelux Leaders",
    models: ["Eve Single Pro-line", "Eve Single S-line", "Eve Double Pro-line", "Eve Double PG-line", "Twin 4XL", "Twin 5 Plus"],
    description: "Tuned specifically for Alfen firmware (v4.x - v6.x). Provides 15s high-resolution telemetry, phase rotation alignment for smart charging, remote authorization, and local RFID whitelist management without memory congestion.",
    recommendedHardware: "Alfen Eve Single / Double / Twin AC charging stations (3.7kW - 22kW dual-socket).",
    icon: Zap,
    color: "text-[#3f78e0] bg-[#3f78e0]/15 border-blue-500/30",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
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
    category: "Benelux Leaders",
    models: ["EVBox Elvi", "EVBox BusinessLine (B3322 / G4)", "EVBox Livo / Liviqo", "EVBox Troniq Modular 120-240kW"],
    description: "Configured to prevent buffer overflow issues on EVBox controllers while ensuring accurate energy tracking, robust reconnect routines, and proper EV-side disconnection handling.",
    recommendedHardware: "EVBox Elvi, BusinessLine, Livo, and Troniq series chargers.",
    icon: Cpu,
    color: "text-[#54a8c7] bg-[#54a8c7]/15 border-cyan-500/30",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
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
    icon: Gauge,
    color: "text-[#fab758] bg-[#fab758]/15 border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
    icon: BatteryCharging,
    color: "text-[#e2626b] bg-[#e2626b]/15 border-rose-500/30",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
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
    icon: Gauge,
    color: "text-[#e2626b] bg-[#e2626b]/15 border-rose-500/30",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
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
    icon: Zap,
    color: "text-[#8b5cf6] bg-[#8b5cf6]/15 border-purple-500/30",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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
    icon: Layers,
    color: "text-[#38bdf8] bg-[#38bdf8]/15 border-sky-500/30",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
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
    icon: Sparkles,
    color: "text-[#45c4a0] bg-[#45c4a0]/15 border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
    icon: BatteryCharging,
    color: "text-[#14b8a6] bg-[#14b8a6]/15 border-teal-500/30",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
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
    icon: ShieldCheck,
    color: "text-[#a855f7] bg-[#a855f7]/15 border-purple-500/30",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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
    icon: Gauge,
    color: "text-[#fab758] bg-[#fab758]/15 border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
    icon: Gauge,
    color: "text-[#f97316] bg-[#f97316]/15 border-orange-500/30",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
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
    icon: ShieldCheck,
    color: "text-[#94a3b8] bg-[#94a3b8]/15 border-slate-500/30",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
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
    icon: Zap,
    color: "text-[#10b981] bg-[#10b981]/15 border-emerald-500/30",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
    icon: Gauge,
    color: "text-[#fab758] bg-[#fab758]/15 border-amber-500/30",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
    icon: Cpu,
    color: "text-[#54a8c7] bg-[#54a8c7]/15 border-cyan-500/30",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
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
    icon: ShieldCheck,
    color: "text-[#3f78e0] bg-[#3f78e0]/15 border-blue-500/30",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
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
    icon: Zap,
    color: "text-[#45c4a0] bg-[#45c4a0]/15 border-teal-500/30",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
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
    icon: Layers,
    color: "text-[#54a8c7] bg-[#54a8c7]/15 border-sky-500/30",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
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

  // 18. SECURITY PROFILE 3 (ISO 15118 PLUG & CHARGE)
  {
    id: "pki-security-sp3",
    name: "Strict ISO 15118 Plug & Charge & Security Profile 3",
    manufacturer: "Universal Security",
    category: "Security & Telecom",
    models: ["All Security Profile 3 Hardware", "ISO 15118 Chargers"],
    description: "Enforces mutual TLS client certificate verification, disables unauthenticated offline charging, and sizes certificate stores for secure Plug & Charge operations.",
    recommendedHardware: "Charge points equipped with hardware secure elements / TPM supporting OCPP-J SP3.",
    icon: ShieldCheck,
    color: "text-[#8b5cf6] bg-[#8b5cf6]/15 border-purple-500/30",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    items: [
      { key: "SecurityProfile", value: "3" },
      { key: "AuthorizationRequired", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "LocalPreAuthorize", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "CertificateStoreMaxLength", value: "10" },
      { key: "CpoName", value: "GRID-OCPP-CPMS" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
    ],
  },

  // 17. CELLULAR 4G / LOW BANDWIDTH
  {
    id: "low-bandwidth-4g",
    name: "Low-Bandwidth Cellular / 4G Cost-Optimized",
    manufacturer: "Universal Telecom",
    category: "Security & Telecom",
    models: ["Remote 4G/LTE Chargers", "Rural Charging Posts"],
    description: "Minimizes mobile data SIM consumption with 5-minute sampling windows and hourly clock-aligned aggregation, saving ongoing cellular subscription overhead.",
    recommendedHardware: "Standalone chargers with metered cellular data plans.",
    icon: Wifi,
    color: "text-[#54a8c7] bg-[#54a8c7]/15 border-cyan-500/30",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    items: [
      { key: "HeartbeatInterval", value: "900" },
      { key: "MeterValueSampleInterval", value: "300" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "3600" },
      { key: "TransactionMessageAttempts", value: "2" },
      { key: "TransactionMessageRetryInterval", value: "30" },
    ],
  },
];

const CATEGORIES = [
  "All",
  "Universal / General",
  "Benelux Leaders",
  "High-Power DC / HPC",
  "Smart & Solar AC",
  "Commercial & Fleet",
  "Security & Telecom",
] as const;

export default function ConfigProfilesPage() {
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeedingAll, setIsSeedingAll] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectingPreset, setInspectingPreset] = useState<PresetDefinition | null>(null);
  const [editingProfile, setEditingProfile] = useState<ConfigProfile | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [{ key: "", value: "" }],
  });

  const fetchProfiles = async () => {
    try {
      const response = await api.get("/config-profiles");
      setProfiles(response.data || []);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Filter presets based on Search & Category tabs
  const filteredPresets = useMemo(() => {
    return BENELUX_AND_GENERAL_PRESETS.filter((preset) => {
      const matchesCategory =
        selectedCategory === "All" || preset.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesSearch =
        preset.name.toLowerCase().includes(q) ||
        preset.manufacturer.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        preset.models.some((m) => m.toLowerCase().includes(q)) ||
        preset.items.some((i) => i.key.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleOpenDialog = (profile?: ConfigProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || "",
        items:
          profile.items.length > 0
            ? profile.items.map((i) => ({ key: i.key, value: i.value }))
            : [{ key: "", value: "" }],
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: "",
        description: "",
        items: [{ key: "", value: "" }],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        items: formData.items.filter((i) => i.key.trim() !== ""),
      };

      if (editingProfile) {
        await api.put(`/config-profiles/${editingProfile.id}`, payload);
        toast.success("Profile updated");
      } else {
        await api.post("/config-profiles", payload);
        toast.success("Profile created");
      }

      setIsDialogOpen(false);
      fetchProfiles();
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await api.delete(`/config-profiles/${id}`);
      toast.success("Profile deleted");
      fetchProfiles();
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  const applyPresetToForm = (preset: PresetDefinition) => {
    setFormData({
      name: preset.name,
      description: preset.description,
      items: preset.items.map((item) => ({ ...item })),
    });
    setIsDialogOpen(true);
    toast.success(`Loaded "${preset.name}" preset keys into editor`);
  };

  const installPresetDirectly = async (preset: PresetDefinition) => {
    try {
      await api.post("/config-profiles", {
        name: preset.name,
        description: preset.description,
        items: preset.items,
      });
      toast.success(`Installed profile "${preset.name}"`);
      fetchProfiles();
    } catch {
      toast.error("Failed to install preset");
    }
  };

  const handleSeedAllPresets = async () => {
    if (
      !confirm(
        `Install or update all ${BENELUX_AND_GENERAL_PRESETS.length} Benelux and Universal OEM profiles in the database?`
      )
    ) {
      return;
    }

    setIsSeedingAll(true);
    try {
      const res = await api.post("/config-profiles/seed-presets", {});
      toast.success(res.data?.message || "Successfully installed all Benelux & Universal profiles!");
      fetchProfiles();
    } catch {
      toast.error("Failed to seed presets");
    } finally {
      setIsSeedingAll(false);
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { key: "", value: "" }] });
  };

  const updateItem = (index: number, field: "key" | "value", val: string) => {
    const newItems = [...formData.items];
    newItems[index][field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleExport = (profile: ConfigProfile) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${profile.name.replace(/\s+/g, "_")}_profile.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.name && json.items) {
          await api.post("/config-profiles", {
            name: `${json.name} (Imported)`,
            description: json.description,
            items: json.items,
          });
          toast.success("Profile imported successfully");
          fetchProfiles();
        } else {
          toast.error("Invalid profile format");
        }
      } catch {
        toast.error("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleInspectPreset = (preset: PresetDefinition) => {
    setInspectingPreset(preset);
    setIsInspectOpen(true);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">OCPP Configuration Profiles</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-10 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center border border-[#54a8c7]/30">
                <Sliders className="w-5 h-5" />
              </div>
              OCPP Configuration Profiles
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Optimized OCPP 1.6-J &amp; 2.0.1 parameter presets for all major Benelux EV chargers (Alfen, EVBox, Kempower, ABB, Easee, Zaptec, Smappee, Wallbox, Compleo, Ekoenergetyka, Tritium, Mennekes, Schneider) and a resilient Universal Baseline Profile.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedAllPresets}
              disabled={isSeedingAll}
              className="text-xs h-9 border-[#54a8c7]/40 bg-[#54a8c7]/10 hover:bg-[#54a8c7]/20 text-[#54a8c7] shadow-sm font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSeedingAll ? "animate-spin" : ""}`} />
              {isSeedingAll ? "Installing..." : "Install All Presets"}
            </Button>

            <Label htmlFor="import-profile" className="cursor-pointer">
              <div className="flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import JSON
              </div>
            </Label>
            <input
              id="import-profile"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            <Button
              size="sm"
              onClick={() => handleOpenDialog()}
              className="bg-[#3f78e0] hover:bg-[#3364be] text-white shadow-md shadow-blue-500/20 text-xs h-9 font-bold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Profile
            </Button>
          </div>
        </div>

        {/* Search and Category Filter Tabs */}
        <div className="space-y-3 bg-card/60 p-4 rounded-2xl border border-border">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search presets by manufacturer, model (e.g. Alfen Eve, Kempower, ABB), or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border text-xs h-9 text-foreground"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center">
              <span className="font-semibold text-foreground">{filteredPresets.length}</span> of{" "}
              {BENELUX_AND_GENERAL_PRESETS.length} presets shown
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                  selectedCategory === cat
                    ? "bg-[#3f78e0] text-white border-[#3f78e0] shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Industry & Benelux Presets Library Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#fab758]" />
              <h2 className="text-base font-bold text-foreground font-heading">
                Benelux &amp; Universal OCPP Profiles Library
              </h2>
            </div>
          </div>

          {filteredPresets.length === 0 ? (
            <Card className="border-dashed border-border bg-card/40">
              <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                <Search className="size-8 mx-auto opacity-40 text-muted-foreground" />
                <div className="text-sm font-semibold text-foreground">No matching presets found</div>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search terms or selecting a different category filter above.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPresets.map((preset) => {
                const Icon = preset.icon;
                return (
                  <div
                    key={preset.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-[#54a8c7]/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`${preset.badgeClass} border text-[10px] font-semibold px-2 py-0.5`}>
                          {preset.category}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded bg-muted/60 border border-border">
                            {preset.manufacturer}
                          </span>
                          <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center text-foreground group-hover:scale-105 transition-transform">
                            <Icon className="size-4" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-foreground font-heading leading-snug">
                          {preset.name}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-3">
                          {preset.description}
                        </p>
                      </div>

                      {preset.models.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Compatible Hardware:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {preset.models.slice(0, 3).map((m, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-muted/40 text-foreground px-1.5 py-0.5 rounded border border-border/60"
                              >
                                {m}
                              </span>
                            ))}
                            {preset.models.length > 3 && (
                              <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                                +{preset.models.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleInspectPreset(preset)}
                        className="text-[11px] font-mono text-[#54a8c7] hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {preset.items.length} keys
                      </button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyPresetToForm(preset)}
                          className="text-xs h-7 text-muted-foreground hover:text-foreground"
                        >
                          Customize
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => installPresetDirectly(preset)}
                          className="text-xs h-7 bg-muted text-foreground hover:bg-[#3f78e0] hover:text-white font-medium"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Install
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User Saved Profiles List */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground font-heading flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#45c4a0]" />
              Active Installed Configuration Profiles ({profiles.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              Ready to apply to charge points
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Loading configuration profiles...
            </div>
          ) : profiles.length === 0 ? (
            <Card className="border-dashed border-border bg-card/50">
              <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                <Sliders className="size-8 mx-auto opacity-40 text-[#54a8c7]" />
                <div className="text-sm font-semibold text-foreground">No Profiles Installed Yet</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Click &quot;Install All Presets&quot; or click &quot;Install&quot; on any OEM preset above to provision your charging fleet.
                </p>
                <Button
                  size="sm"
                  onClick={handleSeedAllPresets}
                  className="bg-[#3f78e0] text-white text-xs h-8 mt-2 font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Install All Standard Presets Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => (
                <Card key={profile.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold text-foreground font-heading">
                          {profile.name}
                        </CardTitle>
                        {profile.description && (
                          <CardDescription className="text-xs mt-1 text-muted-foreground">
                            {profile.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border flex items-center justify-between">
                      <span>{profile.items.length} configuration key{profile.items.length === 1 ? "" : "s"} defined</span>
                      <span className="text-[10px] text-muted-foreground">ID: #{profile.id}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(profile)}
                        className="text-xs h-8 border-border"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(profile)}
                        className="text-xs h-8 border-border"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(profile.id)}
                        className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Inspect Preset Key-Values Dialog */}
        <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
          <DialogContent className="sm:max-w-2xl p-0 flex flex-col gap-0 max-h-[85vh] overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                <Sliders className="w-5 h-5 text-[#54a8c7]" />
                {inspectingPreset?.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {inspectingPreset?.description}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-xs">
              {inspectingPreset?.recommendedHardware && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="font-semibold text-foreground block mb-0.5">Recommended Hardware:</span>
                  <span className="text-muted-foreground">{inspectingPreset.recommendedHardware}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="font-semibold text-foreground">
                  Configured OCPP Parameters ({inspectingPreset?.items.length || 0}):
                </div>
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {inspectingPreset?.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-background hover:bg-muted/30 flex items-center justify-between gap-4">
                      <span className="font-mono font-semibold text-foreground">{item.key}</span>
                      <span className="font-mono text-muted-foreground text-right break-all max-w-[50%] bg-muted/50 px-2 py-0.5 rounded">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInspectOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (inspectingPreset) {
                      applyPresetToForm(inspectingPreset);
                      setIsInspectOpen(false);
                    }
                  }}
                  className="text-xs h-8 border-border"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" /> Customize
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (inspectingPreset) {
                      installPresetDirectly(inspectingPreset);
                      setIsInspectOpen(false);
                    }
                  }}
                  className="bg-[#3f78e0] hover:bg-[#3364be] text-white text-xs h-8 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Install Profile
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create / Edit Profile Modal */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl p-0 flex flex-col gap-0 max-h-[90vh] overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                <Sliders className="w-5 h-5 text-[#54a8c7]" />
                {editingProfile ? "Edit Configuration Profile" : "Create Configuration Profile"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Configure standardized OCPP key-value pairs that can be batch-dispatched to chargers.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 text-sm">
              {/* Quick Preset Loader Selector */}
              {!editingProfile && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground block">Load from Preset:</span>
                    Pre-fill recommended values for specific Benelux OEM hardware
                  </div>
                  <Select
                    onValueChange={(presetId) => {
                      const found = BENELUX_AND_GENERAL_PRESETS.find((p) => p.id === presetId);
                      if (found) {
                        setFormData({
                          name: found.name,
                          description: found.description,
                          items: found.items.map((item) => ({ ...item })),
                        });
                        toast.success(`Loaded "${found.name}" preset keys`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[220px] bg-background border-border text-foreground text-xs h-8">
                      <SelectValue placeholder="Select a preset..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {BENELUX_AND_GENERAL_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Profile Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alfen Eve Pro Smart Charging Setup"
                  className="bg-background border-border text-foreground text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes or hardware compatibility notes..."
                  className="bg-background border-border text-foreground text-xs h-9"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Configuration Key-Value Pairs</Label>
                  <Button size="sm" variant="outline" onClick={addItem} className="text-xs h-7 border-border">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Key
                  </Button>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        className="flex-1 bg-background border-border text-foreground text-xs font-mono h-8"
                        placeholder="OCPP Key (e.g. MeterValueSampleInterval)"
                        value={item.key}
                        onChange={(e) => updateItem(idx, "key", e.target.value)}
                      />
                      <Input
                        className="flex-1 bg-background border-border text-foreground text-xs font-mono h-8"
                        placeholder="Value (e.g. 15)"
                        value={item.value}
                        onChange={(e) => updateItem(idx, "value", e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-[#3f78e0] hover:bg-[#3364be] text-white font-bold"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
