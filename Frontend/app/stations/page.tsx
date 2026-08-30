"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, MapPin, ArrowUpDown, Monitor, ChevronLeft, ChevronRight, Search, Building2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Station {
  id: number;
  station_name: string;
  street_name?: string;
  city: string;
  state: string;
  postal_code?: string;
  country?: string;
  status: string;
  isGroundPlanEnabled?: boolean;
  chargers?: any[];
  _count?: {
    chargers: number;
    parkingSpots?: number;
  };
  owner?: {
    id: number;
    email: string;
  };
}

export default function StationsPage() {
  const { user } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const getChargerCount = (station: Station): number => {
    if (typeof station._count?.chargers === "number") {
      return station._count.chargers;
    }
    if (Array.isArray(station.chargers)) {
      return station.chargers.length;
    }
    return 0;
  };

  const fetchStations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/stations', {
        params: { search: searchQuery || undefined, page, limit },
      });
      const data = response.data;
      setStations(Array.isArray(data) ? data : (data?.data || []));

      const pagination = (response as any).pagination || (data as any)?.pagination;
      if (pagination) {
        setTotalPages(pagination.totalPages || 1);
        setTotalCount(pagination.total ?? (Array.isArray(data) ? data.length : 0));
      } else if (Array.isArray(data)) {
        setTotalCount(data.length);
        setTotalPages(Math.ceil(data.length / limit) || 1);
      }
    } catch (error) {
      logger.error("Failed to fetch stations", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStations();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStations]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this station?")) return;
    try {
      await api.delete(`/stations/${id}`);
      setStations(stations.filter(s => s.id !== id));
    } catch (error) {
      logger.error("Failed to delete station", error);
      alert("Error deleting station.");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStations = [...stations].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key as keyof Station];
    let bVal: any = b[key as keyof Station];

    if (key === 'location') {
      aVal = `${a.city} ${a.state}`;
      bVal = `${b.city} ${b.state}`;
    } else if (key === 'owner') {
      aVal = a.owner?.email || '';
      bVal = b.owner?.email || '';
    } else if (key === 'chargers') {
      aVal = getChargerCount(a);
      bVal = getChargerCount(b);
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center">
                <MapPin className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Charging Locations
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage physical site locations, ground plans, and station assignments.
            </p>
          </div>

          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link href="/stations/new">
              <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                <Plus className="size-4 mr-1.5" /> Add Location
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search locations by name, city, postal code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {totalCount} Total Locations
          </Badge>
        </div>

        {/* Stations Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('station_name')}>
                  <div className="flex items-center gap-1.5">Station Name <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location')}>
                  <div className="flex items-center gap-1.5">Location <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('chargers')}>
                  <div className="flex items-center gap-1.5">Fleet Size <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead>Ground Plan</TableHead>
                {(user?.role === "admin" || user?.role === "superadmin") && <TableHead>Owner</TableHead>}
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">Status <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading station locations...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedStations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <MapPin className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No Locations Found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search criteria.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedStations.map((station) => {
                  const chargerCount = getChargerCount(station);
                  return (
                    <TableRow key={station.id} className="hover:bg-[#54a8c7]/5 transition-colors">
                      <TableCell className="font-medium">
                        <Link
                          href={`/stations/${station.id}`}
                          className="group flex items-center gap-2 font-bold text-foreground hover:text-[#54a8c7] transition-colors"
                        >
                          <div className="size-7 rounded-lg bg-[#3f78e0]/10 flex items-center justify-center text-[#3f78e0] group-hover:bg-[#3f78e0] group-hover:text-white transition-colors">
                            <Building2 className="size-3.5" />
                          </div>
                          <span>{station.station_name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        {station.street_name ? `${station.street_name}, ` : ''}{station.city}, {station.state}
                      </TableCell>
                      <TableCell>
                        <Badge variant="soft-primary" className="text-xs font-semibold gap-1">
                          <Zap className="size-3" />
                          {chargerCount} {chargerCount === 1 ? 'Charger' : 'Chargers'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {station.isGroundPlanEnabled ? (
                          <Link href={`/stations/${station.id}/live`}>
                            <Badge variant="soft-success" className="gap-1 cursor-pointer hover:bg-emerald-500/20 text-xs">
                              <Monitor className="size-3" /> Interactive Live Plan
                            </Badge>
                          </Link>
                        ) : (
                          <Badge variant="soft-secondary" className="text-xs">Disabled</Badge>
                        )}
                      </TableCell>
                      {(user?.role === "admin" || user?.role === "superadmin") && (
                        <TableCell className="text-xs text-muted-foreground">
                          {station.owner?.email || 'System'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant={station.status === 'active' ? 'soft-success' : 'soft-secondary'}
                          className="text-[10px] font-bold uppercase tracking-wider py-0.5"
                        >
                          {station.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/stations/${station.id}`}>
                            <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                              <MapPin className="size-3.5" />
                            </Button>
                          </Link>
                          {(user?.role === "admin" || user?.role === "superadmin") && (
                            <>
                              <Link href={`/stations/${station.id}/edit`}>
                                <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                                  <Edit className="size-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDelete(station.id)}
                                className="rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{stations.length}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> locations
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
