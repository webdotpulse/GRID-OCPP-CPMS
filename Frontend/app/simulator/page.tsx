"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SimulatorDigitalTwin, SimulatedConnectorState } from "@/components/simulator/SimulatorDigitalTwin";
import { SimulatorControlDeck } from "@/components/simulator/SimulatorControlDeck";
import { api } from "@/lib/api";
import {
  Zap,
  Play,
  Square,
  PlusCircle,
  Terminal,
  RotateCcw,
  Sparkles,
  Wifi,
  WifiOff,
  Cpu,
  Layers,
  ChevronRight,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";

export default function SimulatorPage() {
  const [chargers, setChargers] = useState<any[]>([]);
  const [rfidTags, setRfidTags] = useState<any[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState<string>("");
  const [protocol, setProtocol] = useState<string>("ocpp1.6");
  const [customEndpoint, setCustomEndpoint] = useState<string>("");

  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Fetch registered chargers and RFID tags from backend
  const loadFleetData = useCallback(async () => {
    try {
      const [chargersRes, tagsRes, sessionsRes] = await Promise.all([
        api.get("/chargers"),
        api.get("/simulator/rfid-tags"),
        api.get("/simulator/sessions"),
      ]);

      const fleet = chargersRes.data || [];
      setChargers(fleet);

      const tags = tagsRes.data || [];
      setRfidTags(tags);

      const sessions = sessionsRes.data || [];
      if (sessions.length > 0 && !activeSession) {
        // Automatically select the first active simulator session
        setActiveSession(sessions[0]);
        setSelectedChargerId(String(sessions[0].chargerId));
      } else if (fleet.length > 0 && !selectedChargerId) {
        setSelectedChargerId(String(fleet[0].charger_id));
      }
    } catch (err: any) {
      console.error("Failed to load fleet data for simulator:", err);
    }
  }, [activeSession, selectedChargerId]);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // Poll active session state every 1.5s for live telemetry updates
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/simulator/sessions/${activeSession.id}`);
        if (res.data) {
          setActiveSession(res.data);
        }
      } catch {
        // Session might have stopped
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSession]);

  // 1-Click Quick Provision
  const handleQuickProvision = async () => {
    setIsProvisioning(true);
    try {
      const res = await api.post("/simulator/quick-provision", {});
      toast.success("Sandbox Test Charger Provisioned!", {
        description: `Created charger ${res.data?.charger?.name} with 2 EVSE connectors and test RFID pass.`,
      });
      await loadFleetData();
      if (res.data?.charger?.charger_id) {
        setSelectedChargerId(String(res.data.charger.charger_id));
      }
    } catch (err: any) {
      toast.error("Failed to provision test charger", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  // Launch / Connect Virtual Charger
  const handleStartSimulator = async () => {
    if (!selectedChargerId) {
      toast.error("Please select a charger first");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        chargerId: Number(selectedChargerId),
        protocol,
      };
      if (customEndpoint.trim()) {
        payload.endpoint = customEndpoint.trim();
      }

      const res = await api.post("/simulator/start", payload);
      setActiveSession(res.data);
      toast.success(`Virtual Charger Started!`, {
        description: `Connected to ${res.data?.endpoint || "OCPP WebSocket"}`,
      });
    } catch (err: any) {
      toast.error("Failed to start simulator", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Stop Virtual Charger
  const handleStopSimulator = async () => {
    if (!activeSession) return;

    setLoading(true);
    try {
      await api.post(`/simulator/sessions/${activeSession.id}/stop`);
      toast.info("Virtual Charger Disconnected");
      setActiveSession(null);
    } catch (err: any) {
      toast.error("Failed to stop simulator", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Action Dispatcher
  const handleSendAction = async (action: string, payload?: any) => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const res = await api.post(`/simulator/sessions/${activeSession.id}/action`, {
        action,
        connectorId: selectedConnectorId,
        ...payload,
      });
      if (res.data?.session) {
        setActiveSession(res.data.session);
      }
      toast.success(`Dispatched ${action}`);
      return res.data;
    } catch (err: any) {
      toast.error(`Action ${action} Failed`, {
        description: err.response?.data?.error || err.message,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Scenario Dispatcher
  const handleTriggerScenario = async (scenario: string, payload?: any) => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const res = await api.post(`/simulator/sessions/${activeSession.id}/scenario`, {
        scenario,
        connectorId: selectedConnectorId,
        ...payload,
      });
      if (res.data?.session) {
        setActiveSession(res.data.session);
      }
      toast.success(`Scenario Applied: ${scenario}`);
      return res.data;
    } catch (err: any) {
      toast.error(`Scenario Failed`, {
        description: err.response?.data?.error || err.message,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Test Suite Runner
  const handleRunTestSuite = async (suiteId: string) => {
    if (!activeSession) {
      toast.error("Please launch a virtual charger session first");
      return;
    }
    const res = await api.post(`/simulator/sessions/${activeSession.id}/test-suite`, {
      suiteId,
    });
    return res.data;
  };

  // Raw Frame Sender
  const handleSendRawFrame = async (frame: any[]) => {
    if (!activeSession) return;
    const res = await api.post(`/simulator/sessions/${activeSession.id}/raw-frame`, {
      frame,
    });
    toast.success("Raw Frame Dispatched");
    return res.data;
  };

  // Toggle physical plug on connector
  const handleTogglePlug = async (connectorId: number) => {
    const conn = activeSession?.connectors?.find((c: any) => c.id === connectorId);
    if (conn?.isPlugged) {
      await handleSendAction("Unplug", { connectorId });
    } else {
      await handleSendAction("PlugIn", { connectorId });
    }
  };

  const selectedCharger = chargers.find(
    (c) => String(c.charger_id) === String(selectedChargerId)
  );

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-[#54a8c7] via-[#3f78e0] to-purple-600 text-white flex items-center justify-center shadow-lg shadow-[#54a8c7]/20">
                <Cpu className="size-5.5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-white flex items-center gap-2">
                  OCPP Charger Simulator & Test Lab
                  <Badge className="bg-gradient-to-r from-[#54a8c7]/20 to-[#3f78e0]/20 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-mono">
                    v3.4 PRO
                  </Badge>
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Hardware emulation testbed for OCPP 1.6-J and 2.0.1 / 2.1: dynamic load balancing, cable faults, offline buffering, and automated conformance test suites.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handleQuickProvision}
              disabled={isProvisioning}
              className="rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white text-xs font-bold shadow-md shadow-[#54a8c7]/20"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              {isProvisioning ? "Provisioning..." : "Quick Provision Test Station"}
            </Button>

            <Link href="/ocpp">
              <Button
                variant="outline"
                className="rounded-xl border-white/10 hover:bg-white/5 text-xs text-white"
              >
                <Terminal className="size-3.5 mr-1.5 text-purple-400" />
                Packet Inspector
              </Button>
            </Link>
          </div>
        </div>

        {/* Simulator Session Launcher Bar */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#1e2228] shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Charger Selector */}
            <div className="lg:col-span-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Target Simulated Charge Point
              </Label>
              <Select
                value={selectedChargerId}
                onValueChange={setSelectedChargerId}
                disabled={activeSession !== null}
              >
                <SelectTrigger className="h-9 text-xs bg-black/40 border-white/10 text-white rounded-xl">
                  <SelectValue placeholder="Select a Charger" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-white/10 text-white max-h-60">
                  {chargers.map((c) => (
                    <SelectItem
                      key={c.charger_id}
                      value={String(c.charger_id)}
                    >
                      {c.name} ({c.model || "Standard AC"}) • {c.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Protocol Selector */}
            <div className="lg:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Protocol Version
              </Label>
              <Select
                value={protocol}
                onValueChange={setProtocol}
                disabled={activeSession !== null}
              >
                <SelectTrigger className="h-9 text-xs bg-black/40 border-white/10 text-white rounded-xl font-mono">
                  <SelectValue placeholder="Protocol" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-white/10 text-white font-mono">
                  <SelectItem value="ocpp1.6">OCPP 1.6-J</SelectItem>
                  <SelectItem value="ocpp2.0.1">OCPP 2.0.1</SelectItem>
                  <SelectItem value="ocpp2.1">OCPP 2.1 (Draft)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom WS URL */}
            <div className="lg:col-span-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Custom WebSocket Endpoint (Optional)
              </Label>
              <Input
                placeholder={`Default: ws://localhost:9220/OCPP/...`}
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                disabled={activeSession !== null}
                className="h-9 text-xs bg-black/40 border-white/10 text-white font-mono rounded-xl"
              />
            </div>

            {/* Connect / Disconnect Action Button */}
            <div className="lg:col-span-3 flex items-center gap-2">
              {activeSession ? (
                <Button
                  onClick={handleStopSimulator}
                  disabled={loading}
                  variant="destructive"
                  className="w-full h-9 rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20"
                >
                  <Square className="size-3.5 mr-1.5 fill-white" />
                  Disconnect Simulator
                </Button>
              ) : (
                <Button
                  onClick={handleStartSimulator}
                  disabled={loading || !selectedChargerId}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-emerald-500/20"
                >
                  <Play className="size-3.5 mr-1.5 fill-white" />
                  Launch Virtual Charger
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Digital Twin & Interactive Dashboard */}
        {activeSession ? (
          <div className="space-y-6">
            <SimulatorDigitalTwin
              chargerName={activeSession.chargerName}
              vendor={activeSession.vendor}
              model={activeSession.model}
              protocol={activeSession.protocol}
              firmwareVersion={activeSession.firmwareVersion}
              status={activeSession.status}
              connectors={activeSession.connectors || []}
              selectedConnectorId={selectedConnectorId}
              onSelectConnector={setSelectedConnectorId}
              onTogglePlug={handleTogglePlug}
              loading={loading}
            />

            <SimulatorControlDeck
              sessionId={activeSession.id}
              chargerName={activeSession.chargerName}
              protocol={activeSession.protocol}
              selectedConnectorId={selectedConnectorId}
              rfidTags={rfidTags}
              logs={activeSession.logs || []}
              offlineBuffer={activeSession.offlineBuffer || []}
              onSendAction={handleSendAction}
              onTriggerScenario={handleTriggerScenario}
              onRunTestSuite={handleRunTestSuite}
              onSendRawFrame={handleSendRawFrame}
              loading={loading}
            />
          </div>
        ) : (
          <div className="p-12 rounded-2xl border border-dashed border-white/10 bg-black/20 text-center space-y-4">
            <div className="size-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-muted-foreground">
              <Zap className="size-8 text-[#54a8c7]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-bold text-white">
                No Virtual Charger Running
              </h3>
              <p className="text-xs text-muted-foreground">
                Select a charger above and click <strong>Launch Virtual Charger</strong> or click <strong>Quick Provision Test Station</strong> to automatically spin up a test lab environment.
              </p>
            </div>
            <Button
              onClick={handleQuickProvision}
              disabled={isProvisioning}
              className="rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white text-xs font-bold"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              Auto-Provision Test Station & Start
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
