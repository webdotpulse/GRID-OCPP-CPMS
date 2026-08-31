"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  Download,
  Upload,
  Save,
  Edit,
  Zap,
  Sparkles,
  ShieldCheck,
  BatteryCharging,
  Gauge,
  Wifi,
  Globe,
  Sliders,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface ProfileItem {
  key: string;
  value: string;
}

interface ConfigProfile {
  id: number;
  name: string;
  description: string | null;
  items: ProfileItem[];
  createdAt: string;
}

interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  category: "Smart Charging" | "High-Power DC" | "Security & PKI" | "Fleet & Depot" | "Cellular / 4G" | "Roaming & Public";
  icon: any;
  color: string;
  items: ProfileItem[];
}

const OCPP_PRESETS: PresetDefinition[] = [
  {
    id: "smart-charging",
    name: "Dynamic Smart Charging & Solar Curtailment",
    description: "High-granularity 15s power/current telemetry, dynamic profile stacking, and solar optimal load balancing.",
    category: "Smart Charging",
    icon: Zap,
    color: "text-[#45c4a0] bg-[#45c4a0]/15 border-emerald-500/30",
    items: [
      { key: "MeterValueSampleInterval", value: "15" },
      { key: "MeterValuesSampledData", value: "Power.Active.Import,Energy.Active.Import.Register,Current.Import,Voltage,SoC,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "ChargeProfileMaxStackLevel", value: "5" },
      { key: "MaxChargingProfilesInstalled", value: "10" },
      { key: "ChargingScheduleMaxPeriods", value: "24" },
      { key: "ChargingScheduleAllowedChargingRateUnit", value: "Current,Power" },
      { key: "ConnectorPhaseRotation", value: "1.RST,2.RST" },
    ],
  },
  {
    id: "dc-fast-charging",
    name: "High-Power DC Fast Charger (Alfen / ABB / Kempower)",
    description: "Optimized for ultra-fast DC hardware with battery temperature metrics, strict SoC sampling, and rapid cable lockouts.",
    category: "High-Power DC",
    icon: Gauge,
    color: "text-[#3f78e0] bg-[#3f78e0]/15 border-blue-500/30",
    items: [
      { key: "MeterValueSampleInterval", value: "10" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage,Temperature,Power.Offered" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "StopTransactionOnEVSideDisconnect", value: "false" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "false" },
      { key: "ConnectionTimeOut", value: "60" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "ClockAlignedDataInterval", value: "300" },
    ],
  },
  {
    id: "pki-security-sp3",
    name: "Strict ISO 15118 Plug & Charge & Security Profile 3",
    description: "Enforces mutual TLS client certificate verification, disables unauthenticated offline charging, and sizes certificate stores.",
    category: "Security & PKI",
    icon: ShieldCheck,
    color: "text-[#8b5cf6] bg-[#8b5cf6]/15 border-purple-500/30",
    items: [
      { key: "SecurityProfile", value: "3" },
      { key: "AuthorizationRequired", value: "true" },
      { key: "LocalAuthorizeOffline", value: "false" },
      { key: "LocalPreAuthorize", value: "false" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "CertificateStoreMaxLength", value: "10" },
      { key: "CpoName", value: "GRID-OCPP-CPMS" },
      { key: "AuthorizeRemoteTxRequests", value: "true" },
    ],
  },
  {
    id: "fleet-depot",
    name: "Fleet Depot & Overnight Scheduled Charging",
    description: "Designed for commercial truck & van depots with robust offline retry mechanics and off-peak power limit coordination.",
    category: "Fleet & Depot",
    icon: BatteryCharging,
    color: "text-[#fab758] bg-[#fab758]/15 border-amber-500/30",
    items: [
      { key: "HeartbeatInterval", value: "300" },
      { key: "MeterValueSampleInterval", value: "60" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,SoC" },
      { key: "StopTransactionOnInvalidId", value: "true" },
      { key: "TransactionMessageAttempts", value: "3" },
      { key: "TransactionMessageRetryInterval", value: "15" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
    ],
  },
  {
    id: "low-bandwidth-4g",
    name: "Low-Bandwidth Cellular / 4G Cost-Optimized",
    description: "Minimizes mobile data SIM consumption with 5-minute sampling windows and hourly clock-aligned aggregation.",
    category: "Cellular / 4G",
    icon: Wifi,
    color: "text-[#54a8c7] bg-[#54a8c7]/15 border-cyan-500/30",
    items: [
      { key: "HeartbeatInterval", value: "900" },
      { key: "MeterValueSampleInterval", value: "300" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "ClockAlignedDataInterval", value: "3600" },
      { key: "TransactionMessageAttempts", value: "2" },
      { key: "TransactionMessageRetryInterval", value: "30" },
    ],
  },
  {
    id: "roaming-public",
    name: "Public Destination & Roaming (OCPI / Free-Vend Fallback)",
    description: "Standard public commercial charging profile supporting roaming partners, remote start triggers, and automatic plug unlocking.",
    category: "Roaming & Public",
    icon: Globe,
    color: "text-[#e2626b] bg-[#e2626b]/15 border-rose-500/30",
    items: [
      { key: "AuthorizeRemoteTxRequests", value: "true" },
      { key: "LocalAuthorizeOffline", value: "true" },
      { key: "LocalPreAuthorize", value: "true" },
      { key: "AllowOfflineTxForUnknownId", value: "false" },
      { key: "MeterValueSampleInterval", value: "30" },
      { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import" },
      { key: "StopTxnSampledData", value: "Energy.Active.Import.Register" },
      { key: "StopTransactionOnEVSideDisconnect", value: "true" },
      { key: "UnlockConnectorOnEVSideDisconnect", value: "true" },
      { key: "ConnectionTimeOut", value: "180" },
    ],
  },
];

export default function ConfigProfilesPage() {
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConfigProfile | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [{ key: "", value: "" }],
  });

  const fetchProfiles = async () => {
    try {
      const response = await api.get("/config-profiles");
      setProfiles(response.data || []);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleOpenDialog = (profile?: ConfigProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || "",
        items: profile.items.length > 0 ? profile.items.map(i => ({ key: i.key, value: i.value })) : [{ key: "", value: "" }],
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: "",
        description: "",
        items: [{ key: "", value: "" }],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        items: formData.items.filter(i => i.key.trim() !== ""),
      };

      if (editingProfile) {
        await api.put(`/config-profiles/${editingProfile.id}`, payload);
        toast.success("Profile updated");
      } else {
        await api.post("/config-profiles", payload);
        toast.success("Profile created");
      }

      setIsDialogOpen(false);
      fetchProfiles();
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await api.delete(`/config-profiles/${id}`);
      toast.success("Profile deleted");
      fetchProfiles();
    } catch {
      toast.error("Failed to delete profile");
    }
  };

  const applyPresetToForm = (preset: PresetDefinition) => {
    setFormData({
      name: preset.name,
      description: preset.description,
      items: preset.items.map(item => ({ ...item })),
    });
    toast.success(`Loaded "${preset.name}" preset keys`);
  };

  const installPresetDirectly = async (preset: PresetDefinition) => {
    try {
      await api.post("/config-profiles", {
        name: preset.name,
        description: preset.description,
        items: preset.items,
      });
      toast.success(`Installed preset "${preset.name}" to your profiles`);
      fetchProfiles();
    } catch {
      toast.error("Failed to install preset");
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { key: "", value: "" }] });
  };

  const updateItem = (index: number, field: "key" | "value", val: string) => {
    const newItems = [...formData.items];
    newItems[index][field] = val;
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleExport = (profile: ConfigProfile) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${profile.name.replace(/\s+/g, '_')}_profile.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.name && json.items) {
          await api.post("/config-profiles", {
            name: `${json.name} (Imported)`,
            description: json.description,
            items: json.items,
          });
          toast.success("Profile imported successfully");
          fetchProfiles();
        } else {
          toast.error("Invalid profile format");
        }
      } catch {
        toast.error("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">OCPP Configuration Profiles</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              OCPP Configuration Profiles
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Standardized parameter presets to provision charging station telemetry, smart load balancing, security profiles, and timeout policies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="import-profile" className="cursor-pointer">
              <div className="flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import JSON
              </div>
            </Label>
            <input
              id="import-profile"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            <Button
              size="sm"
              onClick={() => handleOpenDialog()}
              className="bg-[#3f78e0] hover:bg-[#3364be] text-white shadow-md shadow-blue-500/20 text-xs h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Profile
            </Button>
          </div>
        </div>

        {/* Industry Presets Library Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#fab758]" />
              <h2 className="text-base font-bold text-foreground font-heading">
                Ready-to-Use Standard OCPP Presets Library
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {OCPP_PRESETS.length} expert presets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {OCPP_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <div
                  key={preset.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-[#54a8c7]/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Badge className={`${preset.color} border text-[10px] font-semibold px-2 py-0.5`}>
                        {preset.category}
                      </Badge>
                      <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center text-foreground">
                        <Icon className="size-4" />
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-foreground font-heading leading-snug">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {preset.items.length} keys
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleOpenDialog();
                          applyPresetToForm(preset);
                        }}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      >
                        Customize
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => installPresetDirectly(preset)}
                        className="text-xs h-7 bg-muted text-foreground hover:bg-primary hover:text-primary-foreground font-medium"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Install
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User Saved Profiles List */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground font-heading">
              Active Configuration Profiles ({profiles.length})
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Loading configuration profiles...
            </div>
          ) : profiles.length === 0 ? (
            <Card className="border-dashed border-border bg-card/50">
              <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                <Sliders className="size-8 mx-auto opacity-40 text-[#54a8c7]" />
                <div className="text-sm font-semibold text-foreground">No Custom Profiles Created Yet</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Create a profile from scratch or click &quot;Install&quot; on any of the standard presets above to provision your charging fleet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((profile) => (
                <Card key={profile.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold text-foreground font-heading">
                          {profile.name}
                        </CardTitle>
                        {profile.description && (
                          <CardDescription className="text-xs mt-1 text-muted-foreground">
                            {profile.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
                      {profile.items.length} configuration key{profile.items.length === 1 ? '' : 's'} defined
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => handleOpenDialog(profile)} className="text-xs h-8 border-border">
                        <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExport(profile)} className="text-xs h-8 border-border">
                        <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(profile.id)} className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                        <Trash className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create / Edit Profile Modal */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90vh] overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground font-heading">
                <Sliders className="w-5 h-5 text-[#54a8c7]" />
                {editingProfile ? "Edit Configuration Profile" : "Create Configuration Profile"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Configure standardized OCPP key-value pairs that can be batch-dispatched to chargers.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm">
              {/* Quick Preset Loader Selector */}
              {!editingProfile && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground block">Load from Standard Presets:</span>
                    Pre-fill recommended values for specific charging use cases
                  </div>
                  <Select onValueChange={(presetId) => {
                    const found = OCPP_PRESETS.find(p => p.id === presetId);
                    if (found) applyPresetToForm(found);
                  }}>
                    <SelectTrigger className="w-[200px] bg-background border-border text-foreground text-xs h-8">
                      <SelectValue placeholder="Select a preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {OCPP_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Profile Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alfen Eve Pro Smart Charging Setup"
                  className="bg-background border-border text-foreground text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes or hardware compatibility notes..."
                  className="bg-background border-border text-foreground text-xs h-9"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Configuration Key-Value Pairs</Label>
                  <Button size="sm" variant="outline" onClick={addItem} className="text-xs h-7 border-border">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Key
                  </Button>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        className="flex-1 bg-background border-border text-foreground text-xs font-mono h-8"
                        placeholder="OCPP Key (e.g. MeterValueSampleInterval)"
                        value={item.key}
                        onChange={(e) => updateItem(idx, "key", e.target.value)}
                      />
                      <Input
                        className="flex-1 bg-background border-border text-foreground text-xs font-mono h-8"
                        placeholder="Value (e.g. 15)"
                        value={item.value}
                        onChange={(e) => updateItem(idx, "value", e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-[#3f78e0] hover:bg-[#3364be] text-white font-bold"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
