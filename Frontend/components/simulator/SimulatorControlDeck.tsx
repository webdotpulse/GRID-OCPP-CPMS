"use client";

import React, { useState } from "react";
import {
  Zap,
  Play,
  Square,
  RefreshCw,
  Radio,
  AlertTriangle,
  Flame,
  Unplug,
  WifiOff,
  Wifi,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  ShieldCheck,
  Cpu,
  Sliders,
  PlayCircle,
  Activity,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { RAEDIAN_ERROR_CODES } from "@/lib/raedianErrorCodes";
import { ALFEN_ERROR_CODES } from "@/lib/vendorErrorCodes/alfenErrorCodes";
import { EASEE_REASONS } from "@/lib/vendorErrorCodes/easeeErrorCodes";
import { ZAPTEC_FLAGS } from "@/lib/vendorErrorCodes/zaptecErrorCodes";
import { PEBLAR_CODES } from "@/lib/vendorErrorCodes/peblarErrorCodes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SimulatorControlDeckProps {
  sessionId: string;
  chargerName: string;
  protocol: string;
  selectedConnectorId: number;
  rfidTags: Array<{ rfid_tag: string; name: string; active: boolean }>;
  logs: any[];
  offlineBuffer: any[];
  onSendAction: (action: string, payload?: any) => Promise<any>;
  onTriggerScenario: (scenario: string, payload?: any) => Promise<any>;
  onRunTestSuite: (suiteId: string) => Promise<any>;
  onSendRawFrame: (frame: any[]) => Promise<any>;
  loading?: boolean;
}

