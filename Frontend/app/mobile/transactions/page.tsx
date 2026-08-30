"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, History, Zap, Clock, CreditCard, ChevronRight, RefreshCw, BatteryCharging, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TransactionItem {
  id?: number;
  transaction_id?: number | string;
  transactionId?: string;
  charger_id: number;
  charger?: {
    charger_id: number;
    name?: string;
    charge_point_vendor?: string;
    charge_point_model?: string;
    location?: string;
  };
  connectorName?: string;
  startTime: string;
  stopTime?: string | null;
  meterStart?: number;
  meterStop?: number;
  initialMeterValue?: number;
  consumedEnergy?: number;
  totalCost?: number | null;
  status: string;
  idTag?: string | null;
  rfidUser?: {
    name?: string;
    rfid_tag?: string;
  } | null;
}

export default function MobileTransactions() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTxId, setExpandedTxId] = useState<string | number | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await api.get('/transactions', {
        params: {
          search: searchQuery || undefined,
          limit: 50,
        }
      });
      const data = response.data?.data?.transactions || response.data?.transactions || response.data || [];
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error("Failed to fetch mobile transactions", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const filters = ["All", "Charging", "Completed", "Faulted"];

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'charging' || s === 'active' || s === 'in_progress') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1 text-[10px] font-semibold py-0.5 px-2">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Charging
        </Badge>
      );
    }
    if (s === 'completed' || s === 'stopped' || s === 'finished') {
      return (
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-semibold py-0.5 px-2">
          Completed
        </Badge>
      );
    }
    if (s === 'faulted' || s === 'rejected' || s === 'error') {
      return (
        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-semibold py-0.5 px-2">
          Faulted
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] py-0.5 px-2">
        {status || 'Unknown'}
      </Badge>
    );
  };

  const filteredTransactions = transactions.filter((tx) => {
    const s = tx.status?.toLowerCase() || '';
    if (activeFilter === "All") return true;
    if (activeFilter === "Charging") return s === "charging" || s === "active" || s === "in_progress";
    if (activeFilter === "Completed") return s === "completed" || s === "stopped" || s === "finished";
    if (activeFilter === "Faulted") return s === "faulted" || s === "rejected" || s === "error";
    return true;
  });

  // Calculate summary metrics
  const totalSessions = transactions.length;
  const activeCount = transactions.filter(t => (t.status?.toLowerCase() === 'charging' || t.status?.toLowerCase() === 'active')).length;
  const totalKwh = transactions.reduce((acc, t) => {
    const kwh = t.consumedEnergy ? t.consumedEnergy / 1000 : ((t.meterStop || 0) - (t.meterStart || t.initialMeterValue || 0)) / 1000;
    return acc + (kwh > 0 ? kwh : 0);
  }, 0);
  const totalCostSum = transactions.reduce((acc, t) => acc + (t.totalCost || 0), 0);

  const formatDuration = (startStr: string, stopStr?: string | null) => {
    if (!startStr) return "-";
    const start = new Date(startStr).getTime();
    const end = stopStr ? new Date(stopStr).getTime() : Date.now();
    const diffMins = Math.floor((end - start) / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  const calculateKwh = (tx: TransactionItem) => {
    if (tx.consumedEnergy && tx.consumedEnergy > 0) {
      return (tx.consumedEnergy / 1000).toFixed(2);
    }
    const start = tx.initialMeterValue || tx.meterStart || 0;
    const stop = tx.meterStop || 0;
    if (stop > start) {
      return ((stop - start) / 1000).toFixed(2);
    }
    return "0.00";
  };

  return (
    <div className="flex flex-col h-full space-y-4 pb-20">
      {/* Search Bar & Refresh Header */}
      <div className="px-4 pt-4 pb-2 bg-background sticky top-0 z-10 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID, badge or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 rounded-xl bg-card border-border shrink-0"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-card border border-border/80 p-2.5 rounded-xl text-center shadow-2xs">
            <span className="text-[10px] text-muted-foreground font-medium block">Total Fleet Sessions</span>
            <span className="text-sm font-bold text-foreground">{totalSessions}</span>
          </div>
          <div className="bg-card border border-border/80 p-2.5 rounded-xl text-center shadow-2xs">
            <span className="text-[10px] text-muted-foreground font-medium block">Total Energy</span>
            <span className="text-sm font-bold text-primary">{totalKwh.toFixed(1)} kWh</span>
          </div>
          <div className="bg-card border border-border/80 p-2.5 rounded-xl text-center shadow-2xs">
            <span className="text-[10px] text-muted-foreground font-medium block">Active Charging</span>
            <span className="text-sm font-bold text-emerald-500">{activeCount} Live</span>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-4 overflow-x-auto whitespace-nowrap hide-scrollbar flex space-x-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeFilter === filter
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card text-muted-foreground border border-border hover:bg-muted"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            <p className="text-xs">Loading charging history...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-card p-8 rounded-2xl border border-border/80 text-center space-y-2">
            <History className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <p className="font-semibold text-foreground text-sm">No Transactions Found</p>
            <p className="text-xs text-muted-foreground">
              There are no session records matching the selected filter for your chargers.
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const txId = tx.transaction_id || tx.transactionId || tx.id || "N/A";
            const isExpanded = expandedTxId === txId;
            const kwh = calculateKwh(tx);
            const duration = formatDuration(tx.startTime, tx.stopTime);
            const chargerName = tx.charger?.name || `Charger #${tx.charger_id}`;
            const connector = tx.connectorName || "Channel 1";
            const badgeTag = tx.rfidUser?.name || tx.idTag || "Autostart / Free Vend";

            return (
              <div
                key={String(txId)}
                onClick={() => setExpandedTxId(isExpanded ? null : txId)}
                className="bg-card p-4 rounded-2xl shadow-2xs border border-border/80 hover:border-primary/40 active:bg-muted/40 transition-all cursor-pointer space-y-3"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm text-foreground">{chargerName}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{connector}</span>
                      <span>•</span>
                      <span>#{txId}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(tx.status)}</div>
                </div>

                {/* Main Metrics Row */}
                <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Zap className="size-3 text-amber-500" />
                      Energy
                    </span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block">{kwh} kWh</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-blue-500" />
                      Duration
                    </span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block">{duration}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CreditCard className="size-3 text-emerald-500" />
                      Total Cost
                    </span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block">
                      {tx.totalCost !== null && tx.totalCost !== undefined ? `€${Number(tx.totalCost).toFixed(2)}` : "€0.00"}
                    </span>
                  </div>
                </div>

                {/* Additional Details on Tap */}
                {isExpanded && (
                  <div className="pt-2 border-t border-border/60 space-y-2 text-xs text-muted-foreground animate-in fade-in duration-200">
                    <div className="flex justify-between">
                      <span>Auth Tag / Driver:</span>
                      <span className="font-semibold text-foreground">{badgeTag}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Start Time:</span>
                      <span className="font-medium text-foreground">{new Date(tx.startTime).toLocaleString()}</span>
                    </div>
                    {tx.stopTime && (
                      <div className="flex justify-between">
                        <span>Stop Time:</span>
                        <span className="font-medium text-foreground">{new Date(tx.stopTime).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Initial Meter:</span>
                      <span className="font-mono text-foreground">{(tx.initialMeterValue || tx.meterStart || 0) / 1000} kWh</span>
                    </div>
                    {tx.meterStop && (
                      <div className="flex justify-between">
                        <span>Final Meter:</span>
                        <span className="font-mono text-foreground">{(tx.meterStop) / 1000} kWh</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tap to expand hint */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-1">
                  <span>{new Date(tx.startTime).toLocaleDateString()}</span>
                  <span className="flex items-center text-[10px] text-primary font-medium gap-0.5">
                    {isExpanded ? "Show Less" : "Details"}
                    <ChevronRight className={`size-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
