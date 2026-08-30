"use client";

import React, { useEffect, useState } from "react";
import { Zap, BatteryCharging, AlertCircle, CheckCircle2, CalendarRange, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

interface OverviewMetrics {
  totalChargers: number;
  activeSessions: number;
  energyToday: number;
  revenueToday: number;
}

export default function MobileDashboard() {
  const sessions = useTelemetryStore((state) => state.sessions);
  const isSessionsLoading = useTelemetryStore((state) => state.isSessionsLoading);
  const fetchSessions = useTelemetryStore((state) => state.fetchSessions);

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const fetchOverview = async () => {
      try {
        const response = await api.get('/dashboard/overview');
        setMetrics(response.data);
      } catch (error) {
        logger.error('Failed to fetch overview metrics', error);
      } finally {
        setIsMetricsLoading(false);
      }
    };
    fetchOverview();

    const interval = setInterval(() => {
      fetchSessions();
      fetchOverview();
    }, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const kpis = [
    { label: "Active Sessions", value: metrics?.activeSessions || 0, icon: BatteryCharging, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Total Chargers", value: metrics?.totalChargers || 0, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    { label: "Energy Today", value: `${((metrics?.energyToday || 0) / 1000).toFixed(2)} kWh`, icon: Zap, color: "text-yellow-500", bg: "bg-yellow-50" },
    { label: "Revenue Today", value: `€${metrics?.revenueToday?.toFixed(2) || 0}`, icon: Zap, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* KPIs Grid */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col space-y-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${kpi.bg}`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{isMetricsLoading ? '-' : kpi.value}</div>
                  <div className="text-xs text-gray-500 font-medium">{kpi.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scheduled Charging Quick Widget */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Scheduled Charging</h2>
          <Link href="/mobile/schedule" className="text-xs text-primary font-semibold hover:underline">
            Manage
          </Link>
        </div>
        <Link
          href="/mobile/schedule"
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-primary/40 transition-colors block"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarRange className="size-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">Smart Charging Schedules</div>
              <div className="text-xs text-gray-500 mt-0.5">Automated off-peak night windows active</div>
            </div>
          </div>
          <ChevronRight className="size-5 text-gray-400" />
        </Link>
      </section>

      {/* Live Sessions List */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Live Sessions</h2>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{sessions.length} Active</span>
        </div>

        {isSessionsLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground">Loading...</div>
        ) : sessions.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500 text-sm">
                No active sessions currently.
            </div>
        ) : (
            <div className="space-y-3">
            {sessions.map((session, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                    <div className="font-semibold text-gray-900">{session.chargerName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Session #{session.transactionId} - {session.connectorName}</div>
                    </div>
                    <div className="text-right">
                    <div className="font-medium text-blue-600">{session.currentPower > 0 ? `${(session.currentPower / 1000).toFixed(2)} kW` : '-'}</div>
                    <div className="text-xs text-primary mt-0.5">{session.energyConsumed > 0 ? `${(session.energyConsumed / 1000).toFixed(2)} kWh` : 'Starting...'}</div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
      </section>
    </div>
  );
}
