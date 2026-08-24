"use client";

import React, { useEffect, useState } from 'react';
import { Sun, Battery, Home, Zap, ArrowRightLeft } from 'lucide-react';

interface Telemetry {
  solar_kw: number;
  battery_kw: number;
  grid_kw: number;
  house_kw: number;
}

interface EnergyFlowProps {
  telemetry: Telemetry;
  chargersPower: number;
}

interface FlowSegment {
  id: string;
  path: string;
  color: string;
  power: number;
  normalIsPositive: boolean;
}

export function EnergyFlow({ telemetry, chargersPower }: EnergyFlowProps) {
  const [activeSegments, setActiveSegments] = useState<FlowSegment[]>([]);

  const formatPowerSimple = (powerKw: number) => {
    const absPowerW = Math.abs(powerKw * 1000);
    if (absPowerW < 1000) {
      return `${Math.round(absPowerW)} W`;
    }
    const valKw = (absPowerW / 1000).toFixed(1);
    return `${valKw} kW`;
  };

  const totalLoad = telemetry.house_kw + chargersPower;

  useEffect(() => {
    const solarGen = telemetry.solar_kw * 1000;
    const batteryPwr = telemetry.battery_kw * 1000;
    const gridPwr = telemetry.grid_kw * 1000;
    const houseLoad = telemetry.house_kw * 1000;
    const evLoad = chargersPower * 1000;

    let remainingSolar = Math.max(0, solarGen);
    let remainingBatteryDischarge = Math.max(0, batteryPwr);
    let remainingGridImport = Math.max(0, gridPwr);

    let homeLoadRemaining = Math.max(0, houseLoad);
    let evLoadRemaining = Math.max(0, evLoad);
    let batteryChargeRemaining = Math.max(0, -batteryPwr);
    let gridExportRemaining = Math.max(0, -gridPwr);

    const segments: FlowSegment[] = [];

    const addSegment = (source: string, target: string, power: number, color: string) => {
      if (power <= 0) return;
      let path = '';

      if (source === 'solar') {
        if (target === 'home') path = 'M 50 20 C 50 45, 55 45, 85 45';
        if (target === 'grid') path = 'M 50 20 C 50 48, 45 48, 15 48';
        if (target === 'battery') path = 'M 50 20 L 50 80';
        if (target === 'ev') path = 'M 50 20 C 50 80, 50 80, 85 80';
      } else if (source === 'battery') {
        if (target === 'home') path = 'M 50 80 C 50 55, 55 55, 85 55';
        if (target === 'grid') path = 'M 50 80 C 50 52, 45 52, 15 52';
        if (target === 'ev') path = 'M 50 80 L 85 80';
      } else if (source === 'grid') {
        if (target === 'home') path = 'M 15 50 L 85 50';
        if (target === 'battery') path = 'M 15 52 C 45 52, 45 52, 50 80';
        if (target === 'ev') path = 'M 15 50 C 45 50, 45 80, 85 80';
      }

      if (path) {
        segments.push({ id: `${source}-${target}`, path, color, power, normalIsPositive: true });
      }
    };

    // 1. Solar fulfills loads first
    if (remainingSolar > 0) {
      const solarToHome = Math.min(remainingSolar, homeLoadRemaining);
      if (solarToHome > 0) { addSegment('solar', 'home', solarToHome, '#fab758'); remainingSolar -= solarToHome; homeLoadRemaining -= solarToHome; }
      const solarToEV = Math.min(remainingSolar, evLoadRemaining);
      if (solarToEV > 0) { addSegment('solar', 'ev', solarToEV, '#fab758'); remainingSolar -= solarToEV; evLoadRemaining -= solarToEV; }
      const solarToBattery = Math.min(remainingSolar, batteryChargeRemaining);
      if (solarToBattery > 0) { addSegment('solar', 'battery', solarToBattery, '#fab758'); remainingSolar -= solarToBattery; batteryChargeRemaining -= solarToBattery; }
      const solarToGrid = Math.min(remainingSolar, gridExportRemaining);
      if (solarToGrid > 0) { addSegment('solar', 'grid', solarToGrid, '#fab758'); remainingSolar -= solarToGrid; gridExportRemaining -= solarToGrid; }
    }

    // 2. Battery fulfills remaining loads
    if (remainingBatteryDischarge > 0) {
      const batteryToHome = Math.min(remainingBatteryDischarge, homeLoadRemaining);
      if (batteryToHome > 0) { addSegment('battery', 'home', batteryToHome, '#45c4a0'); remainingBatteryDischarge -= batteryToHome; homeLoadRemaining -= batteryToHome; }
      const batteryToEV = Math.min(remainingBatteryDischarge, evLoadRemaining);
      if (batteryToEV > 0) { addSegment('battery', 'ev', batteryToEV, '#45c4a0'); remainingBatteryDischarge -= batteryToEV; evLoadRemaining -= batteryToEV; }
      const batteryToGrid = Math.min(remainingBatteryDischarge, gridExportRemaining);
      if (batteryToGrid > 0) { addSegment('battery', 'grid', batteryToGrid, '#45c4a0'); remainingBatteryDischarge -= batteryToGrid; gridExportRemaining -= batteryToGrid; }
    }

    // 3. Grid fulfills any remaining loads
    if (remainingGridImport > 0) {
      const gridToHome = Math.min(remainingGridImport, homeLoadRemaining);
      if (gridToHome > 0) { addSegment('grid', 'home', gridToHome, '#54a8c7'); remainingGridImport -= gridToHome; homeLoadRemaining -= gridToHome; }
      const gridToEV = Math.min(remainingGridImport, evLoadRemaining);
      if (gridToEV > 0) { addSegment('grid', 'ev', gridToEV, '#54a8c7'); remainingGridImport -= gridToEV; evLoadRemaining -= gridToEV; }
      const gridToBattery = Math.min(remainingGridImport, batteryChargeRemaining);
      if (gridToBattery > 0) { addSegment('grid', 'battery', gridToBattery, '#54a8c7'); remainingGridImport -= gridToBattery; batteryChargeRemaining -= gridToBattery; }
    }

    setActiveSegments(segments);
  }, [telemetry, chargersPower]);

  const getFlowStyle = (power: number, normalIsPositive: boolean) => {
    let speed = 3;
    if (power > 0) {
      speed = Math.max(0.5, 3 - (power / 5000) * 2.5);
    }
    const direction = normalIsPositive ? 'normal' : 'reverse';
    return {
      animation: `flow ${speed}s linear infinite ${direction}`
    };
  };

  return (
    <div className="w-full flex justify-center items-center">
      <div className="relative w-full h-[460px] bg-card rounded-2xl shadow-sandbox overflow-hidden border border-border/70">

        <style>{`
          .flow-dot {
            animation: flow linear infinite;
          }
          @keyframes flow {
            from { stroke-dashoffset: 200; }
            to { stroke-dashoffset: 0; }
          }
        `}</style>

        {/* SVG paths for animated power flow lines */}
        <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Static Background Lines */}
          <path d="M 15 50 L 85 50" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 20 C 50 45, 55 45, 85 45" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 20 C 50 48, 45 48, 15 48" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 80 C 50 55, 55 55, 85 55" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 15 52 C 45 52, 45 52, 50 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 85 50 L 85 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 20 L 50 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 20 C 50 80, 50 80, 85 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 50 80 L 85 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />
          <path d="M 15 50 C 45 50, 45 80, 85 80" vectorEffect="non-scaling-stroke" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-15" />

          {/* Active Flow lines */}
          {activeSegments.map(segment => (
            <path
              key={segment.id}
              d={segment.path}
              strokeLinecap="round"
              fill="none"
              stroke={segment.color}
              strokeWidth="6"
              strokeDasharray="0.1 200"
              className="flow-dot"
              vectorEffect="non-scaling-stroke"
              style={getFlowStyle(segment.power, segment.normalIsPositive)}
            />
          ))}
        </svg>

        {/* Grid Layout for Nodes */}
        <div className="absolute inset-0">

          {/* Grid (Left) */}
          <div className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2" style={{ left: '15%', top: '50%' }}>
            <div className="z-10 flex flex-col items-center justify-center size-28 bg-card rounded-3xl border-2 border-[#54a8c7] shadow-lg relative backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 absolute -top-6">Grid Connection</span>
              <ArrowRightLeft className="size-7 text-[#54a8c7] mb-1" />
              <div className="text-xs font-bold flex flex-col items-center leading-tight">
                <span className="text-emerald-500">
                  {telemetry.grid_kw < 0 ? `Export: ${formatPowerSimple(Math.abs(telemetry.grid_kw))}` : ''}
                </span>
                <span className="text-[#54a8c7]">
                  {telemetry.grid_kw >= 0 ? `Import: ${formatPowerSimple(telemetry.grid_kw)}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Battery (Bottom Center) */}
          <div className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '80%' }}>
            <div className="z-10 flex flex-col items-center justify-center size-28 bg-card rounded-3xl border-2 border-[#45c4a0] shadow-lg relative backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 absolute -bottom-6">BESS Storage</span>
              <Battery className="size-7 text-[#45c4a0] mb-1" />
              <div className="text-xs font-bold flex flex-col items-center leading-tight">
                <span className="text-[#45c4a0]">
                  {telemetry.battery_kw !== 0 ? formatPowerSimple(Math.abs(telemetry.battery_kw)) : '0 W (Idle)'}
                </span>
              </div>
            </div>
          </div>

          {/* Home (Right) */}
          <div className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2" style={{ left: '85%', top: '50%' }}>
            <div className="z-10 flex flex-col items-center justify-center size-28 bg-card rounded-3xl border-2 border-foreground/30 shadow-lg relative backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 absolute -top-6">Site Base Load</span>
              <Home className="size-7 text-foreground mb-1" />
              <div className="text-foreground text-xs font-bold">
                {formatPowerSimple(telemetry.house_kw)}
              </div>
            </div>
          </div>

          {/* Solar (Top Center) */}
          <div className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '20%' }}>
            <div className="z-10 flex flex-col items-center justify-center size-28 bg-card rounded-3xl border-2 border-[#fab758] shadow-lg relative backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 absolute -top-6">Solar PV</span>
              <Sun className="size-7 text-[#fab758] mb-1" />
              <div className="text-foreground text-xs font-bold">
                {formatPowerSimple(telemetry.solar_kw)}
              </div>
            </div>
          </div>

          {/* EV Charger (Bottom Right) */}
          <div className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2" style={{ left: '85%', top: '80%' }}>
            <div className="z-10 flex flex-col items-center justify-center size-28 bg-card rounded-3xl border-2 border-[#747ed1] shadow-lg relative backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 absolute -bottom-6">EV Fleet Load</span>
              <Zap className="size-7 text-[#747ed1] mb-1" />
              <div className="text-foreground text-xs font-bold flex flex-col items-center">
                <span>{formatPowerSimple(chargersPower)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
