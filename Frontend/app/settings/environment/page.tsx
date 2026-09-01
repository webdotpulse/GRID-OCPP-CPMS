"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Cpu,
  HardDrive,
  Database,
  Radio,
  Server,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  ChevronLeft,
  Download,
  Terminal,
  ShieldCheck,
  Globe,
  Layers,
  ArrowUpRight,
  Wifi,
  ExternalLink,
  Bot,
  Play,
  RotateCcw,
} from "lucide-react";

interface EnvironmentMetrics {
  status: "operational" | "degraded";
  timestamp: string;
  processingTimeMs: number;
  host: {
    hostname: string;
    platform: string;
    osRelease: string;
    osType: string;
    arch: string;
    nodeVersion: string;
    v8Version: string;
    pid: number;
    systemUptimeSeconds: number;
    systemUptimeFormatted: string;
    processUptimeSeconds: number;
    processUptimeFormatted: string;
    loadAverage: number[];
    timezone: string;
    environment: string;
    instanceId: string;
  };
  cpu: {
    overallUsagePercent: number;
    coreCount: number;
    model: string;
    speedMhz: number;
    cores: {
      core: number;
      model: string;
      speedMhz: number;
      usagePercent: number;
    }[];
  };
  memory: {
    totalSystemBytes: number;
    freeSystemBytes: number;
    usedSystemBytes: number;
    usedSystemPercent: number;
    processHeapUsedBytes: number;
    processHeapTotalBytes: number;
    processRssBytes: number;
    processExternalBytes: number;
    processArrayBuffersBytes: number;
    heapUsagePercent: number;
  };
  database: {
    status: "healthy" | "degraded" | "error";
    latencyMs: number;
    version: string;
    counts: {
      chargers: number;
      chargingStations: number;
      connectors: number;
      transactions: number;
      activeSessions: number;
      users: number;
      rfidUsers: number;
      companies: number;
      chargeGroups: number;
    };
  };
  redis: {
    status: "healthy" | "disconnected" | "disabled";
    latencyMs: number;
    version: string;
    usedMemoryHuman: string;
    connectedClients: number;
    uptimeDays: number;
    totalCommandsProcessed: number;
  };
  ocppServer: {
    status: string;
    port: number;
    apiPort: number;
    wsEndpoint16: string;
    wsEndpoint21: string;
    ocppLogsWsEndpoint: string;
    realtimeSocketEndpoint: string;
    supportedProtocols: string[];
    securityProfiles: string[];
    mtlsEnabled: boolean;
    heartbeatIntervalSeconds: number;
    offlineThresholdSeconds: number;
    activeConnectionsLocal: number;
    activeConnectionsCluster: number;
    connectedChargers: {
      chargerId: number;
      name: string;
      stationName: string;
      model: string;
      vendor: string;
      firmware: string;
      protocol: string;
      connectedAt: string;
      lastHeartbeat: string;
      activeTransactions: number;
      isLocal: boolean;
    }[];
  };
  subsystems: {
    name: string;
    key: string;
    status: string;
    description: string;
    interval?: string;
    path?: string;
  }[];
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function ServerEnvironmentPage() {
  const [metrics, setMetrics] = useState<EnvironmentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<string>("5000"); // 5s default
  const [activeTab, setActiveTab] = useState("overview");

  // Diagnostic Ping state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResults, setPingResults] = useState<any[] | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = useCallback(async (showLoader = false) => {
    if (showLoader) setIsRefreshing(true);
    try {
      const res = await api.get("/settings/environment");
      if (res.data?.success && res.data?.data) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      logger.error("Failed to fetch server environment metrics", err);
      toast.error("Failed to refresh server metrics");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMetrics(true);
  }, [fetchMetrics]);

  // Setup auto-refresh polling
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const intervalMs = parseInt(refreshInterval, 10);
    if (intervalMs > 0) {
      timerRef.current = setInterval(() => {
        fetchMetrics(false);
      }, intervalMs);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [refreshInterval, fetchMetrics]);

