"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { EnergyFlow } from './EnergyFlow';
import { EnergyHistoryChart } from './EnergyHistoryChart';
import { Loader2, ArrowRightLeft, Sun, Battery, Zap, Activity, Radio, Sparkles } from "lucide-react";
import { Badge } from '@/components/ui/badge';

interface EmsTelemetry {
  gateway_id: string;
  solar_kw: number;
  battery_kw: number;
  grid_kw: number;
  house_kw: number;
  timestamp: string;
}

export function EmsDashboard() {
  const [telemetry, setTelemetry] = useState<EmsTelemetry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(null);
  const [chargersPower, setChargersPower] = useState(0);

  const fetchTelemetry = async () => {
    try {
      const response = await api.get('/dashboard/ems-telemetry');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setTelemetry(response.data);
        if (!activeGatewayId) {
          setActiveGatewayId(response.data[0].gateway_id);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch EMS telemetry', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLoad = async () => {
    try {
      const res = await api.get('/dashboard/load');
      if (res.data !== undefined && res.data) {
        const load = res.data.reduce((sum: number, item: any) => sum + (item.currentLoad || 0), 0);
        setChargersPower(load);
      }
    } catch (err) {
      console.error("Failed to fetch chargers load", err);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchLoad();
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchLoad();
    }, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <div className="size-8 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-medium">Connecting to EMS Telemetry Gateway...</span>
      </div>
    );
  }

  if (telemetry.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center h-64 text-center p-6 gap-2">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-1">
            <Activity className="size-6" />
          </div>
          <p className="text-foreground font-bold text-base">No EMS Gateways Linked</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Register an EMS Gateway hardware device to stream real-time PV generation, battery storage, and dynamic load telemetry.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeTelemetry = telemetry.find(t => t.gateway_id === activeGatewayId) || telemetry[0];
  const totalLoad = activeTelemetry.house_kw + chargersPower;

  return (
    <div className="space-y-6">
      {telemetry.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {telemetry.map(t => (
            <button
              key={t.gateway_id}
              onClick={() => setActiveGatewayId(t.gateway_id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeGatewayId === t.gateway_id
                  ? 'bg-[#54a8c7] text-white shadow-md shadow-[#54a8c7]/20'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/70'
              }`}
            >
              Gateway {t.gateway_id.substring(0, 8)}
            </button>
          ))}
        </div>
      )}

      {/* Energy Flow Visualization */}
      <div className="rounded-2xl overflow-hidden shadow-sandbox">
        <EnergyFlow telemetry={activeTelemetry} chargersPower={chargersPower} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Grid Power Card */}
        <Card hoverLift className="card-border-top-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="size-11 rounded-2xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <ArrowRightLeft className="size-5.5" />
              </div>
              <Badge
                variant={activeTelemetry.grid_kw > 0 ? 'soft-danger' : activeTelemetry.grid_kw < 0 ? 'soft-success' : 'soft-secondary'}
                className="text-[10px] font-bold"
              >
                {activeTelemetry.grid_kw > 0 ? 'Importing' : activeTelemetry.grid_kw < 0 ? 'Exporting' : 'Idle'}
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grid Power</p>
            <div className="text-2xl font-heading font-extrabold tracking-tight text-foreground mt-1">
              {Math.abs(activeTelemetry.grid_kw * 1000).toFixed(0)} W
            </div>
          </CardContent>
        </Card>

        {/* Solar Power Card */}
        <Card hoverLift>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="size-11 rounded-2xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <Sun className="size-5.5" />
              </div>
              <Badge variant="soft-warning" className="text-[10px] font-bold">
                Producing
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solar Generation</p>
            <div className="text-2xl font-heading font-extrabold tracking-tight text-foreground mt-1">
              {(activeTelemetry.solar_kw * 1000).toFixed(0)} W
            </div>
          </CardContent>
        </Card>

        {/* Battery Power Card */}
        <Card hoverLift className="card-border-top-success">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="size-11 rounded-2xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
                <Battery className="size-5.5" />
              </div>
              <Badge
                variant={activeTelemetry.battery_kw > 0 ? 'soft-primary' : activeTelemetry.battery_kw < 0 ? 'soft-success' : 'soft-secondary'}
                className="text-[10px] font-bold"
              >
                {activeTelemetry.battery_kw > 0 ? 'Discharging' : activeTelemetry.battery_kw < 0 ? 'Charging' : 'Idle'}
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage Battery</p>
            <div className="text-2xl font-heading font-extrabold tracking-tight text-foreground mt-1">
              {Math.abs(activeTelemetry.battery_kw * 1000).toFixed(0)} W
            </div>
          </CardContent>
        </Card>

        {/* Total Load Card */}
        <Card hoverLift>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="size-11 rounded-2xl bg-[#747ed1]/15 text-[#747ed1] flex items-center justify-center">
                <Zap className="size-5.5" />
              </div>
              <Badge variant="soft-purple" className="text-[10px] font-bold">
                Consuming
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Total Load</p>
            <div className="text-2xl font-heading font-extrabold tracking-tight text-foreground mt-1">
              {(totalLoad * 1000).toFixed(0)} W
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 24-Hour Historical Profile */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>24-Hour Energy Profile</CardTitle>
              <CardDescription>Historical overlay of PV generation vs. site & EV load consumption</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              Live Interval 5s
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[380px] p-4 pt-0">
          <EnergyHistoryChart gatewayId={activeTelemetry.gateway_id} />
        </CardContent>
      </Card>
    </div>
  );
}
