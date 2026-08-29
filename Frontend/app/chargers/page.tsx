"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Zap, ArrowUpDown, ChevronLeft, ChevronRight, Search, Filter, ShieldAlert, CheckCircle2, AlertTriangle, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ChargersPage() {
  const { user } = useAuth();
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
    if (!confirm("Are you sure you want to delete this charger?")) return;
    try {
      await api.delete(`/chargers/${id}`);
      setChargers(chargers.filter(c => c.charger_id !== id));
    } catch (error) {
      logger.error("Failed to delete charger", error);
      alert("Error deleting charger.");
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'online' || s === 'active') {
      return (
        <Badge variant="soft-success" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </Badge>
      );
    }
    if (s === 'charging') {
      return (
        <Badge variant="soft-primary" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-[#54a8c7] animate-pulse" />
          CHARGING
        </Badge>
      );
    }
    if (s === 'faulted') {
      return (
        <Badge variant="soft-danger" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
          <span className="size-1.5 rounded-full bg-rose-500" />
          FAULTED
        </Badge>
      );
    }
    return (
      <Badge variant="soft-secondary" className="gap-1 px-2.5 py-0.5 text-[11px] font-bold">
        <span className="size-1.5 rounded-full bg-slate-400" />
        OFFLINE
      </Badge>
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
    if (statusFilter === "ALL") return true;
    const s = (c.status || '').toLowerCase();
    if (statusFilter === "ONLINE") return s === 'online' || s === 'active';
    if (statusFilter === "CHARGING") return s === 'charging';
    if (statusFilter === "FAULTED") return s === 'faulted';
    if (statusFilter === "OFFLINE") return s !== 'online' && s !== 'active' && s !== 'charging' && s !== 'faulted';
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Zap className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Charging Fleet
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Monitor, configure, and operate OCPP charge points in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link href="/chargers/unrecognized">
                <Button variant="outline" className="rounded-xl">
                  Unrecognized
                </Button>
              </Link>
            )}
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link href="/chargers/new">
                <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                  <Plus className="size-4 mr-1.5" /> Add Charger
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
              placeholder="Search by identity, location, manufacturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { label: 'All', value: 'ALL' },
              { label: 'Online', value: 'ONLINE' },
              { label: 'Charging', value: 'CHARGING' },
              { label: 'Faulted', value: 'FAULTED' },
              { label: 'Offline', value: 'OFFLINE' },
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
                  <div className="flex items-center gap-1.5">Charge Point <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location')}>
                  <div className="flex items-center gap-1.5">Station Location <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('charge_group')}>
                  <div className="flex items-center gap-1.5">Charge Group <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('manufacturer_model')}>
                  <div className="flex items-center gap-1.5">Hardware <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">Status <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('last_heartbeat')}>
                  <div className="flex items-center gap-1.5">Heartbeat <ArrowUpDown className="size-3" /></div>
                </TableHead>
                {(user?.role === "admin" || user?.role === "superadmin") && (
                  <TableHead className="text-right">Actions</TableHead>
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
                      <p className="font-semibold text-foreground text-sm">No Chargers Found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search query or filters.</p>
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
                        <div className="flex items-center gap-1.5 ml-9">
                          {charger.isCombined && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30 px-1.5 py-0 font-medium">
                              2 Sockets ({charger.pairedRole === "primary" ? "Ch 1+2" : "Ch 2"})
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
                        <Badge variant="outline" className="text-xs font-medium">
                          {charger.chargeGroup.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{charger.manufacturer}</span> / {charger.model}
                    </TableCell>
                    <TableCell>{getStatusBadge(charger.status)}</TableCell>
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
            Showing <span className="font-semibold text-foreground">{filteredChargers.length}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> units
            {totalPages > 1 && (
              <span className="ml-1">
                (Page <span className="font-semibold text-foreground">{page}</span> of{" "}
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
              <ChevronLeft className="size-4 mr-1" /> Previous
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
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
