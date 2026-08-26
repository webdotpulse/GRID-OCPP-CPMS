"use client";

import React from "react";
import { PhaseTelemetry } from "./types";
import { Zap, AlertTriangle, CheckCircle2, Activity, Gauge, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  telemetry: PhaseTelemetry | {
    name?: string;
    activePowerKw: number;
    currentL1: number;
    currentL2: number;
    currentL3: number;
    voltageL1?: number;
    voltageL2?: number;
    voltageL3?: number;
    unbalanceAmps?: number;
    isUnbalanced?: boolean;
  };
  title?: string;
  subtitle?: string;
  maxAmps?: number;
  onClose?: () => void;
  floatingPosition?: { x: number; y: number };
}

export function PhaseBalanceInspector({
  telemetry,
  title,
  subtitle,
  maxAmps = 63,
  onClose,
  floatingPosition,
}: Props) {
  const l1 = telemetry.currentL1 || 0;
  const l2 = telemetry.currentL2 || 0;
  const l3 = telemetry.currentL3 || 0;
  const v1 = telemetry.voltageL1 || 230.0;
  const v2 = telemetry.voltageL2 || 230.0;
  const v3 = telemetry.voltageL3 || 230.0;
  const kw = telemetry.activePowerKw || 0;

  const maxPhase = Math.max(l1, l2, l3);
  const minPhase = Math.min(l1, l2, l3);
  const unbalanceAmps = telemetry.unbalanceAmps !== undefined ? telemetry.unbalanceAmps : Math.round((maxPhase - minPhase) * 10) / 10;
  const isUnbalanced = telemetry.isUnbalanced !== undefined ? telemetry.isUnbalanced : unbalanceAmps > 16.0;

  const getPhaseLoadColor = (amps: number) => {
    const pct = (amps / maxAmps) * 100;
    if (pct > 85) return "from-red-500 to-red-600 text-red-400";
    if (pct >= 60) return "from-amber-500 to-amber-600 text-amber-400";
    return "from-emerald-500 to-emerald-600 text-emerald-400";
  };

  const getPhaseTrackColor = (amps: number) => {
    const pct = (amps / maxAmps) * 100;
    if (pct > 85) return "bg-red-500/20 border-red-500/30";
    if (pct >= 60) return "bg-amber-500/20 border-amber-500/30";
    return "bg-emerald-500/20 border-emerald-500/30";
  };

  const containerStyle: React.CSSProperties = floatingPosition
    ? {
        position: "absolute",
        left: `${Math.min(Math.max(10, floatingPosition.x + 15), 650)}px`,
        top: `${Math.min(Math.max(10, floatingPosition.y - 40), 400)}px`,
        zIndex: 50,
      }
    : {};

  return (
    <div
      style={containerStyle}
      className="w-80 rounded-xl bg-[#14171c]/95 border border-white/15 p-4 shadow-2xl backdrop-blur-md text-white animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-[#54a8c7]/20 flex items-center justify-center text-[#54a8c7]">
            <Gauge className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              {title || telemetry.name || "Phase Inspector"}
            </h4>
            {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="size-5 rounded hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Active Power</span>
            <span className="text-sm font-bold text-white font-mono">{kw.toFixed(1)} kW</span>
          </div>
          <Zap className="size-4 text-amber-400" />
        </div>

        <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Phase $\Delta I$</span>
            <span className="text-sm font-bold font-mono text-slate-200">{unbalanceAmps.toFixed(1)} A</span>
          </div>
          <Activity className="size-4 text-[#54a8c7]" />
        </div>
      </div>

      {/* 3-Phase Amperage Gauges */}
      <div className="space-y-2 mb-3">
        {/* Phase L1 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold font-mono flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_rgba(34,211,238,0.6)]"></span>
              Phase L1
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[10px]">{v1.toFixed(0)}V</span>
              <span className="font-bold font-mono text-white">{l1.toFixed(1)} A</span>
              <span className="text-slate-500 text-[10px]">({Math.min(100, Math.round((l1 / maxAmps) * 100))}%)</span>
            </div>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full bg-gradient-to-r ${getPhaseLoadColor(l1)} transition-all duration-300`}
              style={{ width: `${Math.min(100, (l1 / maxAmps) * 100)}%` }}
            />
          </div>
        </div>

        {/* Phase L2 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold font-mono flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.6)]"></span>
              Phase L2
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[10px]">{v2.toFixed(0)}V</span>
              <span className="font-bold font-mono text-white">{l2.toFixed(1)} A</span>
              <span className="text-slate-500 text-[10px]">({Math.min(100, Math.round((l2 / maxAmps) * 100))}%)</span>
            </div>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full bg-gradient-to-r ${getPhaseLoadColor(l2)} transition-all duration-300`}
              style={{ width: `${Math.min(100, (l2 / maxAmps) * 100)}%` }}
            />
          </div>
        </div>

        {/* Phase L3 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold font-mono flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.6)]"></span>
              Phase L3
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[10px]">{v3.toFixed(0)}V</span>
              <span className="font-bold font-mono text-white">{l3.toFixed(1)} A</span>
              <span className="text-slate-500 text-[10px]">({Math.min(100, Math.round((l3 / maxAmps) * 100))}%)</span>
            </div>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full bg-gradient-to-r ${getPhaseLoadColor(l3)} transition-all duration-300`}
              style={{ width: `${Math.min(100, (l3 / maxAmps) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Balance Status Footer */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
        <span className="text-slate-400">Rated Cable: {maxAmps}A (3-Phase)</span>
        {isUnbalanced ? (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] py-0">
            <AlertTriangle className="size-2.5 mr-1" />
            Phase Asymmetry
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] py-0">
            <CheckCircle2 className="size-2.5 mr-1" />
            Balanced Load
          </Badge>
        )}
      </div>
    </div>
  );
}