export function SimulatorControlDeck({
  sessionId,
  chargerName,
  protocol,
  selectedConnectorId,
  rfidTags,
  logs,
  offlineBuffer,
  onSendAction,
  onTriggerScenario,
  onRunTestSuite,
  onSendRawFrame,
  loading = false,
}: SimulatorControlDeckProps) {
  const [selectedTag, setSelectedTag] = useState("SIM-RFID-PASS-01");
  const [customTag, setCustomTag] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Available");
  const [stopReason, setStopReason] = useState("Local");
  const [faultErrorCode, setFaultErrorCode] = useState("GroundFailure");
  const [selectedVendorBrand, setSelectedVendorBrand] = useState<"Raedian" | "Alfen" | "Easee" | "Zaptec" | "Peblar">("Raedian");
  const [selectedVendorCode, setSelectedVendorCode] = useState("E00008");
  const [powerDropKw, setPowerDropKw] = useState("3.7");
  const [driftWh, setDriftWh] = useState("2500");
  const [isBufferingOffline, setIsBufferingOffline] = useState(false);

  // Test suite running state
  const [activeSuiteId, setActiveSuiteId] = useState<string | null>(null);
  const [suiteReport, setSuiteReport] = useState<any | null>(null);

  // Raw JSON-RPC frame editor state
  const [rawFrameText, setRawFrameText] = useState(
    JSON.stringify(
      [
        2,
        "msg-custom-01",
        "DataTransfer",
        { vendorId: "GridSim", messageId: "Telemetry", data: "CustomPayload" },
      ],
      null,
      2
    )
  );
  const [rawFrameFilter, setRawFrameFilter] = useState("ALL");

  const effectiveTag = customTag.trim() || selectedTag;

  const handleRunSuite = async (suiteId: string) => {
    setActiveSuiteId(suiteId);
    setSuiteReport(null);
    try {
      const res = await onRunTestSuite(suiteId);
      setSuiteReport(res?.report || res);
    } catch (err: any) {
      setSuiteReport({
        suiteId,
        passed: false,
        steps: [
          {
            name: "Execution Error",
            status: "failed",
            error: err.message || "Failed to execute test suite",
          },
        ],
      });
    } finally {
      setActiveSuiteId(null);
    }
  };

  const handleSendRaw = async () => {
    try {
      const parsed = JSON.parse(rawFrameText);
      await onSendRawFrame(parsed);
    } catch (err: any) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (rawFrameFilter === "IN") return l.direction === "in";
    if (rawFrameFilter === "OUT") return l.direction === "out";
    if (rawFrameFilter === "ERROR")
      return l.messageType === "CALLERROR" || l.status === "Error";
    return true;
  });

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground p-5 shadow-sm">
      <Tabs defaultValue="operations" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border mb-5">
          <TabsList className="bg-muted/50 border border-border p-1 rounded-xl">
            <TabsTrigger
              value="operations"
              className="data-[state=active]:bg-[#54a8c7]/20 data-[state=active]:text-[#54a8c7] rounded-lg text-xs font-semibold"
            >
              <Sliders className="size-3.5 mr-1.5" /> Manual Deck
            </TabsTrigger>
            <TabsTrigger
              value="chaos"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 rounded-lg text-xs font-semibold"
            >
              <Flame className="size-3.5 mr-1.5" /> Anomaly & Chaos
            </TabsTrigger>
            <TabsTrigger
              value="testsuites"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 rounded-lg text-xs font-semibold"
            >
              <ShieldCheck className="size-3.5 mr-1.5" /> Test Suites
            </TabsTrigger>
            <TabsTrigger
              value="frames"
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-300 rounded-lg text-xs font-semibold"
            >
              <Terminal className="size-3.5 mr-1.5" /> Frame Terminal
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Connector: EVSE {selectedConnectorId}</span>
            <span>•</span>
            <span>Buffered: {offlineBuffer.length} frames</span>
          </div>
        </div>

        {/* TAB 1: MANUAL OPERATIONS DECK */}
        <TabsContent value="operations" className="space-y-6 m-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Protocol Messages */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-heading">
                <Radio className="size-3.5 text-[#54a8c7]" /> Protocol Messages
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-border text-xs text-foreground hover:bg-muted"
                  onClick={() => onSendAction("BootNotification")}
                  disabled={loading}
                >
                  <RefreshCw className="size-3 mr-1.5 text-cyan-500 dark:text-cyan-400" />
                  BootNotification
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-border text-xs text-foreground hover:bg-muted"
                  onClick={() => onSendAction("Heartbeat")}
                  disabled={loading}
                >
                  <Activity className="size-3 mr-1.5 text-emerald-500 dark:text-emerald-400" />
                  Heartbeat
                </Button>
              </div>

              {/* Status Notification Trigger */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-[11px] text-muted-foreground font-semibold">
                  Status Notification
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Preparing">Preparing</SelectItem>
                      <SelectItem value="Charging">Charging</SelectItem>
                      <SelectItem value="SuspendedEVSE">
                        SuspendedEVSE
                      </SelectItem>
                      <SelectItem value="SuspendedEV">SuspendedEV</SelectItem>
                      <SelectItem value="Finishing">Finishing</SelectItem>
                      <SelectItem value="Reserved">Reserved</SelectItem>
                      <SelectItem value="Unavailable">Unavailable</SelectItem>
                      <SelectItem value="Faulted">Faulted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-[#54a8c7]/20 hover:bg-[#54a8c7]/30 text-[#54a8c7] text-xs font-bold"
                    onClick={() =>
                      onSendAction("StatusNotification", {
                        connectorId: selectedConnectorId,
                        status: selectedStatus,
                      })
                    }
                    disabled={loading}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. RFID & Authorization */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-heading">
                <ShieldCheck className="size-3.5 text-purple-500" /> RFID &
                Authentication
              </h3>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-semibold">
                  RFID Tag Whitelist
                </Label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg">
                    <SelectValue placeholder="Select RFID Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {rfidTags.map((t) => (
                      <SelectItem key={t.rfid_tag} value={t.rfid_tag}>
                        {t.name} ({t.rfid_tag}){" "}
                        {t.active ? "🟢" : "🔴 [Blocked]"}
                      </SelectItem>
                    ))}
                    <SelectItem value="SIM-RFID-PASS-01">
                      SIM-RFID-PASS-01 (Default Active)
                    </SelectItem>
                    <SelectItem value="SIM-RFID-BLOCKED-02">
                      SIM-RFID-BLOCKED-02 (Blocked Tag)
                    </SelectItem>
                    <SelectItem value="UNKNOWN-TAG-999">
                      UNKNOWN-TAG-999 (Unregistered)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground font-semibold">
                  Or Custom Tag / ISO15118 Hash
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. CARD-42"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    className="h-8 text-xs bg-background border-border text-foreground rounded-lg font-mono"
                  />
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-bold"
                    onClick={() =>
                      onSendAction("Authorize", { idTag: effectiveTag })
                    }
                    disabled={loading}
                  >
                    Authorize
                  </Button>
                </div>
              </div>
            </div>

            {/* 3. Session Controller (Start / Stop) */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-heading">
                <Zap className="size-3.5 text-cyan-500" /> Transaction
                Controller
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
                  onClick={() =>
                    onSendAction("StartTransaction", {
                      connectorId: selectedConnectorId,
                      idTag: effectiveTag,
                    })
                  }
                  disabled={loading}
                >
                  <Play className="size-3 mr-1.5 fill-white" /> Start Charge
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-border text-xs text-foreground hover:bg-muted"
                  onClick={() =>
                    onSendAction("MeterValues", {
                      connectorId: selectedConnectorId,
                    })
                  }
                  disabled={loading}
                >
                  <RefreshCw className="size-3 mr-1.5 text-cyan-500 dark:text-cyan-400" /> Meter
                  Pulse
                </Button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-[11px] text-muted-foreground font-semibold">
                  Stop Transaction Reason
                </Label>
                <div className="flex gap-2">
                  <Select value={stopReason} onValueChange={setStopReason}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg">
                      <SelectValue placeholder="Stop Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Local">Local (RFID Stop)</SelectItem>
                      <SelectItem value="Remote">
                        Remote (CSMS Stop)
                      </SelectItem>
                      <SelectItem value="EVDisconnected">
                        EVDisconnected
                      </SelectItem>
                      <SelectItem value="EmergencyStop">
                        EmergencyStop
                      </SelectItem>
                      <SelectItem value="PowerLoss">PowerLoss</SelectItem>
                      <SelectItem value="SoftReset">SoftReset</SelectItem>
                      <SelectItem value="HardReset">HardReset</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 rounded-lg text-xs font-bold"
                    onClick={() =>
                      onSendAction("StopTransaction", {
                        connectorId: selectedConnectorId,
                        reason: stopReason,
                        idTag: effectiveTag,
                      })
                    }
                    disabled={loading}
                  >
                    <Square className="size-3 mr-1 fill-white" /> Stop
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CHAOS & ANOMALY INJECTION */}
        <TabsContent value="chaos" className="space-y-4 m-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Anomaly 1: Premature Cable Disconnect */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <Unplug className="size-4 text-rose-500" />
                  Premature Cable Pull
                </h3>
                <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[10px]">
                  EVDisconn
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Forcefully unlatch cable during high-current flow. Triggers
                immediate EVCommunicationError and terminates session with
                EVDisconnected reason.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="w-full rounded-lg text-xs font-bold"
                onClick={() =>
                  onTriggerScenario("premature-cable-disconnect", {
                    connectorId: selectedConnectorId,
                  })
                }
                disabled={loading}
              >
                Trigger Cable Disconnect
              </Button>
            </div>

            {/* Anomaly 2: Power Drop / Dynamic Grid Throttle */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <Zap className="size-4 text-amber-500" />
                  Grid Power Curtailment
                </h3>
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px]">
                  Derating
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Simulate instant power derate (e.g. 3.7 kW or 0 kW) to test
                smart charging profile adherence and telemetry reporting.
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Target kW"
                  value={powerDropKw}
                  onChange={(e) => setPowerDropKw(e.target.value)}
                  className="h-8 text-xs bg-background border-border text-foreground rounded-lg font-mono"
                />
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold"
                  onClick={() =>
                    onTriggerScenario("power-drop", {
                      connectorId: selectedConnectorId,
                      powerKw: parseFloat(powerDropKw),
                    })
                  }
                  disabled={loading}
                >
                  Apply Derate
                </Button>
              </div>
            </div>

            {/* Anomaly 3: Meter Drift Injection */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <Layers className="size-4 text-cyan-500" />
                  Meter Calibration Drift
                </h3>
                <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-[10px]">
                  Drift Wh
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Inject sudden positive or negative active import Wh drift to
                test Eichrecht / anomaly detection models.
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Offset Wh"
                  value={driftWh}
                  onChange={(e) => setDriftWh(e.target.value)}
                  className="h-8 text-xs bg-background border-border text-foreground rounded-lg font-mono"
                />
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold"
                  onClick={() =>
                    onTriggerScenario("meter-drift", {
                      connectorId: selectedConnectorId,
                      driftWh: parseInt(driftWh, 10),
                    })
                  }
                  disabled={loading}
                >
                  Inject Drift
                </Button>
              </div>
            </div>

            {/* Anomaly 4: Hardware Fault Injection */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <AlertTriangle className="size-4 text-rose-500" />
                  Hardware Fault Injection
                </h3>
                <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[10px]">
                  Fault
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Trigger hardware alarm to test auto-healing playbooks and
                maintenance alerts.
              </p>
              <div className="flex gap-2">
                <Select
                  value={faultErrorCode}
                  onValueChange={setFaultErrorCode}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg">
                    <SelectValue placeholder="Fault Code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GroundFailure">GroundFailure</SelectItem>
                    <SelectItem value="HighTemperature">
                      HighTemperature
                    </SelectItem>
                    <SelectItem value="OverCurrentFailure">
                      OverCurrentFailure
                    </SelectItem>
                    <SelectItem value="UnderVoltage">UnderVoltage</SelectItem>
                    <SelectItem value="OverVoltage">OverVoltage</SelectItem>
                    <SelectItem value="PowerMeterFailure">
                      PowerMeterFailure
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 rounded-lg text-xs font-bold"
                  onClick={() =>
                    onTriggerScenario("fault-inject", {
                      connectorId: selectedConnectorId,
                      errorCode: faultErrorCode,
                    })
                  }
                  disabled={loading}
                >
                  Inject
                </Button>
              </div>
            </div>

            {/* Anomaly 4b: Multi-Vendor Hardware Error Presets */}
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <ShieldAlert className="size-4 text-orange-500" />
                  Vendor Hardware Faults
                </h3>
                <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-300 text-[10px]">
                  {selectedVendorBrand}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Inject manufacturer vendor error code to test auto-healing playbooks.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={selectedVendorBrand}
                  onValueChange={(brand: "Raedian" | "Alfen" | "Easee" | "Zaptec" | "Peblar") => {
                    setSelectedVendorBrand(brand);
                    if (brand === "Raedian") setSelectedVendorCode("E00008");
                    else if (brand === "Alfen") setSelectedVendorCode("101");
                    else if (brand === "Easee") setSelectedVendorCode("7");
                    else if (brand === "Zaptec") setSelectedVendorCode("1");
                    else if (brand === "Peblar") setSelectedVendorCode("1000");
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Raedian">Raedian</SelectItem>
                    <SelectItem value="Alfen">Alfen</SelectItem>
                    <SelectItem value="Easee">Easee</SelectItem>
                    <SelectItem value="Zaptec">Zaptec</SelectItem>
                    <SelectItem value="Peblar">Peblar</SelectItem>
                  </SelectContent>
                </Select>

                <div className="col-span-2 flex gap-2">
                  <Select
                    value={selectedVendorCode}
                    onValueChange={setSelectedVendorCode}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background border-border text-foreground rounded-lg flex-1">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedVendorBrand === "Raedian" &&
                        Object.values(RAEDIAN_ERROR_CODES).map((item) => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.code} - {item.errorType}
                          </SelectItem>
                        ))}
                      {selectedVendorBrand === "Alfen" &&
                        Object.values(ALFEN_ERROR_CODES).map((item) => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                      {selectedVendorBrand === "Easee" &&
                        Object.values(EASEE_REASONS).map((item) => (
                          <SelectItem key={String(item.code)} value={String(item.code)}>
                            {item.code} - {item.enumName}
                          </SelectItem>
                        ))}
                      {selectedVendorBrand === "Zaptec" &&
                        Object.values(ZAPTEC_FLAGS).map((item) => (
                          <SelectItem key={String(item.value)} value={String(item.value)}>
                            {item.value} - {item.name}
                          </SelectItem>
                        ))}
                      {selectedVendorBrand === "Peblar" &&
                        Object.values(PEBLAR_CODES).map((item) => (
                          <SelectItem key={item.code} value={item.code}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                    onClick={() => {
                      let mappedOcpp = "OtherError";
                      if (selectedVendorBrand === "Raedian") {
                        mappedOcpp = RAEDIAN_ERROR_CODES[selectedVendorCode]?.ocppErrorCodeMapped || "OtherError";
                      } else if (selectedVendorBrand === "Alfen") {
                        mappedOcpp = ALFEN_ERROR_CODES[selectedVendorCode]?.ocppErrorCodeMapped || "OtherError";
                      } else if (selectedVendorBrand === "Easee") {
                        mappedOcpp = EASEE_REASONS[selectedVendorCode]?.ocppErrorCodeMapped || "OtherError";
                      } else if (selectedVendorBrand === "Zaptec") {
                        mappedOcpp = ZAPTEC_FLAGS[parseInt(selectedVendorCode, 10)]?.ocppErrorCodeMapped || "OtherError";
                      } else if (selectedVendorBrand === "Peblar") {
                        mappedOcpp = PEBLAR_CODES[selectedVendorCode]?.ocppErrorCodeMapped || "OtherError";
                      }

                      onTriggerScenario("fault-inject", {
                        connectorId: selectedConnectorId,
                        errorCode: mappedOcpp,
                        vendorErrorCode: selectedVendorCode,
                        vendorId: selectedVendorBrand.toUpperCase(),
                      });
                    }}
                    disabled={loading}
                  >
                    Inject
                  </Button>
                </div>
              </div>
            </div>

            {/* Anomaly 5 & 6: Network Outage & Store-and-Forward Buffering */}
            <div className="col-span-1 md:col-span-2 p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                  <WifiOff className="size-4 text-amber-500" />
                  Offline Store-and-Forward Buffering
                </h3>
                <Badge
                  className={cn(
                    "text-[10px]",
                    offlineBuffer.length > 0
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {offlineBuffer.length} Frames Queued
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cut the broadband/LTE connection. The simulated charger will
                continue charging, advance meter values, and record stops
                offline into its internal FIFO buffer. Once reconnected, flush
                the backlog to verify CPMS store-and-forward reconciliation.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant={isBufferingOffline ? "default" : "outline"}
                  className={cn(
                    "rounded-lg text-xs font-bold",
                    isBufferingOffline
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10"
                  )}
                  onClick={() => {
                    const next = !isBufferingOffline;
                    setIsBufferingOffline(next);
                    onTriggerScenario("offline-buffer-toggle", {
                      enableBuffering: next,
                    });
                  }}
                  disabled={loading}
                >
                  {isBufferingOffline ? (
                    <>
                      <Wifi className="size-3 mr-1.5" /> Stop Buffering
                    </>
                  ) : (
                    <>
                      <WifiOff className="size-3 mr-1.5" /> Cut Network & Buffer
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold"
                  onClick={() => {
                    setIsBufferingOffline(false);
                    onTriggerScenario("offline-buffer-flush");
                  }}
                  disabled={loading || offlineBuffer.length === 0}
                >
                  <RefreshCw className="size-3 mr-1.5" /> Reconnect & Flush (
                  {offlineBuffer.length})
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: AUTOMATED TEST LAB SUITES */}
        <TabsContent value="testsuites" className="space-y-5 m-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Suite 1 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    Happy Path Session
                  </h4>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                    E2E
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect ➔ Boot ➔ Cable Plug ➔ Authorize RFID ➔ StartTx ➔ 3x
                  MeterValues ➔ StopTx ➔ Unplug.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold"
                onClick={() => handleRunSuite("happy_path")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "happy_path" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>

            {/* Suite 2 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <Zap className="size-4 text-cyan-500" />
                    Smart Charging Derate
                  </h4>
                  <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px]">
                    LMS
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Start @ 22 kW ➔ Receive SetChargingProfile (6A / 4.1 kW) ➔
                  Validate telemetry drop ➔ Clean up.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold"
                onClick={() => handleRunSuite("smart_charging")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "smart_charging" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>

            {/* Suite 3 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <WifiOff className="size-4 text-amber-500" />
                    Store-and-Forward
                  </h4>
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                    Buffer
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Start Tx ➔ Disconnect link ➔ Queue 2 offline MeterValues &
                  Stop ➔ Reconnect & flush backlog.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold"
                onClick={() => handleRunSuite("offline_buffering")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "offline_buffering" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>

            {/* Suite 4 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <Unplug className="size-4 text-rose-500" />
                    Premature Disconnect
                  </h4>
                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">
                    Anomaly
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Start session ➔ Forcefully unlatch cable ➔ Validate
                  EVDisconnected stop reason and auto-recovery.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold"
                onClick={() => handleRunSuite("premature_disconnect")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "premature_disconnect" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>

            {/* Suite 5 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <AlertTriangle className="size-4 text-orange-500" />
                    Hardware Fault Recovery
                  </h4>
                  <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px]">
                    Auto-Heal
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Inject HighTemperature fault ➔ Verify Faulted status ➔
                  Simulate thermal cooldown & reset.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-700 dark:text-orange-300 text-xs font-bold"
                onClick={() => handleRunSuite("hardware_fault_recovery")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "hardware_fault_recovery" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>

            {/* Suite 6 */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-heading">
                    <ShieldCheck className="size-4 text-purple-500" />
                    Blocked RFID Rejection
                  </h4>
                  <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]">
                    Security
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Present blocked card (SIM-RFID-BLOCKED-02) ➔ Validate CPMS
                  properly returns Invalid/Blocked.
                </p>
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-bold"
                onClick={() => handleRunSuite("unauthorized_rfid")}
                disabled={loading || activeSuiteId !== null}
              >
                {activeSuiteId === "unauthorized_rfid" ? (
                  <RefreshCw className="size-3 animate-spin mr-1.5" />
                ) : (
                  <PlayCircle className="size-3 mr-1.5" />
                )}
                Run Suite
              </Button>
            </div>
          </div>

          {/* Test Suite Progress & Results Output */}
          {suiteReport && (
            <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2 font-heading">
                    {suiteReport.passed ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <XCircle className="size-4 text-rose-500" />
                    )}
                    {suiteReport.suiteName || suiteReport.suiteId}
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono">
                    Completed in {suiteReport.durationMs || 0} ms
                  </span>
                </div>
                <Badge
                  className={cn(
                    "text-xs font-mono font-bold px-3 py-1",
                    suiteReport.passed
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30"
                  )}
                >
                  {suiteReport.passed ? "ALL PASSED ✓" : "TEST FAILED ✗"}
                </Badge>
              </div>

              <div className="space-y-2">
                {suiteReport.steps?.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2.5">
                      {step.status === "passed" ? (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-foreground">
                          {step.name}
                        </span>
                        <span className="text-muted-foreground ml-2 text-[11px]">
                          {step.description}
                        </span>
                        {step.error && (
                          <div className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5 font-sans">
                            Error: {step.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-[10px]">
                      {step.durationMs ? `${step.durationMs}ms` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: RAW JSON-RPC FRAME TERMINAL */}
        <TabsContent value="frames" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Live Message Log Terminal */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-heading">
                  <Terminal className="size-3.5 text-purple-500" /> Bi-directional
                  Frame Stream
                </span>

                <div className="flex items-center gap-1.5">
                  {["ALL", "IN", "OUT", "ERROR"].map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={rawFrameFilter === f ? "default" : "ghost"}
                      className={cn(
                        "h-6 px-2 text-[10px] rounded-md font-mono",
                        rawFrameFilter === f
                          ? "bg-purple-500/30 text-purple-700 dark:text-purple-200 border border-purple-400/30"
                          : "text-muted-foreground"
                      )}
                      onClick={() => setRawFrameFilter(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="h-80 overflow-y-auto rounded-xl bg-muted/40 dark:bg-black/60 border border-border p-3 font-mono text-xs space-y-2 scrollbar-thin">
                {filteredLogs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-12">
                    No frames recorded yet. Send a command to begin.
                  </div>
                ) : (
                  filteredLogs.map((l) => {
                    const isOut = l.direction === "out";
                    const isError =
                      l.messageType === "CALLERROR" || l.status === "Error";
                    return (
                      <div
                        key={l.id}
                        className={cn(
                          "p-2 rounded-lg border text-[11px] leading-relaxed transition-all",
                          isError
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300"
                            : isOut
                            ? "bg-cyan-500/5 border-cyan-500/20 text-cyan-800 dark:text-cyan-200"
                            : "bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                        )}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.2 rounded text-[9px]",
                                isOut
                                  ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                                  : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              )}
                            >
                              {isOut ? "OUT ➔" : "IN ⬅"}
                            </span>
                            <span className="text-foreground">
                              {l.action || l.messageType}
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {new Date(l.timestamp).toLocaleTimeString()}
                            {l.latencyMs !== undefined
                              ? ` • ${l.latencyMs}ms`
                              : ""}
                          </span>
                        </div>
                        <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                          {JSON.stringify(l.payload, null, 2)}
                        </pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Raw JSON-RPC Frame Sender */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-heading">
                <Send className="size-3.5 text-cyan-500" /> Custom Frame
                Builder
              </span>

              <textarea
                value={rawFrameText}
                onChange={(e) => setRawFrameText(e.target.value)}
                rows={12}
                className="w-full rounded-xl bg-background border border-border p-3 font-mono text-xs text-foreground focus:outline-none focus:border-[#54a8c7] resize-none"
                placeholder="[2, 'msgId', 'Action', { ... }]"
              />

              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs border-border hover:bg-muted"
                  onClick={() =>
                    setRawFrameText(
                      JSON.stringify(
                        [
                          2,
                          `sim-call-${Date.now().toString().slice(-4)}`,
                          "Heartbeat",
                          {},
                        ],
                        null,
                        2
                      )
                    )
                  }
                >
                  Heartbeat Template
                </Button>

                <Button
                  size="sm"
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white font-bold text-xs"
                  onClick={handleSendRaw}
                  disabled={loading}
                >
                  <Send className="size-3 mr-1.5" /> Send Frame
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
