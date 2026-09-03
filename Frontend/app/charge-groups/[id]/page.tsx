"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronLeft,
  Edit,
  Trash2,
  Cpu,
  Zap,
  Users,
  Building2,
  Activity,
  Gauge,
  ShieldCheck,
  Search,
  ExternalLink,
  Radio,
  Clock,
  Info,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ChargeGroupDetail {
  id: number;
  name: string;
  description: string | null;
  maxPower: number | null;
  maxAmperage: number | null;
  maxPhaseCurrent: number;
  maxPhaseUnbalance: number;
  phaseUnbalanceLimit: number | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: number;
    name: string;
  } | null;
  chargers?: Array<{
    charger_id: number;
    name: string;
    model: string;
    manufacturer: string;
    serial_number: string;
    power_capacity: number;
    status: string;
    last_heartbeat: string;
    chargingStation?: {
      id: number;
      station_name: string;
      city: string;
    };
  }>;
  users?: Array<{
    chargeGroupId: number;
    userId: number;
    tariffId: number | null;
    user: {
      id: number;
      name: string | null;
      email: string;
      role: string;
    };
    tariff?: {
      tariff_id: number;
      name: string;
      energy_fee: number;
      connection_fee: number;
      time_fee: number;
      idle_fee: number;
      currency?: string;
    } | null;
  }>;
}

