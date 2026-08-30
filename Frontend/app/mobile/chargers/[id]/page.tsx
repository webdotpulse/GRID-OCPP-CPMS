"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, MapPin, Zap, Info, Clock, CheckCircle, RefreshCw, Send, Play, Square, Settings2, CalendarRange, ChevronRight } from "lucide-react";
import { MobileSpeedOverride } from "@/components/chargers/MobileSpeedOverride";
import { ConnectorList } from "@/components/chargers/ConnectorList";
import { RemoteControlPanel } from "@/components/chargers/RemoteControlPanel";
import { toast } from "sonner";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from "@/hooks/useAuth";

export default function MobileChargerDetails() {
  const { user } = useAuth();
  const { id } = useParams();
  const [charger, setCharger] = useState<any>(null);
  const [isCommandLoading, setIsCommandLoading] = useState(false);
  const [activeTxns, setActiveTxns] = useState<any[]>([]);

  const fetchActiveTxns = useCallback(async () => {
    if (!charger?.charger_id) return;
    try {
      const response = await api.get('/dashboard/live-sessions');
      const sessions = response.data.filter((s: any) => s.chargerId === charger.charger_id);
      setActiveTxns(sessions);
    } catch (err) {
      toast.error("Failed to fetch active transactions");
    }
  }, [charger?.charger_id]);

  useEffect(() => {
    fetchActiveTxns();
    const interval = setInterval(fetchActiveTxns, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveTxns]);

  const sendCommand = async (command: string, extraData: any = {}) => {
    setIsCommandLoading(true);
    try {
      await api.post(`/ocpp/${command}`, {
        chargerId: charger.charger_id,
        ...extraData
      });
      toast.success(`${command.replace('-', ' ')} command sent`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to send ${command} command`);
    } finally {
      setIsCommandLoading(false);
    }
  };
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharger = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/chargers/${id}`);
      setCharger(response.data);
    } catch (err) {
      logger.error("Failed to fetch charger details", err);
      setError("Failed to load charger details.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCharger();
  }, [fetchCharger]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
         {/* Header */}
         <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
          <Link href="/mobile/chargers" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="ml-2 font-semibold text-lg flex-1">Loading...</div>
        </div>
        <div className="p-4 flex justify-center text-gray-500">
           Loading charger details...
        </div>
      </div>
    );
  }

  if (error || !charger) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
          <Link href="/mobile/chargers" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="ml-2 font-semibold text-lg flex-1">Error</div>
        </div>
        <div className="p-4 flex justify-center text-red-500">
           {error || "Charger not found."}
        </div>
      </div>
    );
  }

  const getDisplayStatus = (charger: any) => {
    const s = charger.status?.toLowerCase() || '';
    if (charger.active_sessions > 0) return "Charging";
    if (s === 'online' || s === 'active') return "Available";
    if (s === 'faulted') return "Faulted";
    return "Offline";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available": return "bg-green-500";
      case "Charging": return "bg-blue-500";
      case "Faulted": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const displayStatus = getDisplayStatus(charger);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
        <Link href="/mobile/chargers" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="ml-2 flex-1">
           <h1 className="font-semibold text-lg text-gray-900 truncate leading-tight">{charger.name}</h1>
           <div className="text-xs text-gray-500 font-mono">{charger.charger_id}</div>
        </div>
        <div className="flex items-center space-x-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100 shrink-0">
          <span className={`w-2 h-2 rounded-full ${getStatusColor(displayStatus)}`}></span>
          <span className="text-[10px] font-medium text-gray-700 uppercase tracking-wider">{displayStatus}</span>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* OCPP Remote Controls */}
        {charger.status !== 'offline' && (user?.role === 'admin' || user?.role === 'superadmin') && (
          <div className="mb-6">
            <RemoteControlPanel chargerId={charger.charger_id} hideTriggerMessage={true} />
          </div>
        )}

        {/* Manual Speed Override */}
        {charger.status !== 'offline' && (user?.role === 'admin' || user?.role === 'superadmin') && (
          <MobileSpeedOverride chargerId={charger.charger_id} currentPower={activeTxns[0]?.currentPower || 0} />
        )}

        {/* Scheduled Charging Quick Card */}
        <Link
          href="/mobile/schedule"
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-primary/40 transition-colors block"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarRange className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Scheduled Charging</h3>
              <p className="text-xs text-gray-500">Configure off-peak night windows & presets</p>
            </div>
          </div>
          <ChevronRight className="size-5 text-gray-400" />
        </Link>

        {/* Connectors */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Settings2 className="w-4 h-4 mr-1.5 text-gray-500" /> Connectors
          </h3>
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
             <ConnectorList
               connectors={charger.evses?.flatMap((e: any) => e.connectors?.map((c: any) => ({ ...c, charger_id: charger.charger_id }))) || []}
               readOnly={true}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
