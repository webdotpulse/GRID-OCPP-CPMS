"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Sparkles,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Cpu,
  Layers,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Zap,
  Radio,
  ArrowRight,
  Activity,
  Check,
  X,
  FileCode,
  Terminal,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PlaybookStep {
  stepNumber: number;
  action: string;
  params?: Record<string, any>;
  delayMs?: number;
  description?: string;
}

interface Playbook {
  id: number;
  name: string;
  vendor: string;
  modelPattern: string | null;
  errorCodePattern: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  cooldownMinutes: number;
  maxRetries: number;
  steps: PlaybookStep[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    executions: number;
  };
}

interface PlaybookStats {
  totalPlaybooks: number;
  activePlaybooks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  activeRunning: number;
  healedChargersCount: number;
  successRate: number;
}

interface ExecutionRecord {
  id: number;
  playbookId: number | null;
  chargerId: number;
  connectorId: number | null;
  triggerReason: string;
  matchedErrorCode: string | null;
  vendor: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED";
  currentStep: number;
  totalSteps: number;
  stepLogs: Array<{
    stepNumber: number;
    action: string;
    timestamp: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    durationMs?: number;
    details?: string;
    response?: any;
  }>;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  isResolved: boolean;
  playbook?: {
    name: string;
    vendor: string;
    category: string;
    severity: string;
  };
  charger?: {
    name: string;
    model: string;
    manufacturer: string;
    status: string;
  };
}

interface AiAnalysisResult {
  matchedPlaybook: Playbook | null;
  vendor: string;
  confidence: number;
  category: string;
  rootCause: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedSteps: string[];
  isAiParsed: boolean;
  rawDetails: {
    matchedErrorCode?: string;
    detectedVendor?: string;
    extractedTokens?: string[];
    suggestedAction?: string;
  };
}

const VENDOR_LIST = ["All", "Alfen", "EVBox", "ABB", "Schneider", "Kempower", "Generic"];
const CATEGORY_LIST = [
  "All",
  "ConnectorLock",
  "PowerElectronics",
  "Communications",
  "Thermal",
  "GridFault",
  "General",
];

const STEP_ACTIONS = [
  { value: "UnlockConnector", label: "Unlock Connector (Solenoid Release)" },
  { value: "SoftReset", label: "Soft Reset (OCPP Soft Reboot)" },
  { value: "HardReset", label: "Hard Reset (Hardware Power Cycle)" },
  { value: "ChangeAvailability", label: "Change Availability (Inoperative / Operative)" },
  { value: "SetChargingProfile", label: "Set Charging Profile (Derate / Limit Power)" },
  { value: "ClearChargingProfile", label: "Clear Charging Profile" },
  { value: "TriggerMessage", label: "Trigger Message (Status / MeterValues / Heartbeat)" },
  { value: "ChangeConfiguration", label: "Change Configuration Key" },
  { value: "DataTransfer", label: "Send Vendor DataTransfer" },
  { value: "DelayMs", label: "Pause / Delay (ms)" },
  { value: "SendNotification", label: "Send Notification / Webhook" },
];

const SAMPLE_LOGS = [
  {
    title: "Alfen Socket Lock Error (Err_023)",
    vendor: "Alfen",
    text: "Alfen Eve Single Pro: Connector 1 reported LockActuatorTimeout: Err_023 (Socket lock actuator timeout while attempting to release plug)",
  },
  {
    title: "ABB Control Pilot Voltage Drift (F_012)",
    vendor: "ABB",
    text: "ABB Terra 54: F_012_PILOT_FAULT: CP_DRIFT PWM pilot voltage measured at 8.7V (expected 9.0V +/- 0.5V), state transitioned to SuspendedEVSE",
  },
  {
    title: "EVBox RCD DC Leakage Alarm",
    vendor: "EVBox",
    text: "EVBox BusinessLine: EVB_ERR_RCD_TRIP GroundFailure residual 6mA DC leakage detected, connector disabled",
  },
  {
    title: "Kempower Satellite DC Isolation Fault (KP_ERR_33)",
    vendor: "Kempower",
    text: "Kempower C-Station Satellite #2: KP_SAT_ISO_FAIL DC bus insulation resistance measured below 100kOhm, interlock opened",
  },
  {
    title: "Schneider Contactor Stuck State",
    vendor: "Schneider",
    text: "Schneider EVlink: SCH_CONTACTOR_STUCK InternalError feedback aux relay contact not releasing after session end",
  },
];

