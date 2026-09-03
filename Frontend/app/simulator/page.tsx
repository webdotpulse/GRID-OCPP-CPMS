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
  Plus,
  Trash2,
  RefreshCw,
  Power,
  Activity,
  AlertTriangle,
  Sliders,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export interface SimulatedChargerItem {
  charger_id: number;
  name: string;
  model: string;
  manufacturer: string;
  power_capacity: number;
  firmware_version: string;
  status: string;
  chargeGroup?: {
    id: number;
    name: string;
    maxPower?: number;
  };
  evses: Array<{
    id: number;
    evse_id: number;
    connectors: Array<{
      connector_id: number;
      connector_name: string;
      status: string;
      current_type: string;
      max_power?: number;
      format?: string;
    }>;
  }>;
  simSession: any | null;
  simStatus: "connected" | "disconnected" | "connecting" | "offline_buffering" | "error";
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
  const [rfidTags, setRfidTags] = useState<any[]>([]);
  const [simulatedChargers, setSimulatedChargers] = useState<SimulatedChargerItem[]>([]);
  const [selectedChargerId, setSelectedChargerId] = useState<number | null>(null);

  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Add Charger Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [creationTab, setCreationTab] = useState<"template" | "custom">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("alfen-eve-single");
  const [modalSocketCount, setModalSocketCount] = useState<1 | 2>(1);
  const [modalName, setModalName] = useState("");
  const [modalProtocol, setModalProtocol] = useState<string>("ocpp1.6");
  const [modalPowerKw, setModalPowerKw] = useState<number>(22);
  const [modalConnectorType, setModalConnectorType] = useState<string>("Type2");

  // Delete confirmation state
  const [chargerToDelete, setChargerToDelete] = useState<SimulatedChargerItem | null>(null);

  // Load fleet chargers, templates, and RFID tags
  const loadFleetData = useCallback(async () => {
    try {
      const [templatesRes, tagsRes, chargersRes] = await Promise.all([
        api.get("/simulator/templates"),
        api.get("/simulator/rfid-tags"),
        api.get("/simulator/chargers"),
      ]);

      const tplList: ChargerTemplate[] = templatesRes.data?.data || templatesRes.data || [];
      setTemplates(tplList);

      const tags = tagsRes.data?.data || tagsRes.data || [];
      setRfidTags(tags);

      const chargers: SimulatedChargerItem[] = chargersRes.data?.data || chargersRes.data || [];
      setSimulatedChargers(chargers);

      // Auto-select first charger if none selected or if selected was removed
      if (chargers.length > 0) {
        setSelectedChargerId((prev) => {
          if (prev && chargers.some((c) => c.charger_id === prev)) {
            return prev;
          }
          return chargers[0].charger_id;
        });
      } else {
        setSelectedChargerId(null);
        setActiveSession(null);
      }
    } catch (err: any) {
      console.error("Failed to load simulator data:", err);
    }
  }, []);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // Current selected charger
  const currentCharger = simulatedChargers.find((c) => c.charger_id === selectedChargerId) || null;

  // Sync activeSession when selected charger changes or when session updates
  useEffect(() => {
    if (!currentCharger) {
      setActiveSession(null);
      return;
    }

    if (currentCharger.simSession) {
      setActiveSession(currentCharger.simSession);
      const conns = currentCharger.simSession.connectors || [];
      if (conns.length > 0 && !conns.some((c: any) => c.id === selectedConnectorId)) {
        setSelectedConnectorId(conns[0].id);
      }
    } else {
      // Check if session can be retrieved by charger_id
      api
        .get(`/simulator/sessions/${currentCharger.charger_id}`)
        .then((res) => {
          const session = res.data?.data || res.data;
          if (session) {
            setActiveSession(session);
          }
        })
        .catch(() => {
          setActiveSession(null);
        });
    }
  }, [currentCharger, selectedConnectorId]);

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
        // Session might have disconnected
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Handle template selection in Add modal
  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setModalSocketCount(tpl.connectors.length === 2 ? 2 : 1);
      setModalPowerKw(tpl.powerCapacityKw);
      setModalProtocol(tpl.defaultProtocol);
      setModalConnectorType(tpl.connectors[0]?.type || "Type2");
    }
  };

  // Add / Provision New Test Charger
  const handleCreateCharger = async () => {
    setLoading(true);
    try {
      const selectedTpl = templates.find((t) => t.id === selectedTemplateId);
      const payload: any = {
        socketCount: modalSocketCount,
        protocol: modalProtocol,
        powerCapacityKw: modalPowerKw,
      };

      if (creationTab === "template" && selectedTpl) {
        payload.templateId = selectedTpl.id;
        if (modalName.trim()) payload.name = modalName.trim();
      } else {
        payload.name = modalName.trim() || undefined;
        payload.connectorType = modalConnectorType;
      }

      const res = await api.post("/simulator/chargers", payload);
      const newCharger = res.data?.data?.charger;
      const newSession = res.data?.data?.session;

      toast.success("Test Charger Created!", {
        description: `Successfully provisioned with ${modalSocketCount} socket(s) under Virtual Test Lab`,
      });

      setIsAddModalOpen(false);
      setModalName("");

      // Reload fleet list and focus on newly created charger
      await loadFleetData();
      if (newCharger?.charger_id) {
        setSelectedChargerId(newCharger.charger_id);
      }
      if (newSession) {
        setActiveSession(newSession);
      }
    } catch (err: any) {
      toast.error("Failed to create test charger", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete / Remove Test Charger
  const handleConfirmDeleteCharger = async () => {
    if (!chargerToDelete) return;

    setLoading(true);
    try {
      await api.delete(`/simulator/chargers/${chargerToDelete.charger_id}`);
      toast.success("Test Charger Removed", {
        description: `${chargerToDelete.name} has been disconnected and removed.`,
      });
      setChargerToDelete(null);
      await loadFleetData();
    } catch (err: any) {
      toast.error("Failed to remove test charger", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Start / Connect Simulator for selected charger
  const handleStartChargerSession = async (charger: SimulatedChargerItem) => {
    setLoading(true);
    try {
      const res = await api.post("/simulator/start", {
        chargerId: charger.charger_id,
        chargerName: charger.name,
      });

      const sessionData = res.data?.data || res.data;
      setActiveSession(sessionData);
      toast.success(`Simulator Connected: ${charger.name}`, {
        description: `Virtual test point is now active and online.`,
      });
      await loadFleetData();
    } catch (err: any) {
      toast.error("Failed to start simulator", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Stop / Disconnect Simulator for selected charger
  const handleStopChargerSession = async (charger: SimulatedChargerItem) => {
    setLoading(true);
    try {
      const targetId = activeSession?.id || charger.charger_id;
      await api.post(`/simulator/sessions/${targetId}/stop`);
      toast.info(`Simulator Disconnected: ${charger.name}`);
      setActiveSession(null);
      await loadFleetData();
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

  // Compute fleet statistics
  const totalChargers = simulatedChargers.length;
  const connectedChargers = simulatedChargers.filter(
    (c) => c.simStatus === "connected" || (activeSession && activeSession.chargerId === c.charger_id)
  ).length;
  const totalFleetPower = simulatedChargers.reduce(
    (sum, c) => sum + (c.power_capacity || 0),
    0
  );

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
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
                    Virtual Test Lab
                  </Badge>
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Run and control multiple isolated EV chargers simultaneously under the <strong>Virtual Test Lab</strong> charge group with realistic hardware simulation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white text-xs font-bold shadow-md shadow-[#54a8c7]/20"
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Test Charger
            </Button>

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

        {/* Virtual Test Lab Charge Group Summary Card */}
        <div className="p-4 rounded-2xl border border-border bg-card text-card-foreground shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center border border-[#54a8c7]/30">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-heading text-foreground">
                  Charge Group: Virtual Test Lab
                </h3>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-mono">
                  Site Balancing Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                All simulated hardware units report under this cluster for dynamic solar & grid capacity arbitration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-muted-foreground mr-1.5">Fleet:</span>
              <strong className="text-foreground">{totalChargers} Chargers</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-muted-foreground mr-1.5">Online:</span>
              <strong className="text-emerald-500 font-bold">{connectedChargers} Active</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border">
              <span className="text-muted-foreground mr-1.5">Capacity:</span>
              <strong className="text-[#54a8c7] font-bold">{totalFleetPower} kW</strong>
            </div>
          </div>
        </div>

        {/* Fleet Selector Deck (Multi-Charger Handling) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="size-3.5 text-[#54a8c7]" />
              Testbed Fleet ({simulatedChargers.length} Chargers)
            </h2>
            <span className="text-xs text-muted-foreground">
              Select any test charger below to view telemetry and dispatch controls.
            </span>
          </div>

          {simulatedChargers.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border bg-card/40 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <Zap className="size-6 text-[#54a8c7]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">No test chargers created yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click <strong>Add Test Charger</strong> to launch your first virtual charging point with 1 socket or 2 sockets.
                </p>
              </div>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white text-xs font-bold"
              >
                <Plus className="size-3.5 mr-1.5" />
                Add First Test Charger
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {simulatedChargers.map((c) => {
                const isSelected = selectedChargerId === c.charger_id;
                const isOnline =
                  c.simStatus === "connected" ||
                  (activeSession && activeSession.chargerId === c.charger_id && activeSession.status === "connected");
                const socketCount = c.evses?.reduce((acc, ev) => acc + (ev.connectors?.length || 1), 0) || 1;

                return (
                  <div
                    key={c.charger_id}
                    onClick={() => setSelectedChargerId(c.charger_id)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 bg-card hover:shadow-md",
                      isSelected
                        ? "border-[#54a8c7] ring-2 ring-[#54a8c7]/25 shadow-lg shadow-[#54a8c7]/10"
                        : "border-border hover:border-[#54a8c7]/50"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                            )}
                          />
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-mono font-semibold px-1.5 py-0 border",
                              isOnline
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {isOnline ? "ONLINE" : "DISCONNECTED"}
                          </Badge>
                        </div>

                        {/* Sockets Count Badge */}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono px-1.5 py-0",
                            socketCount === 1
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          )}
                        >
                          {socketCount === 1 ? "1 Socket" : "2 Sockets"}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-foreground font-heading truncate">
                          {c.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.manufacturer} • {c.model}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <span className="font-mono text-[10px]">{c.power_capacity} kW</span>
                        <span className="font-mono text-[10px]">{c.firmware_version}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {isOnline ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStopChargerSession(c);
                          }}
                          disabled={loading}
                          className="h-7 text-[10px] px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Power className="size-3 mr-1" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChargerId(c.charger_id);
                            handleStartChargerSession(c);
                          }}
                          disabled={loading}
                          className="h-7 text-[10px] px-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg font-bold"
                        >
                          <Play className="size-3 mr-1 fill-emerald-500" />
                          Connect
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChargerToDelete(c);
                        }}
                        disabled={loading}
                        className="size-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        title="Remove Test Charger"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Selected Charger Workstation */}
        {currentCharger && (
          <div className="space-y-6">
            {activeSession && activeSession.status === "connected" ? (
              <>
                <SimulatorDigitalTwin
                  chargerName={currentCharger.name}
                  vendor={currentCharger.manufacturer || activeSession.vendor}
                  model={currentCharger.model || activeSession.model}
                  protocol={activeSession.protocol || "ocpp1.6"}
                  firmwareVersion={currentCharger.firmware_version || activeSession.firmwareVersion}
                  status={activeSession.status}
                  chargeGroupName="Virtual Test Lab"
                  connectors={activeSession.connectors || []}
                  selectedConnectorId={selectedConnectorId}
                  onSelectConnector={setSelectedConnectorId}
                  onTogglePlug={handleTogglePlug}
                  loading={loading}
                />

                <SimulatorControlDeck
                  sessionId={activeSession.id}
                  chargerName={currentCharger.name}
                  protocol={activeSession.protocol || "ocpp1.6"}
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
              </>
            ) : (
              <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-4 shadow-sm">
                <div className="size-14 rounded-3xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                  <Power className="size-7 text-[#54a8c7]" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-base font-bold text-foreground font-heading">
                      {currentCharger.name} (Disconnected)
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {currentCharger.evses?.reduce((acc, ev) => acc + (ev.connectors?.length || 1), 0) || 1} Socket(s)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This simulated charger is saved in the Virtual Test Lab. Click <strong>Connect Simulator</strong> to establish its live WebSocket link to the CPMS.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => handleStartChargerSession(currentCharger)}
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    <Play className="size-3.5 mr-1.5 fill-white" />
                    Connect Simulator
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setChargerToDelete(currentCharger)}
                    disabled={loading}
                    className="rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 border-border"
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Remove Charger
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Test Charger */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-xl rounded-2xl border-border bg-card p-6">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-bold font-heading flex items-center gap-2">
                <Plus className="size-4 text-[#54a8c7]" />
                Add Test Charger to Virtual Test Lab
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure sockets, capacity, and protocol. Chargers are automatically assigned to the <strong>Virtual Test Lab</strong> charge group.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={creationTab} onValueChange={(v) => setCreationTab(v as any)} className="w-full mt-2">
              <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl mb-4">
                <TabsTrigger value="template" className="text-xs font-semibold rounded-lg">
                  ⚡ From Hardware Template
                </TabsTrigger>
                <TabsTrigger value="custom" className="text-xs font-semibold rounded-lg">
                  🛠️ Custom Configuration
                </TabsTrigger>
              </TabsList>

              {/* Template Tab */}
              <TabsContent value="template" className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold">
                    Select Hardware Model Template
                  </Label>
                  <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                    <SelectTrigger className="h-9 text-xs bg-background border-border rounded-xl">
                      <SelectValue placeholder="Choose a hardware template" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.powerCapacityKw} kW) • {tpl.connectors.length === 1 ? "1 Socket" : "2 Sockets"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Custom Tab */}
              <TabsContent value="custom" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Max Power (kW)
                    </Label>
                    <Input
                      type="number"
                      value={modalPowerKw}
                      onChange={(e) => setModalPowerKw(Number(e.target.value))}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Plug Format
                    </Label>
                    <Select value={modalConnectorType} onValueChange={setModalConnectorType}>
                      <SelectTrigger className="h-9 text-xs bg-background border-border rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Type2">Type 2 (AC Socket / 22kW)</SelectItem>
                        <SelectItem value="CCS2">CCS2 (DC Combo Cable / 150kW)</SelectItem>
                        <SelectItem value="CHAdeMO">CHAdeMO (DC Cable / 50kW)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Socket Count Selector (1 Socket vs 2 Sockets) */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="size-3.5 text-[#54a8c7]" />
                  Number of Sockets / Connectors
                </Label>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono",
                    modalSocketCount === 1 ? "text-emerald-500 border-emerald-500/30" : "text-blue-500 border-blue-500/30"
                  )}
                >
                  {modalSocketCount === 1 ? "Single EVSE (1 Socket)" : "Dual EVSE (2 Sockets)"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalSocketCount(1)}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                    modalSocketCount === 1
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  <CheckCircle2 className={cn("size-3.5", modalSocketCount === 1 ? "text-emerald-500" : "opacity-0")} />
                  1 Socket (Single Channel)
                </button>

                <button
                  type="button"
                  onClick={() => setModalSocketCount(2)}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                    modalSocketCount === 2
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40 shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  <CheckCircle2 className={cn("size-3.5", modalSocketCount === 2 ? "text-blue-500" : "opacity-0")} />
                  2 Sockets (Dual Channel)
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {modalSocketCount === 1
                  ? "Guarantees exactly 1 EVSE and 1 Socket in database. No second connector will be created."
                  : "Creates 2 EVSE channels for concurrent dual-vehicle charging."}
              </p>
            </div>

            {/* Custom Name & Protocol */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Charger Identifier (Optional)
                </Label>
                <Input
                  placeholder="e.g. SIM-LAB-01"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Protocol
                </Label>
                <Select value={modalProtocol} onValueChange={setModalProtocol}>
                  <SelectTrigger className="h-9 text-xs bg-background border-border rounded-xl font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-mono">
                    <SelectItem value="ocpp1.6">OCPP 1.6-J</SelectItem>
                    <SelectItem value="ocpp2.0.1">OCPP 2.0.1</SelectItem>
                    <SelectItem value="ocpp2.1">OCPP 2.1 (Draft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={loading}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCharger}
                disabled={loading}
                className="h-9 rounded-xl bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:brightness-110 text-white font-bold text-xs shadow-md shadow-[#54a8c7]/20"
              >
                {loading ? "Provisioning..." : "Provision & Launch Charger"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Delete Confirmation */}
        <Dialog open={chargerToDelete !== null} onOpenChange={(open) => !open && setChargerToDelete(null)}>
          <DialogContent className="max-w-md rounded-2xl border-border bg-card p-6">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold font-heading flex items-center gap-2 text-rose-500">
                <AlertTriangle className="size-4" />
                Remove Test Charger?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to remove <strong>{chargerToDelete?.name}</strong>? This will disconnect the active simulator WebSocket session and delete the test charger from the Virtual Test Lab.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3">
              <Button
                variant="outline"
                onClick={() => setChargerToDelete(null)}
                disabled={loading}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteCharger}
                disabled={loading}
                className="h-9 rounded-xl text-xs font-bold"
              >
                {loading ? "Removing..." : "Confirm Removal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
