"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Zap, ArrowUpDown, ChevronLeft, ChevronRight, Search, Filter, ShieldAlert, CheckCircle2, AlertTriangle, Radio, Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ChargersPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [chargers, setChargers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchChargers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/chargers', {
        params: { search: searchQuery || undefined, page, limit },
      });
      const data = response.data;
      setChargers(Array.isArray(data) ? data : (data?.data || []));

      const pagination = (response as any).pagination || (data as any)?.pagination;
      if (pagination) {
        setTotalPages(pagination.totalPages || 1);
        setTotalCount(pagination.total ?? (Array.isArray(data) ? data.length : 0));
      } else if (Array.isArray(data)) {
        setTotalCount(data.length);
        setTotalPages(Math.ceil(data.length / limit) || 1);
      }
    } catch (error) {
      logger.error("Failed to fetch chargers", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChargers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchChargers]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('chargers.deleteConfirm', "Are you sure you want to delete this charger?"))) return;
    try {
      await api.delete(`/chargers/${id}`);
      setChargers(chargers.filter(c => c.charger_id !== id));
    } catch (error) {
      logger.error("Failed to delete charger", error);
      alert("Error deleting charger.");
    }
  };

  interface ChannelInfo {
    id: string | number;
    name: string;
    status: string;
    current_type?: string;
    max_power?: number;
  }

  const getChargerChannels = (charger: any): ChannelInfo[] => {
    const rawChannels: ChannelInfo[] = [];

    if (charger.evses && Array.isArray(charger.evses) && charger.evses.length > 0) {
      const sortedEvses = [...charger.evses].sort((a, b) => (a.evse_id ?? a.id ?? 0) - (b.evse_id ?? b.id ?? 0));
      let fallbackIndex = 1;
      for (const evse of sortedEvses) {
        if (evse.connectors && Array.isArray(evse.connectors) && evse.connectors.length > 0) {
          const sortedConns = [...evse.connectors].sort((a, b) => (a.connector_id ?? 0) - (b.connector_id ?? 0));
          for (const conn of sortedConns) {
            rawChannels.push({
              id: conn.connector_id || `evse-${evse.id || evse.evse_id}-${fallbackIndex}`,
              name: conn.connector_name || `Channel ${fallbackIndex}`,
              status: conn.status || charger.status || "Offline",
              current_type: conn.current_type,
              max_power: conn.max_power,
            });
            fallbackIndex++;
          }
        }
      }
    } else if (charger.connectors && Array.isArray(charger.connectors) && charger.connectors.length > 0) {
      charger.connectors.forEach((conn: any, idx: number) => {
        rawChannels.push({
          id: conn.connector_id || idx + 1,
          name: conn.connector_name || `Channel ${idx + 1}`,
          status: conn.status || charger.status || "Offline",
          current_type: conn.current_type,
          max_power: conn.max_power,
        });
      });
    }

    // Handle combined paired charger (Channel 2 from paired charger)
    if (charger.isCombined && charger.pairedCharger) {
      const paired = charger.pairedCharger;
      const pairedConn = paired.evses?.[0]?.connectors?.[0] || paired.connectors?.[0];
      const pairedStatus = pairedConn?.status || paired.status;

      // Check if Channel 2 is already present in rawChannels
      const existingCh2Index = rawChannels.findIndex(ch =>
        ch.name.toLowerCase().includes("channel 2") ||
        ch.name.toLowerCase().includes("ch 2") ||
        ch.name.toLowerCase() === "channel 2"
      );

      if (existingCh2Index >= 0) {
        // Channel 2 is already present from primary EVSE; sync live status from paired charger
        if (pairedStatus) {
          rawChannels[existingCh2Index].status = pairedStatus;
        }
      } else {
        // Primary didn't have Channel 2 in its own EVSE/connectors, add it from paired charger
        rawChannels.push({
          id: pairedConn ? `paired-${pairedConn.connector_id}` : `paired-${paired.charger_id}`,
          name: pairedConn?.connector_name || "Channel 2",
          status: pairedStatus || charger.status || "Offline",
          current_type: pairedConn?.current_type,
          max_power: pairedConn?.max_power,
        });
      }
    }

    // Deduplicate channels by normalized channel name (specifically Channel X / CH X / Connector X)
    const seenKeys = new Set<string>();
    const channels: ChannelInfo[] = [];

    for (const ch of rawChannels) {
      const channelMatch = ch.name.match(/^(?:channel|ch|connector)\s*(\d+)$/i);
      const key = channelMatch ? `channel-${channelMatch[1]}` : (ch.id ? `id-${ch.id}` : ch.name.trim().toLowerCase());

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        channels.push(ch);
      }
    }

    return channels;
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'online' || s === 'active') {
      return (
        <Badge variant="soft-success" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t('chargers.statusOnline', 'ONLINE')}
        </Badge>
      );
    }
    if (s === 'charging') {
      return (
        <Badge variant="soft-primary" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-[#54a8c7] animate-pulse" />
          {t('chargers.statusCharging', 'CHARGING')}
        </Badge>
      );
    }
    if (s === 'faulted') {
      return (
        <Badge variant="soft-danger" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-rose-500" />
          {t('chargers.statusFaulted', 'FAULTED')}
        </Badge>
      );
    }
    return (
      <Badge variant="soft-secondary" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
        <span className="size-1.5 rounded-full bg-slate-400" />
        {t('chargers.statusOffline', 'OFFLINE')}
      </Badge>
    );
  };

  const getChannelBadge = (status: string, channelName: string) => {
    const s = status?.toLowerCase() || '';
    const formattedName = channelName.replace(/^Channel\s+/i, 'CH ');

    if (s === 'available' || s === 'online' || s === 'active') {
      return (
        <Badge variant="soft-success" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="font-semibold text-emerald-400 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusAvailable', 'Available')}</span>
        </Badge>
      );
    }
    if (s === 'charging') {
      return (
        <Badge variant="soft-primary" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-[#54a8c7] animate-pulse" />
          <span className="font-semibold text-[#54a8c7]/90 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusCharging', 'Charging')}</span>
        </Badge>
      );
    }
    if (s === 'preparing' || s === 'connected') {
      return (
        <Badge variant="soft-warning" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-semibold text-amber-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusPreparing', 'Preparing')}</span>
        </Badge>
      );
    }
    if (s === 'suspendedev' || s === 'suspendedevse' || s === 'suspended') {
      return (
        <Badge variant="soft-warning" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="font-semibold text-amber-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusSuspended', 'Suspended')}</span>
        </Badge>
      );
    }
    if (s === 'finishing') {
      return (
        <Badge variant="soft-purple" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-purple-400" />
          <span className="font-semibold text-purple-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusFinishing', 'Finishing')}</span>
        </Badge>
      );
    }
    if (s === 'reserved') {
      return (
        <Badge variant="soft-warning" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-yellow-400" />
          <span className="font-semibold text-yellow-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusReserved', 'Reserved')}</span>
        </Badge>
      );
    }
    if (s === 'faulted') {
      return (
        <Badge variant="soft-danger" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-rose-500" />
          <span className="font-semibold text-rose-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusFaulted', 'Faulted')}</span>
        </Badge>
      );
    }
    if (s === 'unavailable') {
      return (
        <Badge variant="soft-secondary" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-slate-400" />
          <span className="font-semibold text-slate-300 mr-0.5">{formattedName}:</span>
          <span>{t('chargers.statusUnavailable', 'Unavailable')}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="soft-secondary" className="gap-1.5 px-2 py-0.5 text-[11px] font-bold">
        <span className="size-1.5 rounded-full bg-slate-400" />
        <span className="font-semibold text-slate-300 mr-0.5">{formattedName}:</span>
        <span>{status ? status : t('chargers.statusOffline', 'Offline')}</span>
      </Badge>
    );
  };

  const renderChargerStatus = (charger: any) => {
    const channels = getChargerChannels(charger);

    if (channels.length === 0) {
      return getStatusBadge(charger.status);
    }

    return (
      <div className="flex flex-col gap-1.5 py-0.5 min-w-[130px]">
        {channels.map((ch, idx) => (
          <div key={ch.id || idx} className="flex items-center">
            {getChannelBadge(ch.status, ch.name)}
          </div>
        ))}
      </div>
    );
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredChargers = chargers.filter(c => {
    // Hide secondary paired chargers to avoid confusion
    if (c.pairedRole === "secondary") return false;
    if (statusFilter === "ALL") return true;

    const channels = getChargerChannels(c);
    const channelStatuses = channels.map(ch => (ch.status || '').toLowerCase());
    const chargerStatus = (c.status || '').toLowerCase();

    if (statusFilter === "ONLINE") {
      return (
        chargerStatus === 'online' ||
        chargerStatus === 'active' ||
        channelStatuses.some(s => ['available', 'online', 'active', 'charging', 'preparing', 'suspendedev', 'suspendedevse', 'finishing', 'reserved'].includes(s))
      );
    }
    if (statusFilter === "CHARGING") {
      return chargerStatus === 'charging' || channelStatuses.includes('charging');
    }
    if (statusFilter === "FAULTED") {
      return chargerStatus === 'faulted' || channelStatuses.includes('faulted');
    }
    if (statusFilter === "OFFLINE") {
      const isOnline =
        chargerStatus === 'online' ||
        chargerStatus === 'active' ||
        channelStatuses.some(s => ['available', 'online', 'active', 'charging', 'preparing'].includes(s));
      return !isOnline;
    }
    return true;
  });

  const sortedChargers = [...filteredChargers].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aVal = a[key];
    let bVal = b[key];

    if (key === 'manufacturer_model') {
      aVal = `${a.manufacturer} ${a.model}`;
      bVal = `${b.manufacturer} ${b.model}`;
    } else if (key === 'location') {
      aVal = a.chargingStation?.station_name || 'Unassigned';
      bVal = b.chargingStation?.station_name || 'Unassigned';
    } else if (key === 'charge_group') {
      aVal = a.chargeGroup?.name || 'None';
      bVal = b.chargeGroup?.name || 'None';
    } else if (key === 'status') {
      const aChannels = getChargerChannels(a);
      const bChannels = getChargerChannels(b);
      aVal = aChannels.length > 0 ? aChannels.map(c => c.status).join(',') : (a.status || '');
      bVal = bChannels.length > 0 ? bChannels.map(c => c.status).join(',') : (b.status || '');
    } else if (key === 'last_heartbeat') {
      aVal = a.last_heartbeat ? new Date(a.last_heartbeat).getTime() : 0;
      bVal = b.last_heartbeat ? new Date(b.last_heartbeat).getTime() : 0;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Zap className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                {t('chargers.title', 'Charging Fleet')}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('chargers.subtitle', 'Monitor, configure, and operate OCPP charge points in real-time.')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link href="/chargers/unrecognized">
                <Button variant="outline" className="rounded-xl">
                  {t('chargers.unrecognized', 'Unrecognized')}
                </Button>
              </Link>
            )}
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link href="/chargers/new">
                <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                  <Plus className="size-4 mr-1.5" /> {t('chargers.addCharger', 'Add Charger')}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('chargers.searchPlaceholder', 'Search by identity, location, manufacturer...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { label: t('chargers.filterAll', 'All'), value: 'ALL' },
              { label: t('chargers.filterOnline', 'Online'), value: 'ONLINE' },
              { label: t('chargers.filterCharging', 'Charging'), value: 'CHARGING' },
              { label: t('chargers.filterFaulted', 'Faulted'), value: 'FAULTED' },
              { label: t('chargers.filterOffline', 'Offline'), value: 'OFFLINE' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.value
                    ? 'bg-[#54a8c7] text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chargers Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colChargePoint', 'Charge Point')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colLocation', 'Station Location')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('charge_group')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colGroup', 'Charge Group')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('manufacturer_model')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colHardware', 'Hardware')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colStatus', 'Status')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('last_heartbeat')}>
                  <div className="flex items-center gap-1.5">{t('chargers.colHeartbeat', 'Heartbeat')} <ArrowUpDown className="size-3" /></div>
                </TableHead>
                {(user?.role === "admin" || user?.role === "superadmin") && (
                  <TableHead className="text-right">{t('chargers.colActions', 'Actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading fleet chargers...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedChargers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Zap className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">{t('chargers.noChargersFound', 'No Chargers Found')}</p>
                      <p className="text-xs text-muted-foreground">{t('chargers.noChargersDesc', 'Try adjusting your search query or filters.')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedChargers.map((charger) => (
                  <TableRow key={charger.charger_id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/chargers/${charger.charger_id}`}
                          className="group flex items-center gap-2 font-bold text-foreground hover:text-[#54a8c7] transition-colors"
                        >
                          <div className="size-7 rounded-lg bg-[#54a8c7]/10 flex items-center justify-center text-[#54a8c7] group-hover:bg-[#54a8c7] group-hover:text-white transition-colors">
                            <Zap className="size-3.5" />
                          </div>
                          <span>{charger.name}</span>
                        </Link>
                        <div className="flex items-center gap-1.5 ml-9 flex-wrap">
                          {charger.isPublic ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-1.5 py-0 font-medium inline-flex items-center gap-1">
                              <Globe className="size-2.5" /> Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 px-1.5 py-0 font-medium inline-flex items-center gap-1">
                              <Lock className="size-2.5" /> Private
                            </Badge>
                          )}
                          {charger.isCombined && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30 px-1.5 py-0 font-medium">
                              2 Sockets (Combined)
                            </Badge>
                          )}
                          {charger.isStraightThroughProxy && (
                            <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30 px-1.5 py-0 font-medium">
                              Straight-Through
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      {charger.chargingStation?.station_name || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      {charger.chargeGroup?.name ? (
                        <Link href={`/charge-groups/${charger.chargeGroupId || charger.chargeGroup.id}`}>
                          <Badge variant="outline" className="text-xs font-medium hover:border-[#54a8c7] hover:text-[#54a8c7] cursor-pointer transition-colors">
                            {charger.chargeGroup.name}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{charger.manufacturer}</span> / {charger.model}
                    </TableCell>
                    <TableCell>{renderChargerStatus(charger)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {charger.last_heartbeat 
                        ? `${formatDistanceToNow(new Date(charger.last_heartbeat))} ago` 
                        : 'Never'}
                    </TableCell>
                    {(user?.role === "admin" || user?.role === "superadmin") && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/chargers/${charger.charger_id}/edit`}>
                            <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                              <Edit className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(charger.charger_id)}
                            className="rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="text-xs text-muted-foreground">
            {t('common.showing', 'Showing')}{" "}
            <span className="font-semibold text-foreground">{filteredChargers.length}</span>{" "}
            {t('common.of', 'of')}{" "}
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            {t('common.units', 'units')}
            {totalPages > 1 && (
              <span className="ml-1">
                ({t('common.page', 'Page')} <span className="font-semibold text-foreground">{page}</span>{" "}
                {t('common.of', 'of')}{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8.5 px-3 rounded-xl"
            >
              <ChevronLeft className="size-4 mr-1" /> {t('common.previous', 'Previous')}
            </Button>
            <div className="text-xs font-semibold px-3 py-1.5 bg-card rounded-xl border border-border/80 min-w-[3.5rem] text-center shadow-2xs">
              {page} / {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="h-8.5 px-3 rounded-xl"
            >
              {t('common.next', 'Next')} <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
