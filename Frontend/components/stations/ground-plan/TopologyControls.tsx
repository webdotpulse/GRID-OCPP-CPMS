"use client";

import React from "react";
import { ViewMode, WiringMode, StationTopologyData } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Zap,
  Cable,
  Building,
  AlertTriangle,
  Activity,
  Plus,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  topologyData?: StationTopologyData | null;
  onAddTransformer?: () => void;
  onAddDistributionBoard?: () => void;
  onStartWiring?: () => void;
  wiringMode?: WiringMode;
  isEditMode?: boolean;
}

export function TopologyControls({
  viewMode,
  onViewModeChange,
  topologyData,
  onAddTransformer,
  onAddDistributionBoard,
  onStartWiring,
  wiringMode = "idle",
  isEditMode = false,
}: Props) {
  const activePower = topologyData?.activePowerKw || 0;
  const maxPower = topologyData?.maxPowerKw || 250;
  const gridUtilization = maxPower > 0 ? Math.round((activePower / maxPower) * 100) : 0;
  const bottleneckCount = topologyData?.feeders?.filter((f) => f.loadLevel === "critical").length || 0;
  const isUnbalanced = topologyData?.isStationUnbalanced || false;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#1e2228]/90 border border-white/10 shadow-lg backdrop-blur-md">
      {/* View Mode Switcher */}
      <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg border border-white/5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange("hybrid")}
          className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
            viewMode === "hybrid"
              ? "bg-[#54a8c7] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Layers className="size-3.5 mr-1.5" />
          Hybrid
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange("topology")}
          className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
            viewMode === "topology"
              ? "bg-[#54a8c7] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Zap className="size-3.5 mr-1.5 text-amber-300" />
          Topology
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange("architectural")}
          className={`h-7 px-2.5 text-xs font-semibold rounded-md ${
            viewMode === "architectural"
              ? "bg-[#54a8c7] text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Building className="size-3.5 mr-1.5" />
          Layout
        </Button>
      </div>

      {/* Editor Node Palette (if in Builder Mode) */}
      {isEditMode && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTransformer}
            className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10 text-cyan-300"
          >
            <Plus className="size-3 mr-1" />
            + Transformer (⚡)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onAddDistributionBoard}
            className="h-7 text-xs bg-white/5 border-white/10 hover:bg-white/10 text-amber-300"
          >
            <Plus className="size-3 mr-1" />
            + Sub-Panel (🗄️)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onStartWiring}
            className={`h-7 text-xs ${
              wiringMode !== "idle"
                ? "bg-emerald-600 text-white border-emerald-500 animate-pulse"
                : "bg-white/5 border-white/10 hover:bg-white/10 text-emerald-400"
            }`}
          >
            <Cable className="size-3 mr-1" />
            {wiringMode === "select_source"
              ? "Click Source Node..."
              : wiringMode === "select_target"
              ? "Click Target Charger..."
              : "Connect Feeder Cable"}
          </Button>
        </div>
      )}

      {/* Live Electrical Status Badges */}
      <div className="flex items-center gap-2 text-xs">
        {/* Total Load */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
          <Zap className="size-3.5 text-amber-400" />
          <span className="text-slate-400">Total Load:</span>
          <span className="font-mono font-bold text-white">
            {activePower.toFixed(1)} / {maxPower} kW
          </span>
          <span
            className={`font-bold font-mono text-[11px] ml-1 ${
              gridUtilization > 85 ? "text-red-400" : gridUtilization >= 60 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            ({gridUtilization}%)
          </span>
        </div>

        {/* Bottlenecks Badge */}
        {bottleneckCount > 0 ? (
          <Badge className="bg-red-500/20 border-red-500/30 text-red-400 text-xs py-1">
            <AlertTriangle className="size-3 mr-1 animate-bounce" />
            {bottleneckCount} Cable Bottleneck
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-xs py-1">
            <ShieldCheck className="size-3 mr-1" />
            Cables Nominal
          </Badge>
        )}

        {/* Phase Balance Badge */}
        {isUnbalanced ? (
          <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-400 text-xs py-1">
            <Activity className="size-3 mr-1" />
            Phase $\Delta I$: {topologyData?.stationUnbalanceAmps.toFixed(1)}A
          </Badge>
        ) : (
          <Badge className="bg-cyan-500/15 border-cyan-500/30 text-cyan-400 text-xs py-1">
            <CheckCircle2 className="size-3 mr-1" />
            3-Phase Balanced
          </Badge>
        )}
      </div>
    </div>
  );
}