export default function AutoHealPlaybooksPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("playbooks");
  const [loading, setLoading] = useState(true);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [stats, setStats] = useState<PlaybookStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [chargers, setChargers] = useState<any[]>([]);

  // Filters
  const [selectedVendor, setSelectedVendor] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Partial<Playbook> | null>(null);
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [selectedPlaybookToRun, setSelectedPlaybookToRun] = useState<Playbook | null>(null);
  const [targetChargerId, setTargetChargerId] = useState<string>("");
  const [targetConnectorId, setTargetConnectorId] = useState<string>("1");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");

  // AI Diagnostic Lab States
  const [aiLogInput, setAiLogInput] = useState(SAMPLE_LOGS[0].text);
  const [aiSelectedCharger, setAiSelectedCharger] = useState<string>("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);

  // Expanded playbook steps accordion
  const [expandedPlaybooks, setExpandedPlaybooks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPlaybooks(), fetchStats(), fetchExecutions(), fetchChargers()]);
    } catch (err) {
      console.error("Error loading initial data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaybooks = async () => {
    try {
      const res = await api.get("/auto-heal-playbooks");
      if (res.data?.success) {
        setPlaybooks(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to load playbooks");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/auto-heal-playbooks/stats");
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  const fetchExecutions = async () => {
    try {
      const res = await api.get("/auto-heal-playbooks/executions");
      if (res.data?.success) {
        setExecutions(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load executions", err);
    }
  };

  const fetchChargers = async () => {
    try {
      const res = await api.get("/chargers");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setChargers(list);
    } catch (err) {
      console.error("Failed to load chargers", err);
    }
  };

  const handleTogglePlaybook = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/auto-heal-playbooks/${id}/toggle`);
      if (res.data?.success) {
        setPlaybooks((prev) =>
          prev.map((pb) => (pb.id === id ? { ...pb, isActive: res.data.data.isActive } : pb))
        );
        toast.success(
          `Playbook ${res.data.data.isActive ? "Activated" : "Deactivated"} successfully`
        );
        fetchStats();
      }
    } catch (err) {
      toast.error("Failed to toggle playbook");
    }
  };

  const handleDeletePlaybook = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete playbook "${name}"?`)) return;
    try {
      const res = await api.delete(`/auto-heal-playbooks/${id}`);
      if (res.data?.success) {
        toast.success("Playbook deleted");
        fetchPlaybooks();
        fetchStats();
      }
    } catch (err) {
      toast.error("Failed to delete playbook");
    }
  };

  const handleSavePlaybook = async () => {
    if (!editingPlaybook?.name || !editingPlaybook?.vendor || !editingPlaybook?.errorCodePattern) {
      toast.error("Please fill in all required fields (Name, Vendor, Error Code Pattern)");
      return;
    }

    if (!editingPlaybook.steps || editingPlaybook.steps.length === 0) {
      toast.error("Playbook must have at least one execution step");
      return;
    }

    try {
      if (editingPlaybook.id) {
        // Update
        const res = await api.put(`/auto-heal-playbooks/${editingPlaybook.id}`, editingPlaybook);
        if (res.data?.success) {
          toast.success("Playbook updated successfully");
          setIsEditorOpen(false);
          fetchPlaybooks();
          fetchStats();
        }
      } else {
        // Create
        const res = await api.post("/auto-heal-playbooks", editingPlaybook);
        if (res.data?.success) {
          toast.success("Playbook created successfully");
          setIsEditorOpen(false);
          fetchPlaybooks();
          fetchStats();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save playbook");
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPlaybook({
      name: "",
      vendor: "Alfen",
      modelPattern: "",
      errorCodePattern: "",
      severity: "HIGH",
      category: "Hardware",
      description: "",
      priority: 100,
      cooldownMinutes: 15,
      maxRetries: 3,
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          action: "UnlockConnector",
          params: {},
          delayMs: 1500,
          description: "Attempt solenoid lock release pulse",
        },
        {
          stepNumber: 2,
          action: "SoftReset",
          params: { type: "Soft" },
          delayMs: 5000,
          description: "Initiate soft reboot of controller",
        },
        {
          stepNumber: 3,
          action: "TriggerMessage",
          params: { requestedMessage: "StatusNotification" },
          delayMs: 1000,
          description: "Request state verification from charger",
        },
      ],
    });
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (pb: Playbook) => {
    setEditingPlaybook({ ...pb });
    setIsEditorOpen(true);
  };

  const handleClonePlaybook = (pb: Playbook) => {
    setEditingPlaybook({
      ...pb,
      id: undefined,
      name: `${pb.name} (Copy)`,
      createdAt: undefined,
      updatedAt: undefined,
    });
    setIsEditorOpen(true);
  };

  const handleOpenExecuteModal = (pb: Playbook) => {
    setSelectedPlaybookToRun(pb);
    if (chargers.length > 0) {
      setTargetChargerId(String(chargers[0].charger_id));
    }
    setTargetConnectorId("1");
    setIsExecuteModalOpen(true);
  };

  const handleRunExecution = async () => {
    if (!selectedPlaybookToRun || !targetChargerId) {
      toast.error("Please select a target charger");
      return;
    }

    setIsExecuting(true);
    try {
      const res = await api.post(`/auto-heal-playbooks/${selectedPlaybookToRun.id}/execute`, {
        chargerId: parseInt(targetChargerId, 10),
        connectorId: parseInt(targetConnectorId, 10),
      });

      if (res.data?.success) {
        toast.success(`Playbook '${selectedPlaybookToRun.name}' triggered on charger #${targetChargerId}`);
        setIsExecuteModalOpen(false);
        fetchExecutions();
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to trigger playbook execution");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!aiLogInput.trim()) {
      toast.error("Please enter a raw diagnostic log or error code");
      return;
    }

    setAiAnalyzing(true);
    try {
      const res = await api.post("/auto-heal-playbooks/ai-analyze", {
        rawLog: aiLogInput,
        chargerId: aiSelectedCharger ? parseInt(aiSelectedCharger, 10) : undefined,
      });

      if (res.data?.success) {
        setAiResult(res.data.data);
        toast.success("AI Log Analysis Complete");
      }
    } catch (err) {
      toast.error("Failed to run AI log analysis");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await api.post("/auto-heal-playbooks/seed-defaults");
      if (res.data?.success) {
        toast.success(`Seeded default vendor playbooks (${res.data.count} items)`);
        fetchPlaybooks();
        fetchStats();
      }
    } catch (err) {
      toast.error("Failed to seed default playbooks");
    }
  };

  const handleExportPlaybooks = async () => {
    try {
      window.open(`${api.defaults.baseURL}/auto-heal-playbooks/export`, "_blank");
    } catch (err) {
      toast.error("Failed to export playbooks");
    }
  };

  const handleImportPlaybooks = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await api.post("/auto-heal-playbooks/import", parsed);
      if (res.data?.success) {
        toast.success(`Successfully imported ${res.data.count} playbooks`);
        setIsImportModalOpen(false);
        setImportJsonText("");
        fetchPlaybooks();
        fetchStats();
      }
    } catch (err: any) {
      toast.error("Invalid JSON format or import error");
    }
  };

  // Step manipulation in Editor
  const handleAddStep = () => {
    if (!editingPlaybook) return;
    const currentSteps = editingPlaybook.steps || [];
    const newStep: PlaybookStep = {
      stepNumber: currentSteps.length + 1,
      action: "UnlockConnector",
      params: {},
      delayMs: 2000,
      description: "Additional recovery action",
    };
    setEditingPlaybook({
      ...editingPlaybook,
      steps: [...currentSteps, newStep],
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editingPlaybook) return;
    const currentSteps = [...(editingPlaybook.steps || [])];
    currentSteps.splice(index, 1);
    // Renumber
    const renumbered = currentSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setEditingPlaybook({ ...editingPlaybook, steps: renumbered });
  };

  const handleStepChange = (index: number, field: keyof PlaybookStep, value: any) => {
    if (!editingPlaybook) return;
    const currentSteps = [...(editingPlaybook.steps || [])];
    currentSteps[index] = { ...currentSteps[index], [field]: value };
    setEditingPlaybook({ ...editingPlaybook, steps: currentSteps });
  };

  // Filter playbooks
  const filteredPlaybooks = playbooks.filter((pb) => {
    const matchesVendor = selectedVendor === "All" || pb.vendor === selectedVendor;
    const matchesCategory = selectedCategory === "All" || pb.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      pb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pb.description && pb.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      pb.errorCodePattern.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVendor && matchesCategory && matchesSearch;
  });

  const getVendorBadgeColor = (vendor: string) => {
    switch (vendor.toLowerCase()) {
      case "alfen":
        return "bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30";
      case "evbox":
        return "bg-[#45c4a0]/15 text-[#45c4a0] border-[#45c4a0]/30";
      case "abb":
        return "bg-[#e2626b]/15 text-[#e2626b] border-[#e2626b]/30";
      case "schneider":
        return "bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30";
      case "kempower":
        return "bg-[#fab758]/15 text-[#fab758] border-[#fab758]/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30">HIGH</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">MEDIUM</Badge>;
      default:
        return <Badge variant="secondary">LOW</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-xl bg-gradient-to-br from-[#54a8c7]/20 to-[#3f78e0]/20 text-[#54a8c7] flex items-center justify-center border border-[#54a8c7]/30 shadow-inner">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  Vendor-Specific Auto-Healing Playbooks
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold uppercase tracking-wider">
                    Self-Healing Engine
                  </Badge>
                </h1>
                <p className="text-sm text-muted-foreground">
                  AI-assisted error code recognition, tailored manufacturer recovery workflows, and automated multi-step remediation.
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} className="gap-1.5 text-xs">
              <RefreshCw className="size-3.5" />
              Seed Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPlaybooks} className="gap-1.5 text-xs">
              <Download className="size-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} className="gap-1.5 text-xs">
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button onClick={handleOpenCreateModal} size="sm" className="gap-1.5 bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20 text-xs font-semibold">
              <Plus className="size-4" />
              New Playbook
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card hoverLift className="card-border-top-primary">
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Active Playbooks</span>
                <Layers className="size-4 text-[#54a8c7]" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-extrabold text-foreground">
                {stats?.activePlaybooks ?? 0} <span className="text-xs font-normal text-muted-foreground">/ {stats?.totalPlaybooks ?? 0}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Multi-step recovery recipes</p>
            </CardContent>
          </Card>

          <Card hoverLift className="card-border-top-success">
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Success Rate</span>
                <CheckCircle2 className="size-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-extrabold text-emerald-500">
                {stats?.successRate ?? 100}%
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{stats?.successfulExecutions ?? 0} successful remediations</p>
            </CardContent>
          </Card>

          <Card hoverLift>
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Fleet Interventions</span>
                <Activity className="size-4 text-[#3f78e0]" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-extrabold text-foreground">
                {stats?.totalExecutions ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Total auto-heal triggers</p>
            </CardContent>
          </Card>

          <Card hoverLift>
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Healed Chargers</span>
                <Zap className="size-4 text-[#fab758]" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-extrabold text-foreground">
                {stats?.healedChargersCount ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Units restored without truck roll</p>
            </CardContent>
          </Card>

          <Card hoverLift>
            <CardHeader className="pb-1.5">
              <CardTitle className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Active Healing</span>
                <Radio className="size-4 text-[#e2626b] animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-extrabold text-foreground">
                {stats?.activeRunning ?? 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Sequences running now</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#1e2228]/80 border border-border/50 p-1 rounded-xl">
            <TabsTrigger value="playbooks" className="gap-2 data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white rounded-lg transition-all text-xs font-semibold">
              <Layers className="size-4" />
              Playbooks Library ({playbooks.length})
            </TabsTrigger>
            <TabsTrigger value="executions" className="gap-2 data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white rounded-lg transition-all text-xs font-semibold">
              <Activity className="size-4" />
              Live Remediation Stream ({executions.length})
            </TabsTrigger>
            <TabsTrigger value="ai-lab" className="gap-2 data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white rounded-lg transition-all text-xs font-semibold">
              <Sparkles className="size-4" />
              AI Log Diagnostic Lab
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PLAYBOOKS LIBRARY */}
          <TabsContent value="playbooks" className="space-y-6">
            {/* Filters Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Vendor Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Vendor:</span>
                    {VENDOR_LIST.map((vendor) => (
                      <Button
                        key={vendor}
                        variant={selectedVendor === vendor ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedVendor(vendor)}
                        className={`text-xs h-8 rounded-lg px-3 ${
                          selectedVendor === vendor
                            ? "bg-[#54a8c7] text-white hover:bg-[#54a8c7]/90"
                            : "hover:bg-muted"
                        }`}
                      >
                        {vendor}
                      </Button>
                    ))}
                  </div>

                  {/* Search and Category Filter */}
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search recipes, error codes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs bg-background/50"
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_LIST.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {cat === "All" ? "All Categories" : cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Playbooks Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredPlaybooks.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                    <Layers className="size-6" />
                  </div>
                  <h3 className="font-bold text-base text-foreground">No Playbooks Found</h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    No vendor playbooks matched your filter criteria. Try clearing filters or click &quot;Seed Defaults&quot; to load manufacturer recovery playbooks.
                  </p>
                  <Button size="sm" onClick={handleSeedDefaults} className="mt-2 text-xs">
                    Seed Standard Vendor Library
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPlaybooks.map((pb) => {
                  const isExpanded = expandedPlaybooks[pb.id] ?? false;
                  return (
                    <Card
                      key={pb.id}
                      hoverLift
                      className={`flex flex-col justify-between overflow-hidden transition-all border-border/60 ${
                        !pb.isActive ? "opacity-60 bg-muted/20" : ""
                      }`}
                    >
                      <div>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={`text-[11px] font-bold uppercase ${getVendorBadgeColor(pb.vendor)}`}>
                                {pb.vendor}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] bg-background/50 font-mono">
                                {pb.category}
                              </Badge>
                              {getSeverityBadge(pb.severity)}
                            </div>
                            <Switch
                              checked={pb.isActive}
                              onCheckedChange={(checked) => handleTogglePlaybook(pb.id, { stopPropagation: () => {} } as any)}
                              aria-label="Toggle active state"
                            />
                          </div>

                          <CardTitle className="text-base font-heading font-bold text-foreground mt-2 leading-snug">
                            {pb.name}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {pb.description || "Vendor-specific automated recovery playbook."}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3 pt-0">
                          {/* Error code pattern box */}
                          <div className="p-2.5 rounded-xl bg-[#1e2228]/50 border border-white/5 space-y-1">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                              <FileCode className="size-3 text-[#54a8c7]" />
                              Trigger Match Pattern:
                            </div>
                            <div className="font-mono text-xs text-[#54a8c7] truncate" title={pb.errorCodePattern}>
                              {pb.errorCodePattern}
                            </div>
                          </div>

                          {/* Multi-step workflow preview */}
                          <div className="space-y-1.5">
                            <div
                              onClick={() => setExpandedPlaybooks({ ...expandedPlaybooks, [pb.id]: !isExpanded })}
                              className="flex items-center justify-between text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors pt-1"
                            >
                              <span className="flex items-center gap-1.5">
                                <Sliders className="size-3.5 text-[#45c4a0]" />
                                Recovery Sequence ({pb.steps?.length || 0} Steps)
                              </span>
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </div>

                            {isExpanded ? (
                              <div className="space-y-2 pt-1 border-t border-border/40">
                                {(pb.steps as PlaybookStep[]).map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/40 border border-border/30">
                                    <div className="size-5 rounded-full bg-[#54a8c7]/20 text-[#54a8c7] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                      {step.stepNumber}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-foreground flex items-center justify-between">
                                        <span>{step.action}</span>
                                        {step.delayMs ? <span className="text-[10px] text-muted-foreground font-mono">+{step.delayMs}ms</span> : null}
                                      </div>
                                      {step.description ? (
                                        <p className="text-[11px] text-muted-foreground truncate">{step.description}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                                {(pb.steps as PlaybookStep[]).slice(0, 3).map((step, sIdx) => (
                                  <Badge key={sIdx} variant="secondary" className="text-[10px] font-mono shrink-0">
                                    {step.stepNumber}. {step.action}
                                  </Badge>
                                ))}
                                {pb.steps.length > 3 ? (
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    +{pb.steps.length - 3} more
                                  </Badge>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </div>

                      <CardFooter className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/10">
                        <Button
                          size="sm"
                          onClick={() => handleOpenExecuteModal(pb)}
                          className="flex-1 text-xs gap-1.5 bg-[#54a8c7]/15 hover:bg-[#54a8c7]/25 text-[#54a8c7] border border-[#54a8c7]/30"
                        >
                          <Play className="size-3.5 fill-current" />
                          Run on Charger
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleClonePlaybook(pb)} title="Clone Playbook">
                            <Copy className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleOpenEditModal(pb)} title="Edit Playbook">
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDeletePlaybook(pb.id, pb.name)} title="Delete Playbook">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: LIVE REMEDIATION STREAM & EXECUTIONS */}
          <TabsContent value="executions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Real-Time Remediation Stream</CardTitle>
                    <CardDescription className="text-xs">
                      Live timeline of automated playbook executions, step command results, and resolved hardware alerts.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchExecutions} className="gap-1.5 text-xs">
                    <RefreshCw className="size-3.5" /> Refresh Log
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {executions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="size-10 text-emerald-500/50" />
                    <p className="font-bold text-sm text-foreground">No Active Remediation Incidents</p>
                    <p className="text-xs text-muted-foreground">All charge points currently healthy or no playbooks executed yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {executions.map((exec) => {
                      const isComplete = exec.status === "COMPLETED";
                      const isRunning = exec.status === "RUNNING";
                      const isFailed = exec.status === "FAILED";

                      return (
                        <div
                          key={exec.id}
                          className="p-4 hover:bg-muted/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isComplete
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : isRunning
                                  ? "bg-[#54a8c7]/15 text-[#54a8c7] animate-pulse"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="size-5" />
                              ) : isRunning ? (
                                <Radio className="size-5" />
                              ) : (
                                <AlertCircle className="size-5" />
                              )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {exec.playbook?.name || "Auto-Heal Recovery Sequence"}
                                </span>
                                {exec.vendor ? (
                                  <Badge variant="outline" className={`text-[10px] ${getVendorBadgeColor(exec.vendor)}`}>
                                    {exec.vendor}
                                  </Badge>
                                ) : null}
                                <Badge
                                  variant={isComplete ? "soft-success" : isRunning ? "soft-primary" : "destructive"}
                                  className="text-[10px] font-bold uppercase"
                                >
                                  {exec.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                <span>Charger: <strong className="text-foreground font-mono">#{exec.chargerId} {exec.charger?.name ? `(${exec.charger.name})` : ""}</strong></span>
                                <span>•</span>
                                <span>Trigger: <span className="font-mono text-[11px] text-[#54a8c7]">{exec.triggerReason}</span></span>
                                <span>•</span>
                                <span>{exec.startedAt ? format(new Date(exec.startedAt), "dd MMM yyyy, HH:mm:ss") : "Just now"}</span>
                              </p>
                              {/* Step progress bar */}
                              <div className="flex items-center gap-2 pt-1">
                                <Progress
                                  value={exec.totalSteps > 0 ? (exec.currentStep / exec.totalSteps) * 100 : 0}
                                  className="h-1.5 w-32"
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  Step {exec.currentStep} of {exec.totalSteps}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedExecution(exec);
                                setIsDetailModalOpen(true);
                              }}
                              className="text-xs h-8"
                            >
                              Inspect Timeline
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: AI DIAGNOSTIC LAB */}
          <TabsContent value="ai-lab" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Input Console */}
              <div className="lg:col-span-6 space-y-4">
                <Card className="card-border-top-primary">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-[#54a8c7]">
                      <Terminal className="size-5" />
                      <CardTitle className="text-base">AI Diagnostic Log Parser</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Paste raw manufacturer log dumps, OCPP StatusNotification JSON, or error strings to parse root cause and match remediation playbooks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Preset samples */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Load Preset Error Scenario:</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {SAMPLE_LOGS.map((s, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAiLogInput(s.text);
                              setAiResult(null);
                            }}
                            className="text-[11px] h-7 rounded-lg"
                          >
                            {s.title}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Target Charger Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Target Fleet Charger (Optional)</Label>
                      <Select value={aiSelectedCharger} onValueChange={setAiSelectedCharger}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Auto-detect from log or choose charger..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Auto-detect from error log</SelectItem>
                          {chargers.map((c) => (
                            <SelectItem key={c.charger_id} value={String(c.charger_id)} className="text-xs">
                              #{c.charger_id} - {c.name} ({c.manufacturer} {c.model})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Raw Log Input Textarea */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Raw Diagnostic Payload / Error String</Label>
                      <Textarea
                        rows={6}
                        placeholder="Paste raw error message (e.g. Alfen Err_023 socket lock timeout, ABB F_012 pilot drift, EVBox RCD trip)..."
                        value={aiLogInput}
                        onChange={(e) => setAiLogInput(e.target.value)}
                        className="font-mono text-xs bg-background/50 leading-relaxed"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/40 pt-4 flex items-center justify-between">
                    <Button
                      onClick={handleRunAiAnalysis}
                      disabled={aiAnalyzing}
                      className="w-full bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white hover:opacity-90 transition-opacity gap-2 text-xs font-bold shadow-md shadow-[#54a8c7]/20"
                    >
                      {aiAnalyzing ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          Running AI Diagnostics...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          Analyze Diagnostic Log
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Analysis Result Card */}
              <div className="lg:col-span-6 space-y-4">
                {aiResult ? (
                  <Card className="border-[#54a8c7]/40 shadow-lg shadow-[#54a8c7]/5">
                    <CardHeader className="pb-3 border-b border-border/40 bg-[#54a8c7]/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-5 text-emerald-500" />
                          <CardTitle className="text-base text-foreground">Diagnostic Analysis Result</CardTitle>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs font-mono">
                          {(aiResult.confidence * 100).toFixed(0)}% Confidence Match
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* Detected Vendor & Category */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/30">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detected Vendor</span>
                          <div className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-xs ${getVendorBadgeColor(aiResult.vendor)}`}>
                              {aiResult.vendor}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/30">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fault Domain</span>
                          <div className="text-sm font-bold text-foreground mt-0.5">
                            {aiResult.category}
                          </div>
                        </div>
                      </div>

                      {/* Root cause breakdown */}
                      <div className="p-3.5 rounded-xl bg-[#1e2228]/60 border border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#54a8c7] flex items-center gap-1">
                          <ShieldAlert className="size-3.5" /> Root Cause Diagnosis:
                        </span>
                        <p className="text-xs text-foreground font-medium leading-relaxed">
                          {aiResult.rootCause}
                        </p>
                      </div>

                      {/* Recommended Playbook */}
                      {aiResult.matchedPlaybook ? (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Matched Auto-Healing Recipe:
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono bg-background/80">
                              Recipe ID #{aiResult.matchedPlaybook.id}
                            </Badge>
                          </div>
                          <div className="text-sm font-bold text-foreground">
                            {aiResult.matchedPlaybook.name}
                          </div>
                          <div className="space-y-1.5">
                            {aiResult.recommendedSteps.map((step, idx) => (
                              <div key={idx} className="text-xs flex items-center gap-2 text-muted-foreground">
                                <ArrowRight className="size-3 text-emerald-500 shrink-0" />
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
                          No exact vendor recipe exceeded threshold; fallback standard recovery recommended.
                        </div>
                      )}
                    </CardContent>
                    {aiResult.matchedPlaybook ? (
                      <CardFooter className="border-t border-border/40 pt-4">
                        <Button
                          onClick={() => handleOpenExecuteModal(aiResult.matchedPlaybook!)}
                          className="w-full bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white gap-2 text-xs font-semibold"
                        >
                          <Play className="size-3.5 fill-current" />
                          Execute This Playbook Now
                        </Button>
                      </CardFooter>
                    ) : null}
                  </Card>
                ) : (
                  <Card className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-dashed">
                    <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
                      <Cpu className="size-6 text-[#54a8c7]" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Awaiting Diagnostic Input</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">
                      Choose an error scenario or paste log data on the left to run AI pattern matching and see tailored recovery playbooks.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL 1: CREATE / EDIT PLAYBOOK */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="size-5 text-[#54a8c7]" />
                {editingPlaybook?.id ? "Edit Auto-Healing Playbook" : "Create New Auto-Healing Playbook"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure pattern matching triggers, vendor filters, and ordered execution steps.
              </DialogDescription>
            </DialogHeader>

            {editingPlaybook ? (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Playbook Name *</Label>
                    <Input
                      placeholder="e.g. Alfen Socket Lock Recovery"
                      value={editingPlaybook.name || ""}
                      onChange={(e) => setEditingPlaybook({ ...editingPlaybook, name: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Manufacturer Vendor *</Label>
                    <Select
                      value={editingPlaybook.vendor || "Generic"}
                      onValueChange={(val) => setEditingPlaybook({ ...editingPlaybook, vendor: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_LIST.filter((v) => v !== "All").map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Severity</Label>
                    <Select
                      value={editingPlaybook.severity || "HIGH"}
                      onValueChange={(val: any) => setEditingPlaybook({ ...editingPlaybook, severity: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW" className="text-xs">LOW</SelectItem>
                        <SelectItem value="MEDIUM" className="text-xs">MEDIUM</SelectItem>
                        <SelectItem value="HIGH" className="text-xs">HIGH</SelectItem>
                        <SelectItem value="CRITICAL" className="text-xs">CRITICAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Category</Label>
                    <Select
                      value={editingPlaybook.category || "Hardware"}
                      onValueChange={(val) => setEditingPlaybook({ ...editingPlaybook, category: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_LIST.filter((c) => c !== "All").map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Cooldown (Minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingPlaybook.cooldownMinutes ?? 15}
                      onChange={(e) =>
                        setEditingPlaybook({
                          ...editingPlaybook,
                          cooldownMinutes: parseInt(e.target.value, 10) || 15,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Error Code / Regex Trigger Pattern *</Label>
                  <Input
                    placeholder="e.g. Err_023|LockTimeout|ConnectorLockFailure"
                    value={editingPlaybook.errorCodePattern || ""}
                    onChange={(e) => setEditingPlaybook({ ...editingPlaybook, errorCodePattern: e.target.value })}
                    className="font-mono text-xs h-8 text-[#54a8c7]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Matches incoming StatusNotification error codes, vendor codes, or diagnostics text.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Description</Label>
                  <Textarea
                    rows={2}
                    placeholder="Explain what physical condition this playbook remediates..."
                    value={editingPlaybook.description || ""}
                    onChange={(e) => setEditingPlaybook({ ...editingPlaybook, description: e.target.value })}
                    className="text-xs"
                  />
                </div>

                {/* Step Builder */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-[#54a8c7]" />
                      Execution Steps ({editingPlaybook.steps?.length || 0})
                    </Label>
                    <Button size="sm" variant="outline" onClick={handleAddStep} className="h-7 text-xs gap-1">
                      <Plus className="size-3" /> Add Step
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {(editingPlaybook.steps || []).map((step, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="size-5 rounded-full bg-[#54a8c7] text-white flex items-center justify-center font-bold text-[10px]">
                              {step.stepNumber}
                            </span>
                            <Select
                              value={step.action}
                              onValueChange={(val) => handleStepChange(idx, "action", val)}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STEP_ACTIONS.map((act) => (
                                  <SelectItem key={act.value} value={act.value} className="text-xs">
                                    {act.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="Delay (ms)"
                              value={step.delayMs ?? 1000}
                              onChange={(e) => handleStepChange(idx, "delayMs", parseInt(e.target.value, 10) || 0)}
                              className="w-24 h-7 text-xs font-mono"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive"
                              onClick={() => handleRemoveStep(idx)}
                              disabled={(editingPlaybook.steps || []).length <= 1}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <Input
                          placeholder="Step description or rationale..."
                          value={step.description || ""}
                          onChange={(e) => handleStepChange(idx, "description", e.target.value)}
                          className="h-7 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <DialogFooter className="pt-3 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={() => setIsEditorOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSavePlaybook} className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white text-xs">
                Save Playbook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 2: EXECUTE PLAYBOOK ON CHARGER */}
        <Dialog open={isExecuteModalOpen} onOpenChange={setIsExecuteModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Play className="size-5 text-[#54a8c7] fill-current" />
                Run Playbook on Charger
              </DialogTitle>
              <DialogDescription className="text-xs">
                Manually trigger this multi-step remediation sequence on a selected charge point.
              </DialogDescription>
            </DialogHeader>

            {selectedPlaybookToRun ? (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-xl bg-[#54a8c7]/10 border border-[#54a8c7]/30 space-y-1">
                  <div className="font-bold text-sm text-foreground">{selectedPlaybookToRun.name}</div>
                  <p className="text-xs text-muted-foreground">{selectedPlaybookToRun.description}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Select Target Charge Point</Label>
                  <Select value={targetChargerId} onValueChange={setTargetChargerId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Choose charger..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chargers.map((c) => (
                        <SelectItem key={c.charger_id} value={String(c.charger_id)} className="text-xs">
                          #{c.charger_id} - {c.name} ({c.manufacturer} {c.model}) [{c.status}]
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Connector / Channel</Label>
                  <Select value={targetConnectorId} onValueChange={setTargetConnectorId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">Connector 1 (Channel 1 / Left)</SelectItem>
                      <SelectItem value="2" className="text-xs">Connector 2 (Channel 2 / Right)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <DialogFooter className="pt-3 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={() => setIsExecuteModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRunExecution}
                disabled={isExecuting}
                className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white text-xs gap-1.5"
              >
                {isExecuting ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                Dispatch Sequence
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 3: EXECUTION TIMELINE DETAILS */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="size-5 text-[#54a8c7]" />
                Execution Step Timeline & Trace
              </DialogTitle>
              <DialogDescription className="text-xs">
                Step-by-step command sequence, execution latency, and OCPP responses.
              </DialogDescription>
            </DialogHeader>

            {selectedExecution ? (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Status</span>
                    <div className="font-bold text-foreground mt-0.5">{selectedExecution.status}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Charger</span>
                    <div className="font-mono font-bold text-foreground mt-0.5">#{selectedExecution.chargerId}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Progress</span>
                    <div className="font-bold text-foreground mt-0.5">{selectedExecution.currentStep} / {selectedExecution.totalSteps} Steps</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Started</span>
                    <div className="font-mono text-[11px] text-foreground mt-0.5">
                      {selectedExecution.startedAt ? format(new Date(selectedExecution.startedAt), "HH:mm:ss") : "-"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step Action Logs:</Label>
                  <div className="space-y-2">
                    {Array.isArray(selectedExecution.stepLogs) && selectedExecution.stepLogs.length > 0 ? (
                      selectedExecution.stepLogs.map((log, lIdx) => (
                        <div
                          key={lIdx}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-destructive/5 border-destructive/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="size-5 rounded-full bg-[#54a8c7]/20 text-[#54a8c7] flex items-center justify-center font-bold text-[10px]">
                                {log.stepNumber}
                              </span>
                              <strong className="text-foreground">{log.action}</strong>
                              <Badge
                                variant={log.status === "SUCCESS" ? "soft-success" : "destructive"}
                                className="text-[9px] font-bold"
                              >
                                {log.status}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {log.durationMs ? `${log.durationMs}ms` : ""}
                            </span>
                          </div>
                          {log.details ? (
                            <p className="text-[11px] text-muted-foreground font-mono pl-7">{log.details}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No detailed step logs recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setIsDetailModalOpen(false)} className="text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 4: IMPORT PLAYBOOKS JSON */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="size-5 text-[#54a8c7]" />
                Import Playbooks JSON
              </DialogTitle>
              <DialogDescription className="text-xs">
                Paste JSON array containing playbook definitions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Textarea
                rows={8}
                placeholder="Paste [ { name: '...', vendor: '...', ... } ] JSON here..."
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="font-mono text-xs bg-background/50"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleImportPlaybooks} className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white text-xs">
                Import Playbooks
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
