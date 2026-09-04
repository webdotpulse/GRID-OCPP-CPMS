"use client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Edit, Zap, Info, Clock, CheckCircle, Layers, Link2, Unlink, Share2, AlertCircle, Globe, Lock, User, Building2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { RemoteControlPanel } from "@/components/chargers/RemoteControlPanel";
import { ConnectorList } from "@/components/chargers/ConnectorList";
import { ChargerConfigurationPanel } from "@/components/chargers/ChargerConfigurationPanel";
import { PredictiveLoadMap } from "@/components/chargers/PredictiveLoadMap";
import { ManualSpeedOverridePanel } from "@/components/chargers/ManualSpeedOverridePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadManagementOverview } from "@/components/dashboard/LoadManagementOverview";
import { LocalAuthListPanel } from "@/components/chargers/LocalAuthListPanel";
import { useMemo } from "react";
import { ChargerTransactionsTable } from "@/components/chargers/ChargerTransactionsTable";
import { ChargerSchedulesTab } from "@/components/chargers/ChargerSchedulesTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ChargerDetail {
  protocol?: string;
  charger_id: number;
  name: string;
  model: string;
  manufacturer: string;
  serial_number: string;
  status: string;
  isPublic?: boolean;
  firmware_version: string;
  power_capacity: number;
  service_contacts?: string;
  owner_id?: number;
  ownerType?: string;
  ownerCompanyId?: number | null;
  owner?: { id: number; email: string; name?: string | null };
  ownerCompany?: { id: number; name: string; clientNumber?: string | null; city?: string | null } | null;
  subscriptionPayerType?: string | null;
  subscriptionPayerUser?: { id: number; email: string; name?: string | null } | null;
  subscriptionPayerCompany?: { id: number; name: string; clientNumber?: string | null } | null;
  transactionReceiverType?: string | null;
  transactionReceiverUser?: { id: number; email: string; name?: string | null } | null;
  transactionReceiverCompany?: { id: number; name: string; clientNumber?: string | null } | null;
  last_heartbeat: string;
  charging_station_id?: number;
  chargeGroupId?: number;
  chargingStation?: {
    station_name: string;
    city: string;
    state: string;
  };
  connectors: any[];
  thirdPartyBackendUrl?: string | null;
  isStraightThroughProxy?: boolean;
  isCombined?: boolean;
  pairedChargerId?: number | null;
  pairedRole?: string | null;
  productId?: number | null;
  product?: {
    id: number;
    name: string;
    description: string | null;
    category: string;
    price: number;
    paymentFrequency: string;
    vatRate: number;
    isActive: boolean;
  } | null;
  tariffs?: Array<{
    tariff_id: number;
    tariff_name: string;
    charge: number;
    electricity_rate: number;
    tariffType: string;
    markupPerKwh?: number | null;
    taxPercentage?: number | null;
    time_fee?: number | null;
    idle_fee?: number | null;
    dynamicProvider?: string | null;
  }>;
  pairedCharger?: {
    charger_id: number;
    name: string;
    manufacturer: string;
    model: string;
    status: string;
  } | null;
}

