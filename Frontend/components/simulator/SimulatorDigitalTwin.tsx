"use client";

import React from "react";
import {
  Zap,
  Plug,
  BatteryCharging,
  Gauge,
  Thermometer,
  ShieldAlert,
  Radio,
  Clock,
  Coins,
  Cpu,
  Layers,
  ArrowDownUp,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SimulatedConnectorState {
  id: number;
  evseId: number;
  connectorName: string;
  format: string;
  type: string;
  status:
    | "Available"
    | "Preparing"
    | "Charging"
    | "SuspendedEVSE"
    | "SuspendedEV"
    | "Finishing"
    | "Reserved"
    | "Unavailable"
    | "Faulted";
  errorCode?: string;
  vendorErrorCode?: string;
  isPlugged: boolean;
  transactionId: number | string | null;
  idTag: string | null;
  meterStart: number;
  currentMeterWh: number;
  currentPowerW: number;
  maxPowerW: number;
  voltage: number;
  currentAmps: number;
  soc: number;
  temperature: number;
  startedAt: string | null;
  smartChargingLimitW: number | null;
  smartChargingLimitAmps: number | null;
}

interface SimulatorDigitalTwinProps {
  chargerName: string;
  vendor: string;
  model: string;
  protocol: string;
  firmwareVersion: string;
  status: string;
  connectors: SimulatedConnectorState[];
  selectedConnectorId: number;
  onSelectConnector: (id: number) => void;
  onTogglePlug: (connectorId: number) => void;
  loading?: boolean;
}

export function SimulatorDigitalTwin({
  chargerName,
  vendor,
  model,
  protocol,
  firmwareVersion,
  status,
  connectors,
  selectedConnectorId,
  onSelectConnector,
  onTogglePlug,
  loading = false,
}: SimulatorDigitalTwinProps) {
  const activeConn =
    connectors.find((c) => c.id === selectedConnectorId) || connectors[0];

  const isCharging = activeConn?.status === "Charging";
  const isPreparing = activeConn?.status === "Preparing";
  const isFaulted = activeConn?.status === "Faulted";
  const isSuspended =
    activeConn?.status === "SuspendedEVSE" ||
    activeConn?.status === "SuspendedEV";
  const isAvailable = activeConn?.status === "Available";

  const powerKw = activeConn ? activeConn.currentPowerW / 1000 : 0;
  const maxKw = activeConn ? activeConn.maxPowerW / 1000 : 22;
  const energyKwh = activeConn
    ? (activeConn.currentMeterWh - (activeConn.meterStart || 0)) / 1000
    : 0;
  const lifetimeKwh = activeConn ? activeConn.currentMeterWh / 1000 : 0;

  // Status color mapping
  const getStatusBadge = () => {
    if (isCharging) {
      return (
        <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 px-3 py-1 font-mono animate-pulse">
          ⚡ CHARGING
        </Badge>
      );
    }
    if (isPreparing) {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 px-3 py-1 font-mono">
          🔌 PREPARING (PLUGGED)
        </Badge>
      );
    }
    if (isFaulted) {
      return (
        <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30 px-3 py-1 font-mono">
          ⚠️ FAULTED ({activeConn?.errorCode || "Error"})
        </Badge>
      );
    }
    if (isSuspended) {
      return (
        <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-500/30 px-3 py-1 font-mono">
          ⏸️ {activeConn?.status.toUpperCase()}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 px-3 py-1 font-mono">
        🟢 AVAILABLE
      </Badge>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-sm">
      {/* Glow Effects */}
      <div
        className={cn(
          "absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-20 dark:opacity-20",
          isCharging
            ? "bg-cyan-500"
            : isFaulted
            ? "bg-rose-500"
            : isPreparing
            ? "bg-amber-500"
            : "bg-[#54a8c7]"
        )}
      />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15 bg-[#3f78e0]" />

      {/* Top Station Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all duration-500",
              isCharging
                ? "bg-cyan-500/20 border-cyan-400/50 shadow-cyan-500/10"
                : isFaulted
                ? "bg-rose-500/20 border-rose-400/50 shadow-rose-500/10"
                : "bg-muted/50 border-border"
            )}
          >
            <Zap
              className={cn(
                "size-6 transition-colors",
                isCharging
                  ? "text-cyan-500 fill-cyan-500 dark:text-cyan-400 dark:fill-cyan-400"
                  : isFaulted
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-[#54a8c7]"
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-heading font-extrabold text-foreground tracking-tight">
                {chargerName || "SIMULATOR-01"}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono font-semibold">
                {protocol.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {vendor} • {model} • {firmwareVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-muted/40 border border-border text-xs font-mono">
            <span
              className={cn(
                "size-2 rounded-full",
                status === "connected"
                  ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse"
                  : status === "offline_buffering"
                  ? "bg-amber-500 dark:bg-amber-400 animate-ping"
                  : status === "connecting"
                  ? "bg-blue-500 dark:bg-blue-400 animate-spin"
                  : "bg-rose-500"
              )}
            />
            <span className="text-foreground capitalize font-semibold">
              {status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Connector Channel Selector Tabs */}
      <div className="relative z-10 grid grid-cols-2 gap-3 my-5">
        {connectors.map((c) => {
          const isSel = c.id === selectedConnectorId;
          const cCharging = c.status === "Charging";
          return (
            <button
              key={c.id}
              onClick={() => onSelectConnector(c.id)}
              className={cn(
                "group relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200",
                isSel
                  ? "bg-[#54a8c7]/15 border-[#54a8c7]/50 shadow-sm"
                  : "bg-muted/20 border-border hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "size-9 rounded-lg flex items-center justify-center font-bold text-xs",
                    cCharging
                      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-400/40"
                      : isSel
                      ? "bg-[#54a8c7]/20 text-[#54a8c7]"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  EVSE {c.evseId}
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    {c.connectorName}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({c.type})
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                    <span>{c.maxPowerW / 1000} kW Max</span>
                    <span>•</span>
                    <span
                      className={cn(
                        "font-semibold",
                        cCharging
                          ? "text-cyan-600 dark:text-cyan-400"
                          : c.status === "Faulted"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {c.isPlugged ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1 font-medium">
                    <Plug className="size-3" /> Plugged
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    Unplugged
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Digital Twin Visual Canvas */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Interactive EV Visual & Physical Cable */}
        <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-muted/30 dark:bg-black/40 border border-border relative overflow-hidden">
          {/* Active Flow Pulse Animation Overlay */}
          {isCharging && (
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent animate-pulse" />
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BatteryCharging className="size-4 text-[#54a8c7]" />
                Simulated EV Battery Twin
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {activeConn?.soc || 0}% SoC
              </span>
            </div>

            {/* Visual Battery Bar */}
            <div className="relative w-full h-8 bg-muted dark:bg-black/60 rounded-xl p-1 border border-border overflow-hidden mb-4">
              <div
                className={cn(
                  "h-full rounded-lg transition-all duration-500 relative flex items-center justify-end pr-2 font-mono text-[10px] font-bold",
                  isCharging
                    ? "bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 shadow-md shadow-cyan-500/20"
                    : isFaulted
                    ? "bg-gradient-to-r from-rose-600 to-rose-400 text-white"
                    : "bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white"
                )}
                style={{ width: `${Math.max(5, activeConn?.soc || 0)}%` }}
              >
                {isCharging && (
                  <Zap className="size-3.5 text-slate-950 fill-slate-950 animate-bounce" />
                )}
              </div>
            </div>

            {/* Cable & Plug Physical Switch */}
            <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center",
                    activeConn?.isPlugged
                      ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-400/30"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Plug className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground font-heading">
                    Physical Cable Latch
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {activeConn?.isPlugged
                      ? "Locked in vehicle inlet"
                      : "Cable unplugged / holstered"}
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant={activeConn?.isPlugged ? "destructive" : "default"}
                onClick={() => onTogglePlug(selectedConnectorId)}
                disabled={loading}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 h-8 rounded-lg transition-all",
                  !activeConn?.isPlugged &&
                    "bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white"
                )}
              >
                {activeConn?.isPlugged ? "Unplug Cable" : "Plug In Cable"}
              </Button>
            </div>
          </div>

          {/* Session Telemetry Highlights */}
          <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-border font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-card border border-border">
              <span className="text-[10px] text-muted-foreground block">
                Session Energy
              </span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                {energyKwh.toFixed(3)} kWh
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border">
              <span className="text-[10px] text-muted-foreground block">
                Active Tx ID
              </span>
              <span className="text-sm font-bold text-foreground truncate block">
                {activeConn?.transactionId || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Real-Time Power Gauges & Telemetry Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Main Power Output Meter */}
          <div className="col-span-2 sm:col-span-3 p-4 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Gauge className="size-4 text-[#54a8c7]" />
                Active Power Flow
              </span>
              {activeConn?.smartChargingLimitW && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono font-medium">
                  Throttled Limit:{" "}
                  {(activeConn.smartChargingLimitW / 1000).toFixed(1)} kW
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-foreground font-mono tracking-tight">
                {powerKw.toFixed(2)}
              </span>
              <span className="text-sm text-cyan-600 dark:text-cyan-400 font-bold font-mono">
                kW
              </span>
              <span className="text-xs text-muted-foreground font-mono ml-auto">
                / {maxKw} kW rated
              </span>
            </div>

            {/* Power Flow Bar */}
            <div className="w-full h-2 rounded-full bg-muted dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  isCharging
                    ? "bg-gradient-to-r from-cyan-500 to-teal-400"
                    : "bg-muted-foreground/30"
                )}
                style={{ width: `${Math.min(100, (powerKw / maxKw) * 100)}%` }}
              />
            </div>
          </div>

          {/* Voltage Dial */}
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Zap className="size-3 text-amber-500" /> Voltage
            </span>
            <div className="my-1.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {activeConn ? activeConn.voltage.toFixed(1) : 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono ml-1">
                V
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              3-Phase AC (400V)
            </span>
          </div>

          {/* Current Dial */}
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <ArrowDownUp className="size-3 text-cyan-500" /> Current
            </span>
            <div className="my-1.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {activeConn ? activeConn.currentAmps.toFixed(1) : 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono ml-1">
                A
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              L1 / L2 / L3
            </span>
          </div>

          {/* Temperature Sensor */}
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Thermometer className="size-3 text-rose-500" /> Thermals
            </span>
            <div className="my-1.5">
              <span
                className={cn(
                  "text-xl font-bold font-mono",
                  (activeConn?.temperature || 25) > 50
                    ? "text-rose-600 dark:text-rose-400 animate-pulse"
                    : "text-foreground"
                )}
              >
                {activeConn ? activeConn.temperature.toFixed(1) : 25}
              </span>
              <span className="text-xs text-muted-foreground font-mono ml-1">
                °C
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              EVSE Inverter
            </span>
          </div>

          {/* Total Energy Counter */}
          <div className="p-3.5 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Layers className="size-3 text-emerald-500" /> Lifetime Wh
            </span>
            <div className="my-1.5">
              <span className="text-lg font-bold font-mono text-foreground truncate block">
                {lifetimeKwh.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                kWh register
              </span>
            </div>
          </div>

          {/* Authorized RFID Token */}
          <div className="col-span-2 p-3.5 rounded-xl bg-muted/30 dark:bg-black/40 border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <Radio className="size-3 text-purple-500" /> Authorized idTag
            </span>
            <div className="my-1.5 flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-purple-600 dark:text-purple-300 truncate">
                {activeConn?.idTag || "None (Unauthenticated)"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              ISO14443 / ISO15118 Token
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
