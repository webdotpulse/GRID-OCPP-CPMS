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
import { ChevronLeft, Edit, Zap, Info, Clock, CheckCircle } from "lucide-react";
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
  firmware_version: string;
  power_capacity: number;
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
}

export default function ChargerDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [charger, setCharger] = useState<ChargerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [applyingProfile, setApplyingProfile] = useState(false);

  useEffect(() => {
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
        const sessions = response.data.filter((s: any) => s.chargerId === Number(id));
        setActiveTxns(sessions);
      } catch (err) {
        toast.error("Failed to fetch active transactions");
      }
    };
    fetchActiveTxns();
    const interval = setInterval(fetchActiveTxns, 30000);
    return () => clearInterval(interval);
  }, [id]);

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

  if (isLoading) return <AppShell><div className="p-8">Loading charger details...</div></AppShell>;
  if (!charger) return <AppShell><div className="p-8 text-red-500">Charger not found</div></AppShell>;

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
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-4">
          <Link href="/chargers">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Chargers
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{charger.name}</h1>
            {getStatusBadge(charger.status)}
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            Installed at {charger.chargingStation ? (
              <span className="font-medium text-foreground">{charger.chargingStation.station_name}</span>
            ) : (
              <i>Unassigned Station</i>
            )}
          </p>
        </div>
        <Link href={`/chargers/${id}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Edit Hardware Details
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
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
          </div>

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

        <TabsContent value="transactions">
          <div className="mb-6">
            <ChargerTransactionsTable chargerId={charger.charger_id} />
          </div>
        </TabsContent>

        <TabsContent value="configuration">
          {/* Configuration Panel */}
          <div className="mb-6">
            <ChargerConfigurationPanel chargerId={charger.charger_id} />
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
    </AppShell>
  );
}