  // Run live diagnostic ping
  const handleRunPing = async () => {
    setIsPinging(true);
    try {
      const res = await api.post("/settings/environment/ping");
      if (res.data?.success && res.data?.data?.results) {
        setPingResults(res.data.data.results);
        toast.success("Diagnostic latency check complete");
      }
    } catch (err) {
      logger.error("Failed to run diagnostic ping", err);
      toast.error("Diagnostic ping failed");
    } finally {
      setIsPinging(false);
    }
  };

  // Export diagnostic report
  const handleExportReport = () => {
    if (!metrics) return;
    const reportData = {
      exportTimestamp: new Date().toISOString(),
      reportVersion: "1.0",
      systemStatus: metrics.status,
      metrics,
      diagnosticPing: pingResults,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GRID_Server_Health_Report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Diagnostic report downloaded successfully");
  };

  if (isLoading && !metrics) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted-foreground">
          <div className="size-10 border-3 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Gathering server environment telemetry...</span>
        </div>
      </AppShell>
    );
  }

  const isHealthy = metrics?.status === "operational";
  const cpuPercent = metrics?.cpu?.overallUsagePercent || 0;
  const sysMemPercent = metrics?.memory?.usedSystemPercent || 0;
  const heapPercent = metrics?.memory?.heapUsagePercent || 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="mr-1.5 size-4" /> Back to Settings
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center shadow-inner">
                <Server className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-3">
                  Server Environment & OCPP Status
                  <Badge
                    className={
                      isHealthy
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1 text-xs font-bold"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1 text-xs font-bold"
                    }
                  >
                    <span className={`size-2 rounded-full ${isHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    {isHealthy ? "ALL SYSTEMS OPERATIONAL" : "DEGRADED STATE"}
                  </Badge>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Host CPU, memory telemetry, PostgreSQL & Redis health, and live OCPP WebSocket pipeline.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Refresh Select */}
            <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-xl px-2.5 py-1">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Auto-Refresh:</span>
              <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                <SelectTrigger className="h-7 border-0 bg-transparent text-xs font-bold focus:ring-0 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="0">Paused</SelectItem>
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="10000">10 seconds</SelectItem>
                  <SelectItem value="30000">30 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Now Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMetrics(true)}
              disabled={isRefreshing}
              className="rounded-xl border-border/80 h-9 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#54a8c7]" : ""}`} />
              <span>Refresh</span>
            </Button>

            {/* Diagnostic Ping */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunPing}
              disabled={isPinging}
              className="rounded-xl border-[#54a8c7]/30 bg-[#54a8c7]/10 text-[#54a8c7] hover:bg-[#54a8c7]/20 h-9 gap-1.5 text-xs font-semibold"
            >
              <Zap className={`size-3.5 ${isPinging ? "animate-bounce" : ""}`} />
              <span>{isPinging ? "Pinging..." : "Test Latency"}</span>
            </Button>

            {/* Export Diagnostics */}
            <Button
              size="sm"
              onClick={handleExportReport}
              className="rounded-xl bg-[#54a8c7] text-white hover:bg-[#4695b2] h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Export Report</span>
            </Button>
          </div>
        </div>

        {/* Live Diagnostic Ping Results Banner (if ran) */}
        {pingResults && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-inner">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-foreground">Diagnostic Latency Benchmark Results</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({new Date().toLocaleTimeString()})
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  {pingResults.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{r.target}:</span>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono font-bold"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30 font-mono font-bold"
                        }
                      >
                        {r.latencyMs >= 0 ? `${r.latencyMs} ms` : "Failed"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPingResults(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Top 6 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. CPU Load */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">CPU Utilization</span>
                <Cpu className="size-4 text-[#54a8c7]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {cpuPercent}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ({metrics?.cpu?.coreCount} cores)
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress
                value={cpuPercent}
                className="h-1.5 bg-muted"
              />
              <p className="text-[10px] text-muted-foreground mt-2 truncate font-mono">
                {metrics?.cpu?.model || "Processor"}
              </p>
            </CardContent>
          </Card>

          {/* 2. Memory */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Memory (RAM)</span>
                <HardDrive className="size-4 text-[#3f78e0]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {sysMemPercent}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatBytes(metrics?.memory?.usedSystemBytes || 0)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress
                value={sysMemPercent}
                className="h-1.5 bg-muted"
              />
              <p className="text-[10px] text-muted-foreground mt-2 truncate">
                Heap: {formatBytes(metrics?.memory?.processHeapUsedBytes || 0)} / {formatBytes(metrics?.memory?.processHeapTotalBytes || 0)}
              </p>
            </CardContent>
          </Card>

          {/* 3. OCPP Server & Connected Chargers */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">OCPP WebSocket</span>
                <Radio className="size-4 text-[#45c4a0]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {metrics?.ocppServer?.activeConnectionsCluster ?? 0}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">Active EVSE</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px]">Port {metrics?.ocppServer?.port || 9220} Listening</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                1.6-J & 2.0.1 / 2.1 JSON
              </p>
            </CardContent>
          </Card>

          {/* 4. PostgreSQL Database */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">PostgreSQL</span>
                <Database className="size-4 text-[#fab758]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {metrics?.database?.latencyMs}ms
                </span>
                <span className="text-[11px] text-muted-foreground">Latency</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge
                variant="outline"
                className={
                  metrics?.database?.status === "healthy"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] py-0"
                }
              >
                {metrics?.database?.status === "healthy" ? "HEALTHY POOL" : "ERROR"}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-2 truncate">
                {metrics?.database?.counts?.activeSessions || 0} active sessions
              </p>
            </CardContent>
          </Card>

          {/* 5. Redis In-Memory Bus */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Redis Cache</span>
                <Zap className="size-4 text-[#e2626b]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {metrics?.redis?.latencyMs}ms
                </span>
                <span className="text-[11px] text-muted-foreground">Ping</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge
                variant="outline"
                className={
                  metrics?.redis?.status === "healthy"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] py-0"
                }
              >
                {metrics?.redis?.status === "healthy" ? "CONNECTED" : "DISCONNECTED"}
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-2 truncate">
                RAM: {metrics?.redis?.usedMemoryHuman || "N/A"}
              </p>
            </CardContent>
          </Card>

          {/* 6. Uptime */}
          <Card className="rounded-2xl border-border/80 shadow-xs relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Process Uptime</span>
                <Clock className="size-4 text-[#747ed1]" />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-xl font-bold font-mono tracking-tight text-foreground truncate">
                  {metrics?.host?.processUptimeFormatted || "0s"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <span className="text-[10px] text-muted-foreground font-mono block">
                Node {metrics?.host?.nodeVersion} (PID {metrics?.host?.pid})
              </span>
              <p className="text-[10px] text-muted-foreground mt-2 truncate">
                System: {metrics?.host?.systemUptimeFormatted}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed In-Depth Panels */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-card border border-border/80 rounded-2xl p-1.5 flex flex-wrap gap-1 w-full sm:w-auto">
            <TabsTrigger value="overview" className="rounded-xl text-xs font-semibold data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white">
              <Activity className="size-3.5 mr-1.5" /> System & Hardware Telemetry
            </TabsTrigger>
            <TabsTrigger value="ocpp" className="rounded-xl text-xs font-semibold data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white">
              <Radio className="size-3.5 mr-1.5" /> OCPP Server & Active Chargers ({metrics?.ocppServer?.activeConnectionsCluster || 0})
            </TabsTrigger>
            <TabsTrigger value="subsystems" className="rounded-xl text-xs font-semibold data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white">
              <Layers className="size-3.5 mr-1.5" /> Subsystems & Microservices
            </TabsTrigger>
            <TabsTrigger value="database" className="rounded-xl text-xs font-semibold data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white">
              <Database className="size-3.5 mr-1.5" /> Database & Storage Stats
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: System Hardware & Telemetry */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU Cores Breakdown */}
              <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Cpu className="size-4 text-[#54a8c7]" /> Host Processor & Multi-Core Distribution
                    </span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {metrics?.cpu?.coreCount} Logical Cores
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {metrics?.cpu?.model} @ {metrics?.cpu?.speedMhz} MHz
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-3">
                    {metrics?.cpu?.cores.map((core) => (
                      <div key={core.core} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-muted-foreground font-semibold">Core #{core.core}</span>
                          <span className="font-bold text-foreground">{core.usagePercent}%</span>
                        </div>
                        <Progress value={core.usagePercent} className="h-1.5" />
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Load 1m</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {metrics?.host?.loadAverage[0]?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Load 5m</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {metrics?.host?.loadAverage[1]?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Load 15m</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {metrics?.host?.loadAverage[2]?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Memory Allocation Breakdown */}
              <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <HardDrive className="size-4 text-[#3f78e0]" /> Memory Architecture & Heap Allocation
                    </span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {formatBytes(metrics?.memory?.totalSystemBytes || 0)} Total RAM
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    V8 Garbage Collector Heap and Resident Set Size (RSS) memory consumption
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* System RAM bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">Host Physical RAM</span>
                      <span className="font-mono font-bold text-foreground">
                        {formatBytes(metrics?.memory?.usedSystemBytes || 0)} / {formatBytes(metrics?.memory?.totalSystemBytes || 0)} ({sysMemPercent}%)
                      </span>
                    </div>
                    <Progress value={sysMemPercent} className="h-2" />
                  </div>

                  {/* V8 Node Heap Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">Node.js V8 Heap Used</span>
                      <span className="font-mono font-bold text-foreground">
                        {formatBytes(metrics?.memory?.processHeapUsedBytes || 0)} / {formatBytes(metrics?.memory?.processHeapTotalBytes || 0)} ({heapPercent}%)
                      </span>
                    </div>
                    <Progress value={heapPercent} className="h-2" />
                  </div>

                  {/* Memory metrics grid */}
                  <div className="pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">RSS Memory</div>
                      <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                        {formatBytes(metrics?.memory?.processRssBytes || 0)}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Free RAM</div>
                      <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                        {formatBytes(metrics?.memory?.freeSystemBytes || 0)}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">External</div>
                      <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                        {formatBytes(metrics?.memory?.processExternalBytes || 0)}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">ArrayBuffers</div>
                      <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                        {formatBytes(metrics?.memory?.processArrayBuffersBytes || 0)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Host Runtime Environment Table */}
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Terminal className="size-4 text-[#54a8c7]" /> Host OS & Node.js Runtime Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                    <span className="text-muted-foreground font-semibold">Hostname</span>
                    <p className="font-mono font-bold text-foreground truncate">{metrics?.host?.hostname}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                    <span className="text-muted-foreground font-semibold">OS Platform & Kernel</span>
                    <p className="font-mono font-bold text-foreground truncate">
                      {metrics?.host?.platform} {metrics?.host?.osRelease} ({metrics?.host?.arch})
                    </p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                    <span className="text-muted-foreground font-semibold">Node.js / V8 Engine</span>
                    <p className="font-mono font-bold text-foreground truncate">
                      {metrics?.host?.nodeVersion} (V8 {metrics?.host?.v8Version})
                    </p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                    <span className="text-muted-foreground font-semibold">Instance ID & Env</span>
                    <p className="font-mono font-bold text-foreground truncate">
                      {metrics?.host?.instanceId} ({metrics?.host?.environment})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: OCPP WebSocket Server & Connected Chargers */}
          <TabsContent value="ocpp" className="space-y-6">
            {/* OCPP Server Config & Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-2xl border-border/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">WebSocket Listener</span>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Port {metrics?.ocppServer?.port}
                  </Badge>
                </div>
                <div className="text-xs font-mono bg-muted/50 p-2 rounded-lg truncate text-foreground">
                  ws://host:{metrics?.ocppServer?.port}/OCPP/1.6/{"{id}"}
                </div>
              </Card>

              <Card className="rounded-2xl border-border/80 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">mTLS Security Profile</span>
                  <Badge
                    variant="outline"
                    className={
                      metrics?.ocppServer?.mtlsEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                        : "bg-muted text-muted-foreground text-[10px]"
                    }
                  >
                    {metrics?.ocppServer?.mtlsEnabled ? "SP3 (mTLS Active)" : "SP1 / SP2 Enabled"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Heartbeat: {metrics?.ocppServer?.heartbeatIntervalSeconds}s | Offline: {metrics?.ocppServer?.offlineThresholdSeconds}s
                </div>
              </Card>

              <Card className="rounded-2xl border-border/80 p-4 space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Live Log Stream</span>
                  <Link href="/ocpp">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1">
                      <span>Open Inspector</span>
                      <ExternalLink className="size-3" />
                    </Button>
                  </Link>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Stream endpoint: {metrics?.ocppServer?.ocppLogsWsEndpoint}
                </div>
              </Card>
            </div>

            {/* Connected Chargers List */}
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Radio className="size-4 text-[#45c4a0]" /> Live Connected Charge Points
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Hardware devices with active TCP WebSocket connections to the OCPP server
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-bold">
                    {metrics?.ocppServer?.connectedChargers?.length || 0} Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!metrics?.ocppServer?.connectedChargers?.length ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <Radio className="size-8 mx-auto text-muted-foreground/50 animate-pulse" />
                    <p className="text-sm font-semibold">No chargers currently connected via WebSocket</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Physical chargers configured with ws://host:{metrics?.ocppServer?.port}/OCPP/1.6/{"<id>"} will automatically register here.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Charger Identity</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Hardware / Vendor</TableHead>
                        <TableHead>Protocol</TableHead>
                        <TableHead>Last Heartbeat</TableHead>
                        <TableHead>Active Sessions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.ocppServer.connectedChargers.map((charger) => (
                        <TableRow key={charger.chargerId}>
                          <TableCell className="font-mono font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{charger.name}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                (#{charger.chargerId})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {charger.stationName}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-semibold text-foreground">{charger.vendor}</span>{" "}
                            <span className="text-muted-foreground">({charger.model})</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono uppercase">
                              {charger.protocol}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {new Date(charger.lastHeartbeat).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            {charger.activeTransactions > 0 ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                {charger.activeTransactions} Active
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Idle</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/chargers/${charger.chargerId}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-[#54a8c7]">
                                View Details →
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Subsystems & Microservices */}
          <TabsContent value="subsystems" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics?.subsystems?.map((sub) => (
                <Card key={sub.key} className="rounded-2xl border-border/80 p-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="size-4" />
                        </div>
                        <h4 className="font-bold text-sm text-foreground">{sub.name}</h4>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sub.description}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Schedule:</span>
                    <span className="text-foreground font-bold">{sub.interval || sub.path || "Online"}</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 4: Database Entities & Storage */}
          <TabsContent value="database" className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { label: "Physical Chargers", value: metrics?.database?.counts?.chargers, icon: Radio },
                { label: "Charging Stations", value: metrics?.database?.counts?.chargingStations, icon: Globe },
                { label: "Connectors (EVSE)", value: metrics?.database?.counts?.connectors, icon: Zap },
                { label: "Total Sessions / Transactions", value: metrics?.database?.counts?.transactions, icon: Activity },
                { label: "Active Charging Sessions", value: metrics?.database?.counts?.activeSessions, icon: ArrowUpRight },
                { label: "Registered Users", value: metrics?.database?.counts?.users, icon: ShieldCheck },
                { label: "RFID Whitelist Tags", value: metrics?.database?.counts?.rfidUsers, icon: Terminal },
                { label: "Load Balancing Groups", value: metrics?.database?.counts?.chargeGroups, icon: Layers },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Card key={idx} className="rounded-2xl border-border/80 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-2">
                      <span className="text-xs font-semibold">{item.label}</span>
                      <Icon className="size-4 text-[#54a8c7]" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {item.value?.toLocaleString() || 0}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="rounded-2xl border-border/80 p-4 space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Database Engine & Connection Pool</h4>
              <p className="text-xs font-mono text-muted-foreground">
                {metrics?.database?.version}
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Query Response Time: <strong className="text-foreground">{metrics?.database?.latencyMs} ms</strong></span>
                <span>Status: <strong className="text-emerald-400">Connected</strong></span>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