export default function ChargerDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [charger, setCharger] = useState<ChargerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [applyingProfile, setApplyingProfile] = useState(false);

  // Combine dialog state
  const [combineDialogOpen, setCombineDialogOpen] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [isCombining, setIsCombining] = useState(false);
  const [isUncombining, setIsUncombining] = useState(false);

  const fetchCharger = async () => {
    try {
      const response = await api.get(`/chargers/${id}`);
      setCharger(response.data);
    } catch (error) {
      logger.error("Failed to fetch charger details", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get('/config-profiles');
        setProfiles(response.data || []);
      } catch {
        toast.error("Failed to load configuration profiles");
      }
    };

    if (id) {
      fetchCharger();
      fetchProfiles();
    }
  }, [id]);

  const [activeTxns, setActiveTxns] = useState<any[]>([]);

  useEffect(() => {
    const fetchActiveTxns = async () => {
      if (!id) return;
      try {
        const response = await api.get('/dashboard/live-sessions');
        const targetIds = [Number(id)];
        if (charger?.isCombined && charger?.pairedChargerId) {
          targetIds.push(charger.pairedChargerId);
        }
        const sessions = (response.data || []).filter((s: any) =>
          targetIds.includes(s.chargerId) || (s.primaryChargerId && targetIds.includes(s.primaryChargerId))
        );
        setActiveTxns(sessions);
      } catch (err) {
        toast.error("Failed to fetch active transactions");
      }
    };
    fetchActiveTxns();
    const interval = setInterval(fetchActiveTxns, 30000);
    return () => clearInterval(interval);
  }, [id, charger?.isCombined, charger?.pairedChargerId]);

  const allConnectors = useMemo(() => {
    if (!charger) return [];
    return (charger as any).evses?.flatMap((e: any) => e.connectors?.map((c: any) => ({ ...c, charger_id: charger.charger_id }))) || [];
  }, [charger]);

  const handleApplyProfile = async () => {
    if (!selectedProfile) return;
    setApplyingProfile(true);
    try {
      const res = await api.post(`/config-profiles/${selectedProfile}/apply/${id}`);
      toast.success(res.data.message || "Profile applied successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to apply profile");
    } finally {
      setApplyingProfile(false);
    }
  };

  const handleOpenCombineDialog = async () => {
    try {
      const res = await api.get(`/chargers/${id}/combine-candidates`);
      setCandidates(res.data?.data || res.data || []);
      setCombineDialogOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to fetch eligible chargers for combining");
    }
  };

  const handleCombineChargers = async () => {
    if (!selectedCandidateId || !charger) return;
    setIsCombining(true);
    try {
      await api.post('/chargers/combine', {
        primaryChargerId: charger.charger_id,
        secondaryChargerId: Number(selectedCandidateId),
      });
      toast.success("Successfully combined 2 chargers into a 1-charger 2-socket configuration!");
      setCombineDialogOpen(false);
      fetchCharger();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to combine chargers");
    } finally {
      setIsCombining(false);
    }
  };

  const handleUncombineChargers = async () => {
    if (!charger) return;
    if (!confirm("Are you sure you want to uncombine these chargers back into independent units?")) return;
    setIsUncombining(true);
    try {
      await api.post('/chargers/uncombine', {
        chargerId: charger.charger_id,
      });
      toast.success("Chargers uncombined successfully into independent units");
      fetchCharger();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to uncombine chargers");
    } finally {
      setIsUncombining(false);
    }
  };

  if (isLoading) return <AppShell><div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300"><div className="p-8">Loading charger details...</div></div></AppShell>;
  if (!charger) return <AppShell><div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300"><div className="p-8 text-red-500">Charger not found</div></div></AppShell>;

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'online' || s === 'active') {
      return (
        <Badge variant="soft-success" className="gap-1.5 px-3 py-1 text-xs font-bold">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </Badge>
      );
    }
    if (s === 'charging') {
      return (
        <Badge variant="soft-primary" className="gap-1.5 px-3 py-1 text-xs font-bold">
          <span className="size-2 rounded-full bg-[#54a8c7] animate-pulse" />
          CHARGING
        </Badge>
      );
    }
    if (s === 'faulted') {
      return (
        <Badge variant="soft-danger" className="gap-1.5 px-3 py-1 text-xs font-bold">
          <span className="size-2 rounded-full bg-rose-500" />
          FAULTED
        </Badge>
      );
    }
    return (
      <Badge variant="soft-secondary" className="gap-1.5 px-3 py-1 text-xs font-bold">
        <span className="size-2 rounded-full bg-slate-400" />
        OFFLINE
      </Badge>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-4">
          <Link href="/chargers">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Chargers
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{charger.name}</h1>
            {getStatusBadge(charger.status)}

            {/* Public / Private Badge */}
            {charger.isPublic ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Globe className="h-3.5 w-3.5" />
                PUBLIC CHARGER
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Lock className="h-3.5 w-3.5" />
                PRIVATE CHARGER
              </Badge>
            )}

            {/* Combined Setup Badge */}
            {charger.isCombined && charger.pairedRole === "primary" && (
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Layers className="h-3.5 w-3.5" />
                COMBINED 2-SOCKET (PRIMARY)
              </Badge>
            )}
            {charger.isCombined && charger.pairedRole === "secondary" && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Layers className="h-3.5 w-3.5" />
                PAIRED (CHANNEL 2 of #{charger.pairedChargerId})
              </Badge>
            )}

            {/* Straight-Through Proxy Badge */}
            {charger.isStraightThroughProxy && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                <Share2 className="h-3.5 w-3.5" />
                STRAIGHT-THROUGH PROXY
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            Installed at {charger.chargingStation ? (
              <span className="font-medium text-foreground">{charger.chargingStation.station_name}</span>
            ) : (
              <i>Unassigned Station</i>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <>
              {!charger.isCombined ? (
                <Button variant="outline" onClick={handleOpenCombineDialog}>
                  <Link2 className="mr-2 h-4 w-4 text-indigo-400" /> Combine into 2-Socket Charger
                </Button>
              ) : (
                <Button variant="outline" onClick={handleUncombineChargers} disabled={isUncombining} className="text-destructive hover:bg-destructive/10">
                  <Unlink className="mr-2 h-4 w-4" /> {isUncombining ? "Uncombining..." : "Uncombine"}
                </Button>
              )}
            </>
          )}

          <Link href={`/chargers/${id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" /> Edit Hardware Details
            </Button>
          </Link>
        </div>
      </div>

      {/* Combine Chargers Modal Dialog */}
      <Dialog open={combineDialogOpen} onOpenChange={setCombineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              Combine 2 Single Chargers
            </DialogTitle>
            <DialogDescription>
              Combine 2 single chargers of the same brand ({charger.manufacturer || "N/A"}) and model ({charger.model || "N/A"}) into a single 2-socket unit. This charger ({charger.name}) will become <strong>Channel 1</strong>, and the selected charger will become <strong>Channel 2</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {candidates.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No matching eligible chargers found</p>
                  <p className="text-xs text-amber-200/80 mt-1">
                    To combine, there must be another unpaired charger at the same station with the exact same manufacturer (<strong>{charger.manufacturer}</strong>) and model (<strong>{charger.model}</strong>).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Secondary Charger (Channel 2)</label>
                <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a matching charger" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map(c => (
                      <SelectItem key={c.charger_id} value={c.charger_id.toString()}>
                        {c.name} ({c.manufacturer} {c.model} - #{c.charger_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Upstream proxy and load management will automatically treat both units as one dual-socket station.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCombineDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCombineChargers}
              disabled={!selectedCandidateId || isCombining || candidates.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isCombining ? "Combining..." : "Combine Chargers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="schedules">Scheduled Charging</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="configuration">Configuration Parameters</TabsTrigger>
          <TabsTrigger value="profiles">Configuration Profiles</TabsTrigger>
          <TabsTrigger value="local-auth">Local Authorization List</TabsTrigger>
          <TabsTrigger value="predictive">Predictive Load</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Secondary Section: Hardware and Communications (Single Line) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Hardware Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Manufacturer / Model</p>
                    <p className="font-medium">{charger.manufacturer} {charger.model}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Serial Number</p>
                    <p className="font-medium font-mono text-sm">{charger.serial_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Firmware Version</p>
                    <p className="font-medium">{charger.firmware_version}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Protocol Version</p>
                    <p className="font-medium">{charger.status !== 'offline' ? (charger.protocol === 'ocpp2.1' ? 'OCPP 2.1' : charger.protocol === 'ocpp2.0.1' ? 'OCPP 2.0.1' : 'OCPP 1.6') : 'Unknown'}</p>
                  </div>
                  <div className="space-y-1 flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Power Capacity</p>
                      <p className="font-medium">{charger.power_capacity} kW</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Access Mode</p>
                    <p className="font-medium flex items-center gap-1.5">
                      {charger.isPublic ? (
                        <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                          <Globe className="size-4 text-emerald-400" /> Public (Open to all cards)
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold inline-flex items-center gap-1">
                          <Lock className="size-4 text-amber-400" /> Private (Owner & Group only)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2 border-t border-border/50 pt-3">
                    <p className="text-sm text-muted-foreground">Platform Subscription Product</p>
                    {charger.product ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#fab758]/15 text-[#fab758] border-[#fab758]/30 font-semibold text-xs">
                          {charger.product.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          €{charger.product.price.toFixed(2)} excl. VAT / {charger.product.paymentFrequency}
                        </span>
                        {charger.product.description && (
                          <span className="text-xs text-muted-foreground italic">
                            ({charger.product.description})
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">None (Ad-Hoc Hardware)</p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-2 border-t border-border/50 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Assigned Tariff Plan</p>
                      {charger.tariffs && charger.tariffs.length > 0 && (
                        <Link href="/tariffs" className="text-xs text-[#54a8c7] hover:underline flex items-center gap-1">
                          Manage Tariffs
                        </Link>
                      )}
                    </div>
                    {charger.tariffs && charger.tariffs.length > 0 ? (
                      <div className="space-y-2">
                        {charger.tariffs.map((t) => (
                          <div key={t.tariff_id} className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 font-semibold text-xs">
                              {t.tariff_name}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase font-mono">
                              {t.tariffType === "DYNAMIC_EPEX" ? "Dynamic EPEX" : "Fixed Rate"}
                            </Badge>
                            <span className="text-xs text-foreground/90 font-mono">
                              {t.tariffType === "DYNAMIC_EPEX" ? (
                                <>
                                  Spot Price + €{(t.markupPerKwh ?? 0).toFixed(3)}/kWh
                                  {t.taxPercentage ? ` (+${t.taxPercentage}% tax)` : ""}
                                </>
                              ) : (
                                <>
                                  €{(t.charge ?? 0).toFixed(2)} start + €{(t.electricity_rate ?? 0).toFixed(3)}/kWh
                                  {t.time_fee && t.time_fee > 0 ? ` + €${t.time_fee.toFixed(2)}/min` : ""}
                                  {t.idle_fee && t.idle_fee > 0 ? ` + €${t.idle_fee.toFixed(2)}/min idle` : ""}
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground italic">None (Unassigned Tariff)</p>
                        <Link href={`/chargers/${id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-[#54a8c7] hover:text-[#54a8c7]/80 p-0">
                            Assign Tariff
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {charger.service_contacts && (
                    <div className="space-y-1.5 col-span-2 border-t border-border/50 pt-3">
                      <p className="text-sm text-muted-foreground font-medium">Information</p>
                      <div className="p-3 rounded-lg border border-border/50 bg-muted/20 text-xs font-sans text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {charger.service_contacts}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Communications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium text-sm">WebSocket Status</p>
                    <p className="text-xs text-muted-foreground">
                      {charger.status !== 'offline' ? `Connected (${charger.protocol === 'ocpp2.1' ? 'OCPP 2.1' : charger.protocol === 'ocpp2.0.1' ? 'OCPP 2.0.1' : 'OCPP 1.6J'})` : 'Disconnected'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium text-sm">Last Heartbeat</p>
                    <p className="text-xs text-muted-foreground">
                      {charger.last_heartbeat
                        ? `${formatDistanceToNow(new Date(charger.last_heartbeat))} ago (${format(new Date(charger.last_heartbeat), 'HH:mm:ss')})`
                        : 'System has no recorded heartbeat'
                      }
                    </p>
                  </div>
                </div>
                {charger.thirdPartyBackendUrl && (
                  <div className="flex gap-3">
                    <Info className="h-4 w-4 text-blue-500 mt-1" />
                    <div className="overflow-hidden">
                      <p className="font-medium text-sm">Third-Party Backend URL</p>
                      <p className="text-xs text-muted-foreground truncate" title={charger.thirdPartyBackendUrl}>
                        {charger.thirdPartyBackendUrl}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connected Entities Card */}
            <Card className="col-span-1 md:col-span-3">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="size-4 text-[#54a8c7]" /> Connected Entities
                </CardTitle>
                <CardDescription>
                  Ownership, subscription billing, and transaction revenue receivers connected to this charger.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. The Owner */}
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Owner</p>
                      {charger.ownerType === 'company' && charger.ownerCompany ? (
                        <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                          <Building2 className="size-3 mr-1" /> Company
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                          <User className="size-3 mr-1" /> User
                        </Badge>
                      )}
                    </div>
                    {charger.ownerType === 'company' && charger.ownerCompany ? (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.ownerCompany.name}</p>
                        {charger.ownerCompany.clientNumber && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">Account ID: {charger.ownerCompany.clientNumber}</p>
                        )}
                        {charger.ownerCompany.city && (
                          <p className="text-xs text-muted-foreground mt-0.5">{charger.ownerCompany.city}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.owner?.name || charger.owner?.email || 'Individual Owner'}</p>
                        {charger.owner?.email && (
                          <p className="text-xs text-muted-foreground mt-0.5">{charger.owner.email}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. The Payer of the Subscription */}
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Payer of Subscription</p>
                      {charger.subscriptionPayerCompany ? (
                        <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                          <Building2 className="size-3 mr-1" /> Company
                        </Badge>
                      ) : charger.subscriptionPayerUser ? (
                        <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                          <User className="size-3 mr-1" /> User
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border/60 text-[10px]">
                          Inherit Owner
                        </Badge>
                      )}
                    </div>
                    {charger.subscriptionPayerCompany ? (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.subscriptionPayerCompany.name}</p>
                        {charger.subscriptionPayerCompany.clientNumber && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">Account: {charger.subscriptionPayerCompany.clientNumber}</p>
                        )}
                      </div>
                    ) : charger.subscriptionPayerUser ? (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.subscriptionPayerUser.name || charger.subscriptionPayerUser.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{charger.subscriptionPayerUser.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Billed to the charger owner by default.</p>
                    )}
                  </div>

                  {/* 3. The Receiver of the Transactions */}
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">The Receiver of Transactions</p>
                      {charger.transactionReceiverCompany ? (
                        <Badge variant="outline" className="bg-[#54a8c7]/15 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] font-bold">
                          <Building2 className="size-3 mr-1" /> Company
                        </Badge>
                      ) : charger.transactionReceiverUser ? (
                        <Badge variant="outline" className="bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30 text-[10px] font-bold">
                          <User className="size-3 mr-1" /> User
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border/60 text-[10px]">
                          Inherit Owner
                        </Badge>
                      )}
                    </div>
                    {charger.transactionReceiverCompany ? (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.transactionReceiverCompany.name}</p>
                        {charger.transactionReceiverCompany.clientNumber && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">Account: {charger.transactionReceiverCompany.clientNumber}</p>
                        )}
                      </div>
                    ) : charger.transactionReceiverUser ? (
                      <div>
                        <p className="font-bold text-foreground text-sm">{charger.transactionReceiverUser.name || charger.transactionReceiverUser.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{charger.transactionReceiverUser.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Revenue distributed to charger owner by default.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Pair Configuration Card */}
          {charger.isCombined && (
            <div className="mb-6">
              <Card className="border-indigo-500/30 bg-gradient-to-r from-indigo-950/20 via-background to-purple-950/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-400" />
                      <CardTitle className="text-base font-semibold">Combined 2-Socket Charger Setup</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs text-indigo-300 border-indigo-500/40">
                      {charger.pairedRole === "primary" ? "Primary Unit (Channel 1 + Channel 2)" : "Secondary Unit (Channel 2)"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Two physical chargers of identical brand & model configured as a unified dual-socket station.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Socket 1 / Channel 1</span>
                        <Badge variant="soft-primary" className="text-[10px]">Physical Master</Badge>
                      </div>
                      <p className="font-semibold text-sm">{charger.pairedRole === "primary" ? charger.name : (charger.pairedCharger?.name || `Primary Charger #${charger.pairedChargerId}`)}</p>
                      <p className="text-xs text-muted-foreground">
                        {charger.manufacturer} {charger.model} ({charger.power_capacity} kW)
                      </p>
                    </div>

                    <div className="p-3 rounded-lg border bg-card/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Socket 2 / Channel 2</span>
                        <Badge variant="soft-secondary" className="text-[10px]">Paired Secondary</Badge>
                      </div>
                      <p className="font-semibold text-sm">
                        {charger.pairedRole === "primary" ? (
                          charger.pairedCharger ? (
                            <Link href={`/chargers/${charger.pairedCharger.charger_id}`} className="hover:underline text-indigo-400">
                              {charger.pairedCharger.name} (#{charger.pairedCharger.charger_id})
                            </Link>
                          ) : `Secondary Charger #${charger.pairedChargerId}`
                        ) : charger.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {charger.manufacturer} {charger.model} ({charger.power_capacity} kW)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mb-6">
            <LoadManagementOverview chargerId={charger.charger_id} />
          </div>

          {/* Top Priority Section: Remote Controls */}
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <div className="mb-6">
              {charger.status !== 'offline' ? (
                <RemoteControlPanel chargerId={charger.charger_id} />
              ) : (
                <Card className="bg-muted/50 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-6 space-y-4">
                    <Info className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium text-lg">Charger is Offline</h3>
                      <p className="text-muted-foreground max-w-sm mt-2">
                        OCPP remote controls are disabled because the charger is not currently connected to the server.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="mb-6">
            {charger.status !== 'offline' && allConnectors.length > 0 && (user?.role === "admin" || user?.role === "superadmin") && (
              <ManualSpeedOverridePanel chargerId={charger.charger_id} connectors={allConnectors} activeTxns={activeTxns} />
            )}
          </div>

          {/* Tertiary Section: Connectors */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card className="col-span-1">
              <CardHeader>
                <div>
                  <CardTitle>Connectors</CardTitle>
                  <CardDescription>Physical charge points on this hardware</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ConnectorList connectors={allConnectors} readOnly={true} />
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="connectors">
          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manage Connectors</CardTitle>
                  <CardDescription>Add, edit, or remove hardware connectors for this charger</CardDescription>
                </div>
                {(user?.role === "admin" || user?.role === "superadmin") && (
                  <Link href="/connectors/new">
                    <Button size="sm">
                      <Zap className="mr-2 h-4 w-4" /> Add Connector
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <ConnectorList connectors={allConnectors} readOnly={false} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schedules">
          <div className="mb-6">
            <ChargerSchedulesTab
              chargerId={charger.charger_id}
              chargerName={charger.name}
              isOnline={charger.status !== "offline"}
            />
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="mb-6">
            <ChargerTransactionsTable chargerId={charger.charger_id} />
          </div>
        </TabsContent>

        <TabsContent value="configuration">
          {/* Configuration Panel */}
          <div className="mb-6">
            <ChargerConfigurationPanel
              chargerId={charger.charger_id}
              chargerName={charger.name}
              isOnline={charger.status !== "offline"}
            />
          </div>
        </TabsContent>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Apply Configuration Profile</CardTitle>
              <CardDescription>Select a pre-defined profile to configure this charger with standard settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 max-w-lg">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Select Profile</label>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a configuration profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleApplyProfile} disabled={!selectedProfile || applyingProfile || charger.status === "offline"}>
                  {applyingProfile ? "Applying..." : "Apply Profile"}
                </Button>
              </div>
              {charger.status === "offline" && (
                <p className="text-sm text-destructive mt-2">Charger must be online to apply profiles.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="local-auth">
          <div className="mb-6">
            <LocalAuthListPanel chargerId={charger.charger_id} isOnline={charger.status !== "offline"} />
          </div>
        </TabsContent>
        <TabsContent value="predictive">
          <div className="mb-6">
            <PredictiveLoadMap chargerId={charger.charger_id} />
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}
