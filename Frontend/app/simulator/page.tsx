"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SimulatorDigitalTwin } from "@/components/simulator/SimulatorDigitalTwin";
import { SimulatorControlDeck } from "@/components/simulator/SimulatorControlDeck";
import { api } from "@/lib/api";
import {
  Zap,
  Play,
  Square,
  Terminal,
  Cpu,
  Layers,
  CheckCircle2,
  Radio,
  Server,
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
import { cn } from "@/lib/utils";

export interface ChargerTemplate {
  id: string;
  name: string;
  vendor: string;
  model: string;
  firmwareVersion: string;
  category: "AC_WALLBOX" | "AC_DUAL" | "DC_FAST" | "DC_HPC" | "V2G_BIDIRECTIONAL" | "SOLAR_OPTIMIZED";
  powerCapacityKw: number;
  defaultProtocol: "ocpp1.6" | "ocpp2.0.1" | "ocpp2.1";
  supportedProtocols: string[];
  description: string;
  features: string[];
  connectors: Array<{
    id: number;
    connectorName: string;
    type: string;
    format: string;
    maxPowerW: number;
    maxCurrentAmps: number;
    maxVoltageVolts: number;
    currentType: string;
    phaseConnection: string;
  }>;
}

const CATEGORY_LABELS: Record<string, { label: string; badgeClass: string }> = {
  AC_WALLBOX: { label: "AC Wallbox", badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  AC_DUAL: { label: "Dual Commercial", badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  DC_FAST: { label: "DC Fast Charger", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  DC_HPC: { label: "Ultra-Fast HPC", badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  V2G_BIDIRECTIONAL: { label: "V2G Bidirectional", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  SOLAR_OPTIMIZED: { label: "Solar Optimized", badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
};

export default function SimulatorPage() {
  const [templates, setTemplates] = useState<ChargerTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("alfen-eve-single");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [rfidTags, setRfidTags] = useState<any[]>([]);
  const [protocol, setProtocol] = useState<string>("ocpp1.6");
  const [customEndpoint, setCustomEndpoint] = useState<string>("");

  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Fetch available templates and test RFID tags from backend
  const loadFleetData = useCallback(async () => {
    try {
      const [templatesRes, tagsRes, sessionsRes] = await Promise.all([
        api.get("/simulator/templates"),
        api.get("/simulator/rfid-tags"),
        api.get("/simulator/sessions"),
      ]);

      const tplList: ChargerTemplate[] = templatesRes.data?.data || templatesRes.data || [];
      setTemplates(tplList);

      const tags = tagsRes.data?.data || tagsRes.data || [];
      setRfidTags(tags);

      const sessions = sessionsRes.data?.data || sessionsRes.data || [];
      if (sessions.length > 0 && !activeSession) {
        setActiveSession(sessions[0]);
      }
    } catch (err: any) {
      console.error("Failed to load simulator templates & data:", err);
    }
  }, [activeSession]);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // Poll active session state every 1.5s for live telemetry updates
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/simulator/sessions/${activeSession.id}`);
        if (res.data?.data) {
          setActiveSession(res.data.data);
        } else if (res.data) {
          setActiveSession(res.data);
        }
      } catch {
        // Session might have stopped
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSession]);

  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleSelectTemplate = (tpl: ChargerTemplate) => {
    setSelectedTemplateId(tpl.id);
    if (!tpl.supportedProtocols.includes(protocol)) {
      setProtocol(tpl.defaultProtocol);
    }
  };

  // Launch Virtual Charger from selected template
  const handleStartSimulator = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a charger template first");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        templateId: selectedTemplate.id,
        protocol,
      };
      if (customEndpoint.trim()) {
        payload.endpoint = customEndpoint.trim();
      }

      const res = await api.post("/simulator/start", payload);
      const sessionData = res.data?.data || res.data;
      setActiveSession(sessionData);
      toast.success(`Virtual Charger Started!`, {
        description: `Simulating ${selectedTemplate.name} via ${protocol.toUpperCase()}`,
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

  const filteredTemplates = templates.filter((tpl) => {
    if (selectedCategory === "ALL") return true;
    return tpl.category === selectedCategory;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-[#54a8c7] via-[#3f78e0] to-purple-600 text-white flex items-center justify-center shadow-lg shadow-[#54a8c7]/20">
                <Cpu className="size-5.5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  OCPP Hardware Simulator & Testbed
                  <Badge className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-mono">
                    v3.5 PRO
                  </Badge>
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Simulate realistic EV charging hardware templates across OCPP 1.6-J, 2.0.1, and 2.1 without touching physical chargers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/ocpp">
              <Button
                variant="outline"
                className="rounded-xl border-border hover:bg-muted/50 text-xs text-foreground"
              >
                <Terminal className="size-3.5 mr-1.5 text-purple-500" />
                Raw OCPP Inspector
              </Button>
            </Link>
          </div>
        </div>

        {/* Charger Template Catalog & Quick Launcher Bar */}
        {!activeSession && (
          <div className="space-y-4">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Templates:</span>
              {[
                { key: "ALL", label: "All Templates" },
                { key: "AC_WALLBOX", label: "AC Wallbox" },
                { key: "AC_DUAL", label: "Dual Commercial" },
                { key: "DC_FAST", label: "DC Fast (180kW)" },
                { key: "DC_HPC", label: "Ultra-Fast HPC (300kW)" },
                { key: "V2G_BIDIRECTIONAL", label: "V2G Bidirectional" },
                { key: "SOLAR_OPTIMIZED", label: "Solar Optimized" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap border",
                    selectedCategory === tab.key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Template Selection Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredTemplates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                const catMeta = CATEGORY_LABELS[tpl.category] || { label: tpl.category, badgeClass: "bg-muted text-muted-foreground" };

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 bg-card hover:shadow-md",
                      isSelected
                        ? "border-[#54a8c7] ring-2 ring-[#54a8c7]/20 shadow-lg shadow-[#54a8c7]/10"
                        : "border-border hover:border-[#54a8c7]/50 text-card-foreground"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold border", catMeta.badgeClass)}>
                          {catMeta.label}
                        </Badge>
                        <Badge variant="secondary" className="font-mono text-[10px] bg-muted/60">
                          {tpl.powerCapacityKw} kW
                        </Badge>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-foreground font-heading flex items-center gap-1.5">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">
                          {tpl.vendor} • {tpl.model}
                        </p>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="flex flex-wrap gap-1">
                        {tpl.connectors.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-foreground"
                          >
                            EVSE {c.id}: {c.type} ({Math.round(c.maxPowerW / 1000)}kW)
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span className="font-mono text-[10px]">{tpl.firmwareVersion}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[#54a8c7] font-bold text-xs">
                            <CheckCircle2 className="size-3.5" /> Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Simulator Session Control Bar */}
        <div className="p-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Template Selector Dropdown */}
            <div className="lg:col-span-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <Layers className="size-3.5 text-[#54a8c7]" />
                Simulated Charger Template
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(val) => {
                  const tpl = templates.find((t) => t.id === val);
                  if (tpl) handleSelectTemplate(tpl);
                }}
                disabled={activeSession !== null}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground rounded-xl">
                  <SelectValue placeholder="Select a Template" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.powerCapacityKw} kW) • {t.vendor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Protocol Selector */}
            <div className="lg:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <Radio className="size-3.5 text-purple-400" />
                Protocol
              </Label>
              <Select
                value={protocol}
                onValueChange={setProtocol}
                disabled={activeSession !== null}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground rounded-xl font-mono">
                  <SelectValue placeholder="Protocol" />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="ocpp1.6">OCPP 1.6-J</SelectItem>
                  <SelectItem value="ocpp2.0.1">OCPP 2.0.1</SelectItem>
                  <SelectItem value="ocpp2.1">OCPP 2.1 (Draft)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom WS URL */}
            <div className="lg:col-span-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <Server className="size-3.5 text-emerald-400" />
                Custom Endpoint (Optional)
              </Label>
              <Input
                placeholder="Default: ws://localhost:9220/OCPP/..."
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                disabled={activeSession !== null}
                className="h-9 text-xs bg-background border-border text-foreground font-mono rounded-xl"
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
                  disabled={loading || !selectedTemplate}
                  className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-emerald-500/20"
                >
                  <Play className="size-3.5 mr-1.5 fill-white" />
                  Launch {selectedTemplate?.vendor || "Virtual"} Charger
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
          <div className="p-8 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-4 shadow-sm">
            <div className="size-14 rounded-3xl bg-muted/50 border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <Zap className="size-7 text-[#54a8c7]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-foreground font-heading">
                Ready to Emulate: {selectedTemplate?.name || "Select a Template"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Click <strong>Launch Virtual Charger</strong> to spin up an isolated hardware instance of this template connected to the CPMS over WebSocket.
              </p>
            </div>
            <Button
              onClick={handleStartSimulator}
              disabled={loading || !selectedTemplate}
              className="rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white text-xs font-bold shadow-md shadow-[#54a8c7]/20"
            >
              <Play className="size-3.5 mr-1.5 fill-white" />
              Launch {selectedTemplate?.name || "Charger"}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
