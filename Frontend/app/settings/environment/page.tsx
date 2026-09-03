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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Upload,
  FileCode,
  FileText,
  ShieldAlert,
  Check,
  Copy,
  Sparkles,
  Trash2,
  Search,
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
      const data = res.data?.data || res.data;
      if (data && (data.host || data.status || data.cpu || data.database)) {
        setMetrics(data);
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
      const results = res.data?.results || res.data?.data?.results || (Array.isArray(res.data) ? res.data : null);
      if (results) {
        setPingResults(results);
        toast.success("Diagnostic latency check complete");
      } else {
        toast.error("No diagnostic results returned");
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

  // Database Backup & Restore State
  const [isExportingSql, setIsExportingSql] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"restore" | "incremental">("restore");
  const [isDryRun, setIsDryRun] = useState(false);
  const [rawSqlScript, setRawSqlScript] = useState("");
  const [activeBackupTab, setActiveBackupTab] = useState<"upload" | "sql">("upload");
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [confirmRestoreText, setConfirmRestoreText] = useState("");
  const [lastRestoreResult, setLastRestoreResult] = useState<{
    success: boolean;
    message: string;
    dryRun: boolean;
    mode: string;
    durationMs: number;
    timestamp: string;
  } | null>(null);
  const [backupStats, setBackupStats] = useState<{
    tableCount: number;
    rowCount: number;
    databaseVersion: string;
    tables: { name: string; rowCount: number }[];
  } | null>(null);
  const [isLoadingBackupStats, setIsLoadingBackupStats] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Fetch database backup stats
  const fetchBackupStats = useCallback(async () => {
    setIsLoadingBackupStats(true);
    try {
      const res = await api.get("/settings/environment/backup/stats");
      const data = res.data?.data || res.data;
      if (data && data.tables) {
        setBackupStats(data);
      }
    } catch (err) {
      logger.error("Failed to fetch database backup stats", err);
    } finally {
      setIsLoadingBackupStats(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "database") {
      fetchBackupStats();
    }
  }, [activeTab, fetchBackupStats]);

  // Export SQL Backup (.sql)
  const handleExportSql = async (includeData = true) => {
    setIsExportingSql(true);
    try {
      toast.info("Generating PostgreSQL database backup dump...");
      const res = await api.get(`/settings/environment/backup/export?format=sql&includeData=${includeData}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = `GRID_CPMS_Database_Backup_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.sql`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Database SQL backup downloaded successfully");
    } catch (err: any) {
      logger.error("Failed to export SQL database backup", err);
      toast.error("Failed to generate database SQL backup");
    } finally {
      setIsExportingSql(false);
    }
  };

  // Export JSON Snapshot (.json)
  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      toast.info("Generating JSON snapshot of database tables...");
      const res = await api.get("/settings/environment/backup/export?format=json", {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = `GRID_CPMS_Database_Backup_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Database JSON snapshot downloaded successfully");
    } catch (err: any) {
      logger.error("Failed to export JSON database snapshot", err);
      toast.error("Failed to generate JSON database snapshot");
    } finally {
      setIsExportingJson(false);
    }
  };

  // Run Dry-Run Simulation
  const handleRunDryRun = async () => {
    if (activeBackupTab === "upload" && !importFile) {
      toast.error("Please select a .sql backup file to test");
      return;
    }
    if (activeBackupTab === "sql" && !rawSqlScript.trim()) {
      toast.error("Please enter a SQL script to test");
      return;
    }

    setIsImporting(true);
    try {
      let res;
      if (activeBackupTab === "upload" && importFile) {
        const formData = new FormData();
        formData.append("file", importFile);
        formData.append("mode", importMode);
        formData.append("dryRun", "true");
        res = await api.post("/settings/environment/backup/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post("/settings/environment/backup/import", {
          sql: rawSqlScript,
          mode: importMode,
          dryRun: true,
        });
      }

      const result = res.data?.data || res.data;
      setLastRestoreResult(result);
      toast.success("Dry-run validation successful! No database changes were written.");
    } catch (err: any) {
      logger.error("Dry-run test failed", err);
      const msg = err.response?.data?.error || err.message || "Dry-run validation failed";
      toast.error(`Dry-run validation failed: ${msg}`);
      setLastRestoreResult({
        success: false,
        message: msg,
        dryRun: true,
        mode: importMode,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Execute Live Restore (after confirmation)
  const handleConfirmRestore = async () => {
    setIsImporting(true);
    setRestoreModalOpen(false);
    setConfirmRestoreText("");

    try {
      let res;
      if (activeBackupTab === "upload" && importFile) {
        const formData = new FormData();
        formData.append("file", importFile);
        formData.append("mode", importMode);
        formData.append("dryRun", "false");
        res = await api.post("/settings/environment/backup/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post("/settings/environment/backup/import", {
          sql: rawSqlScript,
          mode: importMode,
          dryRun: false,
        });
      }

      const result = res.data?.data || res.data;
      setLastRestoreResult(result);
      toast.success("Database backup restored successfully!");
      fetchMetrics(true);
      fetchBackupStats();
    } catch (err: any) {
      logger.error("Database restore failed", err);
      const msg = err.response?.data?.error || err.message || "Database restore failed";
      toast.error(`Database restore failed: ${msg}`);
      setLastRestoreResult({
        success: false,
        message: msg,
        dryRun: false,
        mode: importMode,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsImporting(false);
    }
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

  if (!metrics) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="mr-1.5 size-4" /> Back to Settings
            </Button>
          </Link>
          <Card className="rounded-2xl border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-4">
            <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Unable to Load Server Environment Metrics</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                The CPMS backend API could not be reached or returned an invalid telemetry response. Check backend connectivity.
              </p>
            </div>
            <Button
              onClick={() => fetchMetrics(true)}
              className="rounded-xl bg-[#54a8c7] text-white hover:bg-[#4695b2] text-xs font-semibold gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry Connection</span>
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const isHealthy = metrics.status === "operational";
  const cpuPercent = metrics.cpu?.overallUsagePercent || 0;
  const sysMemPercent = metrics.memory?.usedSystemPercent || 0;
  const heapPercent = metrics.memory?.heapUsagePercent || 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
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
              variant="outline"
              onClick={handleExportReport}
              className="rounded-xl border-border/80 h-9 gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Export Diagnostics</span>
            </Button>

            {/* Export SQL Backup */}
            <Button
              size="sm"
              onClick={() => handleExportSql(true)}
              disabled={isExportingSql}
              className="rounded-xl bg-[#45c4a0] text-white hover:bg-[#3db392] h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Database className={`size-3.5 ${isExportingSql ? "animate-spin" : ""}`} />
              <span>{isExportingSql ? "Exporting SQL..." : "Export SQL Backup"}</span>
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
                        {metrics?.host?.loadAverage?.[0] !== undefined ? metrics.host.loadAverage[0].toFixed(2) : "0.00"}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Load 5m</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {metrics?.host?.loadAverage?.[1] !== undefined ? metrics.host.loadAverage[1].toFixed(2) : "0.00"}
                      </div>
                    </div>
                    <div className="p-2.5 bg-muted/40 rounded-xl">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Load 15m</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {metrics?.host?.loadAverage?.[2] !== undefined ? metrics.host.loadAverage[2].toFixed(2) : "0.00"}
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

          {/* TAB 4: Database Entities & Storage / Backup & Restore */}
          <TabsContent value="database" className="space-y-6">
            {/* KPI Entity Counters */}
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

            {/* Live Restore Result Feedback Banner (if executed) */}
            {lastRestoreResult && (
              <Alert
                className={`rounded-2xl ${
                  lastRestoreResult.success
                    ? lastRestoreResult.dryRun
                      ? "border-[#54a8c7]/40 bg-[#54a8c7]/10"
                      : "border-emerald-500/40 bg-emerald-500/10"
                    : "border-rose-500/40 bg-rose-500/10"
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-start gap-3">
                    {lastRestoreResult.success ? (
                      lastRestoreResult.dryRun ? (
                        <Sparkles className="size-5 text-[#54a8c7] mt-0.5" />
                      ) : (
                        <CheckCircle2 className="size-5 text-emerald-400 mt-0.5" />
                      )
                    ) : (
                      <AlertTriangle className="size-5 text-rose-400 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <AlertTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        {lastRestoreResult.dryRun
                          ? "Dry-Run Simulation Complete"
                          : lastRestoreResult.success
                          ? "Database Restore Succeeded"
                          : "Database Restore Failed"}
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${
                            lastRestoreResult.dryRun
                              ? "bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/40"
                              : lastRestoreResult.success
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          }`}
                        >
                          {lastRestoreResult.dryRun ? "SIMULATION ONLY" : lastRestoreResult.mode.toUpperCase()}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
                        {lastRestoreResult.message}
                        {lastRestoreResult.durationMs > 0 && (
                          <span className="block mt-1 font-mono text-[11px] text-foreground">
                            Execution time: {lastRestoreResult.durationMs}ms | Timestamp:{" "}
                            {new Date(lastRestoreResult.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLastRestoreResult(null)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </Button>
                </div>
              </Alert>
            )}

            {/* Database Backup & Restore Suite Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CARD 1: Database Export & Snapshots */}
              <Card className="rounded-2xl border-border/80 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
                        <Database className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">PostgreSQL Database Snapshots</CardTitle>
                        <CardDescription className="text-xs">
                          Export complete schema, sequences, and table records
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-[#45c4a0]/10 text-[#45c4a0] border-[#45c4a0]/30 font-mono text-[10px]">
                      ACID EXPORT
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  <div className="p-3.5 bg-muted/30 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Database Engine:</span>
                      <strong className="text-foreground font-mono">{metrics?.database?.version}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Tables in Public Schema:</span>
                      <strong className="text-foreground font-mono">{backupStats?.tableCount || metrics?.database?.counts ? 15 : 0} Tables</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Total Database Records:</span>
                      <strong className="text-foreground font-mono">
                        {(backupStats?.rowCount || 0).toLocaleString()} Rows
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Connection Latency:</span>
                      <span className="text-emerald-400 font-mono font-bold">{metrics?.database?.latencyMs} ms</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="font-semibold text-foreground">Disaster Recovery Features:</span>
                    <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 text-[#45c4a0]" />
                        <span>Sets <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded text-[10px]">session_replication_role = &apos;replica&apos;</code> to bypass foreign key deadlocks.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 text-[#45c4a0]" />
                        <span>Dynamic sequence resynchronization block to maintain auto-increment IDs.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 text-[#45c4a0]" />
                        <span>Atomic transaction wrapper (<code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded text-[10px]">BEGIN; ... COMMIT;</code>).</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 text-[#45c4a0]" />
                        <span>Full compatibility with PostgreSQL 14+, Neon, Supabase, Docker, and PGlite.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <Button
                      onClick={() => handleExportSql(true)}
                      disabled={isExportingSql}
                      className="rounded-xl bg-[#45c4a0] text-white hover:bg-[#3db392] h-9 gap-1.5 text-xs font-semibold shadow-xs flex-1"
                    >
                      <Download className={`size-3.5 ${isExportingSql ? "animate-spin" : ""}`} />
                      <span>{isExportingSql ? "Generating SQL Dump..." : "Export Full SQL Backup (.sql)"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleExportJson}
                      disabled={isExportingJson}
                      className="rounded-xl border-border/80 h-9 gap-1.5 text-xs font-semibold shadow-xs hover:bg-muted"
                    >
                      <FileCode className="size-3.5 text-[#3f78e0]" />
                      <span>JSON Snapshot</span>
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleExportSql(false)}
                      disabled={isExportingSql}
                      className="rounded-xl h-9 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span>Schema Only</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* CARD 2: Database Restore & SQL Import */}
              <Card className="rounded-2xl border-border/80 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center">
                        <Upload className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">Database Restore & SQL Runner</CardTitle>
                        <CardDescription className="text-xs">
                          Restore database from .sql backup file or execute custom script
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-[#3f78e0]/10 text-[#3f78e0] border-[#3f78e0]/30 font-mono text-[10px]">
                      TRANSACTIONAL
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-4">
                  {/* Mode Tabs */}
                  <Tabs value={activeBackupTab} onValueChange={(v) => setActiveBackupTab(v as any)} className="w-full">
                    <TabsList className="grid grid-cols-2 bg-muted/50 rounded-xl p-1 mb-3">
                      <TabsTrigger value="upload" className="rounded-lg text-xs font-semibold">
                        <FileText className="size-3.5 mr-1.5" /> Upload .SQL File
                      </TabsTrigger>
                      <TabsTrigger value="sql" className="rounded-lg text-xs font-semibold">
                        <Terminal className="size-3.5 mr-1.5" /> SQL Script Runner
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab A: Upload SQL File */}
                    <TabsContent value="upload" className="space-y-3 mt-0">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (file.name.endsWith(".sql") || file.name.endsWith(".txt")) {
                              setImportFile(file);
                            } else {
                              toast.error("Please upload a .sql database backup file");
                            }
                          }
                        }}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                          isDragging
                            ? "border-[#54a8c7] bg-[#54a8c7]/10"
                            : importFile
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/30"
                        }`}
                        onClick={() => {
                          const fileInput = document.getElementById("sql-backup-file-input") as HTMLInputElement;
                          if (fileInput) fileInput.click();
                        }}
                      >
                        <input
                          id="sql-backup-file-input"
                          type="file"
                          accept=".sql,.txt"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setImportFile(e.target.files[0]);
                            }
                          }}
                        />

                        {importFile ? (
                          <div className="flex items-center justify-between text-left">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                <FileCode className="size-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground truncate max-w-[220px]">
                                  {importFile.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  {formatBytes(importFile.size)} • Last modified:{" "}
                                  {new Date(importFile.lastModified).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImportFile(null);
                              }}
                              className="size-8 p-0 text-muted-foreground hover:text-rose-400"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 py-1">
                            <Upload className="size-6 mx-auto text-muted-foreground" />
                            <p className="text-xs font-semibold text-foreground">
                              Drop your <span className="font-mono text-[#54a8c7]">.sql</span> backup file here, or click to browse
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Accepts PostgreSQL SQL dumps with batch INSERTs (Max 100 MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Tab B: Raw SQL Script Runner */}
                    <TabsContent value="sql" className="space-y-2 mt-0">
                      <div className="relative">
                        <Textarea
                          placeholder="Paste or write SQL statements here (e.g. TRUNCATE TABLE &quot;User&quot;; INSERT INTO ...)"
                          value={rawSqlScript}
                          onChange={(e) => setRawSqlScript(e.target.value)}
                          className="font-mono text-xs h-32 rounded-xl bg-muted/30 border-border/70 resize-none"
                        />
                        {rawSqlScript && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRawSqlScript("")}
                            className="absolute top-2 right-2 h-6 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Options: Mode & Dry-Run */}
                  <div className="p-3 bg-muted/20 rounded-xl space-y-3 border border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-foreground">Restore Strategy</Label>
                        <p className="text-[10px] text-muted-foreground">
                          {importMode === "restore"
                            ? "Full wipe & replace from backup file"
                            : "Execute statements incrementally without wiping"}
                        </p>
                      </div>
                      <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                        <SelectTrigger className="h-7 w-44 rounded-lg text-xs font-semibold bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl text-xs">
                          <SelectItem value="restore">Full Restore (Replace)</SelectItem>
                          <SelectItem value="incremental">Incremental Script</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <div className="space-y-0.5">
                        <Label htmlFor="dry-run-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
                          Dry-Run Simulation Mode
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Tests SQL syntax and constraints inside a rolled-back transaction
                        </p>
                      </div>
                      <Switch
                        id="dry-run-toggle"
                        checked={isDryRun}
                        onCheckedChange={setIsDryRun}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-1 flex flex-wrap gap-2.5">
                    <Button
                      variant="outline"
                      onClick={handleRunDryRun}
                      disabled={isImporting || (activeBackupTab === "upload" && !importFile) || (activeBackupTab === "sql" && !rawSqlScript.trim())}
                      className="rounded-xl border-[#54a8c7]/40 bg-[#54a8c7]/10 text-[#54a8c7] hover:bg-[#54a8c7]/20 h-9 gap-1.5 text-xs font-semibold flex-1"
                    >
                      <Sparkles className={`size-3.5 ${isImporting && isDryRun ? "animate-spin" : ""}`} />
                      <span>{isImporting && isDryRun ? "Simulating..." : "Test Dry-Run"}</span>
                    </Button>

                    <Button
                      onClick={() => {
                        if (activeBackupTab === "upload" && !importFile) {
                          toast.error("Please select a .sql file to restore");
                          return;
                        }
                        if (activeBackupTab === "sql" && !rawSqlScript.trim()) {
                          toast.error("Please enter a SQL script to restore");
                          return;
                        }
                        setRestoreModalOpen(true);
                      }}
                      disabled={isImporting || (activeBackupTab === "upload" && !importFile) || (activeBackupTab === "sql" && !rawSqlScript.trim())}
                      className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-xs flex-1"
                    >
                      <ShieldAlert className="size-3.5" />
                      <span>Execute Restore...</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CARD 3: Table Inventory & Row Distribution */}
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Layers className="size-4 text-[#54a8c7]" /> Database Public Tables Inventory
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live table catalog in public PostgreSQL schema ({backupStats?.tables?.length || 0} tables discovered)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-48 sm:w-64">
                      <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search tables..."
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs rounded-xl bg-muted/30"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchBackupStats}
                      disabled={isLoadingBackupStats}
                      className="h-8 text-xs rounded-xl gap-1"
                    >
                      <RefreshCw className={`size-3 ${isLoadingBackupStats ? "animate-spin text-[#54a8c7]" : ""}`} />
                      <span>Sync</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Table Name</TableHead>
                        <TableHead className="text-xs">Row Count</TableHead>
                        <TableHead className="text-xs">Storage Footprint</TableHead>
                        <TableHead className="text-right text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingBackupStats && !backupStats?.tables?.length ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                            Scanning database tables...
                          </TableCell>
                        </TableRow>
                      ) : (
                        (backupStats?.tables || [])
                          .filter((t) => t.name.toLowerCase().includes(tableSearchQuery.toLowerCase()))
                          .map((table) => (
                            <TableRow key={table.name}>
                              <TableCell className="font-mono text-xs font-bold text-foreground">
                                &quot;public&quot;.&quot;{table.name}&quot;
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <Badge variant="outline" className="text-[11px] font-mono font-bold">
                                  {table.rowCount.toLocaleString()} rows
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                ~{formatBytes(Math.max(8192, table.rowCount * 250))}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                                  <span className="size-1.5 rounded-full bg-emerald-400" /> Operational
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Restore Confirmation Dialog */}
        <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader className="space-y-2">
              <div className="size-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="size-5" />
              </div>
              <DialogTitle className="text-center text-lg font-bold text-foreground">
                Confirm Live Database Restore
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-muted-foreground">
                You are about to execute a live SQL database restore in{" "}
                <span className="font-bold text-foreground uppercase">{importMode}</span> mode.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-2 text-xs">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1 text-rose-300 text-[11px]">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-rose-400" />
                  Warning: Existing Data Overwrite
                </p>
                <p>
                  This operation executes database queries inside a transaction. In full restore mode, existing table records will be wiped and replaced with the snapshot data.
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Target Source:</span>
                  <span className="text-foreground font-bold">
                    {activeBackupTab === "upload" ? importFile?.name : "Custom SQL Script"}
                  </span>
                </div>
                {importFile && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>File Size:</span>
                    <span className="text-foreground">{formatBytes(importFile.size)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Execution Strategy:</span>
                  <span className="text-foreground capitalize">{importMode}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="confirm-restore-input" className="text-xs font-semibold text-foreground">
                  Type <span className="font-mono text-rose-400 font-bold">RESTORE</span> to confirm:
                </Label>
                <Input
                  id="confirm-restore-input"
                  placeholder="RESTORE"
                  value={confirmRestoreText}
                  onChange={(e) => setConfirmRestoreText(e.target.value)}
                  className="font-mono text-xs rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setConfirmRestoreText("");
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRestore}
                disabled={confirmRestoreText.trim().toUpperCase() !== "RESTORE" || isImporting}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Database className={`size-3.5 ${isImporting ? "animate-spin" : ""}`} />
                <span>{isImporting ? "Applying Restore..." : "Confirm & Restore Database"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