export default function ChargeGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const [group, setGroup] = useState<ChargeGroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chargerSearch, setChargerSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const groupId = params?.id ? String(params.id) : "";

  useEffect(() => {
    if (!groupId) return;
    const fetchGroup = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/charge-groups/${groupId}`);
        const data = res.data?.data || res.data;
        setGroup(data);
      } catch (err: any) {
        logger.error("Failed to load charge group", err);
        toast.error("Failed to load charge group details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGroup();
  }, [groupId]);

  const handleDelete = async () => {
    if (!group) return;
    if (!confirm(`Are you sure you want to delete charge group "${group.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await api.delete(`/charge-groups/${group.id}`);
      toast.success("Charge group deleted successfully");
      router.push("/charge-groups");
    } catch (err) {
      logger.error("Failed to delete charge group", err);
      toast.error("Failed to delete charge group");
      setIsDeleting(false);
    }
  };

  const filteredChargers = useMemo(() => {
    if (!group?.chargers) return [];
    if (!chargerSearch.trim()) return group.chargers;
    const q = chargerSearch.toLowerCase();
    return group.chargers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.serial_number.toLowerCase().includes(q) ||
        c.model?.toLowerCase().includes(q) ||
        c.chargingStation?.station_name?.toLowerCase().includes(q)
    );
  }, [group?.chargers, chargerSearch]);

  const filteredUsers = useMemo(() => {
    if (!group?.users) return [];
    if (!userSearch.trim()) return group.users;
    const q = userSearch.toLowerCase();
    return group.users.filter(
      (u) =>
        u.user.email.toLowerCase().includes(q) ||
        (u.user.name && u.user.name.toLowerCase().includes(q)) ||
        (u.tariff?.name && u.tariff.name.toLowerCase().includes(q))
    );
  }, [group?.users, userSearch]);

  const totalChargersPower = useMemo(() => {
    if (!group?.chargers) return 0;
    return group.chargers.reduce((acc, c) => acc + (c.power_capacity || 0), 0);
  }, [group?.chargers]);

  const renderChargerStatusBadge = (status: string) => {
    const s = (status || "offline").toLowerCase();
    if (s === "available" || s === "operative" || s === "online") {
      return (
        <Badge variant="soft-primary" className="text-[11px] gap-1 bg-[#45c4a0]/15 text-[#45c4a0] border-[#45c4a0]/30">
          <span className="size-1.5 rounded-full bg-[#45c4a0]" />
          Available
        </Badge>
      );
    }
    if (s === "charging" || s === "occupied") {
      return (
        <Badge variant="soft-primary" className="text-[11px] gap-1 bg-[#3f78e0]/15 text-[#3f78e0] border-[#3f78e0]/30">
          <span className="size-1.5 rounded-full bg-[#3f78e0] animate-pulse" />
          Charging
        </Badge>
      );
    }
    if (s === "faulted" || s === "error") {
      return (
        <Badge variant="soft-danger" className="text-[11px] gap-1 bg-[#e2626b]/15 text-[#e2626b] border-[#e2626b]/30">
          <span className="size-1.5 rounded-full bg-[#e2626b]" />
          Faulted
        </Badge>
      );
    }
    return (
      <Badge variant="soft-secondary" className="text-[11px] gap-1 text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        {status || "Offline"}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-7xl mx-auto p-4">
          <div className="h-8 w-40 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-28 w-full bg-muted/30 animate-pulse rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="h-64 w-full bg-muted/20 animate-pulse rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-[#e2626b]/10 text-[#e2626b] flex items-center justify-center mx-auto">
            <Cpu className="size-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Charge Group Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested charge group #{groupId} could not be found or you don't have permission to view it.
          </p>
          <div className="pt-2">
            <Link href="/charge-groups">
              <Button variant="outline" className="rounded-xl">
                <ChevronLeft className="size-4 mr-1.5" /> Back to Charge Groups
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const canManage = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4">
          <Link
            href="/charge-groups"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ChevronLeft className="size-4" />
            Back to Charge Groups
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/70 p-6 rounded-2xl shadow-xs">
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-2xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center shrink-0 mt-0.5">
                <Cpu className="size-7" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                    {group.name}
                  </h1>
                  <Badge variant="outline" className="text-xs font-semibold text-[#54a8c7] border-[#54a8c7]/30 bg-[#54a8c7]/10">
                    Group ID #{group.id}
                  </Badge>
                  {group.company ? (
                    <Badge variant="soft-secondary" className="text-xs gap-1">
                      <Building2 className="size-3 text-[#3f78e0]" />
                      {group.company.name}
                    </Badge>
                  ) : (
                    <Badge variant="soft-secondary" className="text-[11px]">
                      Global / Public
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {group.description || "No description provided for this load balancing group."}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Created {format(new Date(group.createdAt), "dd MMM yyyy")}
                  </span>
                  <span>•</span>
                  <span>Last updated {formatDistanceToNow(new Date(group.updatedAt))} ago</span>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                <Link href={`/charge-groups/${group.id}/edit`}>
                  <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                    <Edit className="size-4 mr-1.5" /> Edit Group
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <Trash2 className="size-4 mr-1.5" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border/70 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Capacity</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {group.maxPower !== null && group.maxPower !== undefined ? `${group.maxPower} kW` : "Unlimited"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connected: {totalChargersPower.toFixed(1)} kW max
                </p>
              </div>
              <div className="size-11 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Gauge className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Chargers</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {group.chargers?.length || 0}
                </p>
                <p className="text-xs text-[#45c4a0] mt-0.5 flex items-center gap-1 font-medium">
                  <Radio className="size-3" />
                  {group.chargers?.filter((c) => c.status?.toLowerCase() === "available" || c.status?.toLowerCase() === "charging").length || 0} Active
                </p>
              </div>
              <div className="size-11 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
                <Zap className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authorized Members</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {group.users?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {group.users?.filter((u) => u.tariffId).length || 0} Custom Tariffs
                </p>
              </div>
              <div className="size-11 rounded-xl bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center">
                <Users className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grid Phase Limits</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {group.maxPhaseCurrent ?? 80} A
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unbalance: ±{group.maxPhaseUnbalance ?? 16} A
                </p>
              </div>
              <div className="size-11 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <ShieldCheck className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Smart Charging & Load Management Info */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-[#54a8c7]/10 text-[#54a8c7] flex items-center justify-center">
                <Activity className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Dynamic Load Management & Smart Charging</CardTitle>
                <CardDescription className="text-xs">
                  Automated OCPP charging profiles are distributed dynamically across this cluster based on real-time grid conditions.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border/60">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Power Limit (kW)</span>
                <span className="text-sm font-bold text-foreground">
                  {group.maxPower !== null && group.maxPower !== undefined ? `${group.maxPower} kW` : "Unlimited (Site Max)"}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Dynamic throttling ceiling</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Max Current (A)</span>
                <span className="text-sm font-bold text-foreground">
                  {group.maxAmperage ? `${group.maxAmperage} A` : "Calculated from kW"}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total cluster draw limit</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Per-Phase Limit</span>
                <span className="text-sm font-bold text-foreground">
                  {group.maxPhaseCurrent ?? 80.0} A
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">L1 / L2 / L3 upper fuse</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Max Phase Unbalance</span>
                <span className="text-sm font-bold text-foreground">
                  ±{group.maxPhaseUnbalance ?? 16.0} A
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Neutral conductor safety</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Assigned Chargers */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Zap className="size-4 text-[#54a8c7]" />
                  Assigned Chargers ({group.chargers?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">
                  Physical charge points belonging to this load balancing domain.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter chargers..."
                  value={chargerSearch}
                  onChange={(e) => setChargerSearch(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs bg-muted/30 border-border/60"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden border-t border-border/70">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="text-xs">Charger Name / Serial</TableHead>
                    <TableHead className="text-xs">Charging Station</TableHead>
                    <TableHead className="text-xs">Hardware Model</TableHead>
                    <TableHead className="text-xs">Max Power</TableHead>
                    <TableHead className="text-xs">Live Status</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChargers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Zap className="size-6 text-muted-foreground/40" />
                          <p className="font-semibold text-foreground text-sm">
                            {chargerSearch ? "No matching chargers found" : "No Chargers Assigned"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {chargerSearch ? "Try a different search term." : "Edit this group to add chargers."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChargers.map((c) => (
                      <TableRow key={c.charger_id} className="hover:bg-[#54a8c7]/5 transition-colors">
                        <TableCell className="font-medium">
                          <Link
                            href={`/chargers/${c.charger_id}`}
                            className="font-bold text-sm text-foreground hover:text-[#54a8c7] transition-colors flex items-center gap-1.5"
                          >
                            <span>{c.name}</span>
                            <ExternalLink className="size-3 opacity-60" />
                          </Link>
                          <div className="text-xs text-muted-foreground font-mono">
                            SN: {c.serial_number}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.chargingStation ? (
                            <Link
                              href={`/stations/${c.chargingStation.id}`}
                              className="font-medium text-foreground hover:text-[#54a8c7] transition-colors"
                            >
                              {c.chargingStation.station_name}
                              {c.chargingStation.city && (
                                <span className="text-muted-foreground ml-1">({c.chargingStation.city})</span>
                              )}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{c.manufacturer}</span>
                          {c.model && <span> / {c.model}</span>}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {c.power_capacity ? `${c.power_capacity} kW` : "—"}
                        </TableCell>
                        <TableCell>{renderChargerStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/chargers/${c.charger_id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg">
                              View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Authorized Members & Assigned Tariffs */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="size-4 text-[#3f78e0]" />
                  Authorized Members & Custom Tariffs ({group.users?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">
                  Drivers permitted to initiate charging sessions within this group, with optional preferential pricing.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter members..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs bg-muted/30 border-border/60"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden border-t border-border/70">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="text-xs">Member / Driver</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Applied Tariff</TableHead>
                    <TableHead className="text-xs">Energy Rate</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Users className="size-6 text-muted-foreground/40" />
                          <p className="font-semibold text-foreground text-sm">
                            {userSearch ? "No matching members found" : "No Members Assigned"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {userSearch ? "Try a different search term." : "Edit this group to assign member drivers."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow key={u.userId} className="hover:bg-[#3f78e0]/5 transition-colors">
                        <TableCell className="font-medium">
                          <Link
                            href={`/users/${u.userId}`}
                            className="font-bold text-sm text-foreground hover:text-[#3f78e0] transition-colors flex items-center gap-1.5"
                          >
                            <span>{u.user.name || u.user.email}</span>
                            <ExternalLink className="size-3 opacity-60" />
                          </Link>
                          {u.user.name && (
                            <div className="text-xs text-muted-foreground">{u.user.email}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="soft-secondary" className="text-[10px] capitalize">
                            {u.user.role || "user"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.tariff ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="soft-primary" className="text-xs font-semibold bg-[#54a8c7]/15 text-[#54a8c7]">
                                {u.tariff.name}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default Station Tariff</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">
                          {u.tariff ? (
                            <span>
                              {u.tariff.currency || "€"}
                              {Number(u.tariff.energy_fee).toFixed(2)}/kWh
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/users/${u.userId}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg">
                              View Profile
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
