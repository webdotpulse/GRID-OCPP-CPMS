"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, WalletCards, ArrowUpDown, Search, Zap, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TariffsPage() {
  const { user } = useAuth();
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchTariffs = useCallback(async () => {
    try {
      const response = await api.get('/tariffs', { params: { search: searchQuery || undefined } });
      setTariffs(response.data?.data || response.data || []);
      setApiError(false);
    } catch (error) {
      logger.error("Failed to fetch tariffs", error);
      setApiError(true);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTariffs();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTariffs]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this tariff?")) return;
    try {
      await api.delete(`/tariffs/${id}`);
      setTariffs(tariffs.filter(t => t.tariff_id !== id));
    } catch (error) {
      logger.error("Failed to delete tariff", error);
      alert("Error deleting tariff.");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTariffs = [...tariffs].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key];
    let bVal: any = b[key];

    if (key === 'charge') {
      aVal = Number(a.charge);
      bVal = Number(b.charge);
    } else if (key === 'electricity_rate') {
      aVal = Number(a.electricity_rate);
      bVal = Number(b.electricity_rate);
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
              <div className="size-9 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <WalletCards className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Tariff Management
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Define energy pricing models, dynamic spot markups, and station billing plans.
            </p>
          </div>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link href="/tariffs/new">
              <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                <Plus className="size-4 mr-1.5" /> Add Tariff Plan
              </Button>
            </Link>
          )}
        </div>

        {apiError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertCircle className="size-4" />
            <AlertTitle>API Notice</AlertTitle>
            <AlertDescription>
              Could not reach the Tariff API endpoint. Please ensure the backend service is running.
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tariff plans by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {tariffs.length} Active Plans
          </Badge>
        </div>

        {/* Tariffs Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('tariff_name')}>
                  <div className="flex items-center gap-1.5">Plan Name <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead>Pricing Model</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('charge')}>
                  <div className="flex items-center justify-end gap-1.5">Fixed / Monthly <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('electricity_rate')}>
                  <div className="flex items-center justify-end gap-1.5">Energy Rate / Markup <ArrowUpDown className="size-3" /></div>
                </TableHead>
                {(user?.role === "admin" || user?.role === "superadmin") && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && tariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading pricing plans...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedTariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <WalletCards className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No Tariff Plans Configured</p>
                      <p className="text-xs text-muted-foreground">Create a new pricing plan to bill transactions.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTariffs.map((tariff) => (
                  <TableRow key={tariff.tariff_id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <div className="size-7 rounded-lg bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                          <DollarSign className="size-3.5" />
                        </div>
                        <span>{tariff.tariff_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tariff.tariffType === "DYNAMIC_EPEX" ? (
                        <Badge variant="soft-primary" className="text-xs font-semibold gap-1">
                          <Zap className="size-3" /> Dynamic EPEX ({tariff.country || 'EU'})
                        </Badge>
                      ) : (
                        <Badge variant="soft-secondary" className="text-xs font-semibold">
                          Fixed Flat Rate
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                      {tariff.tariffType === "DYNAMIC_EPEX"
                        ? `€${Number(tariff.fixedFeePerMonth || 0).toFixed(2)} / mo`
                        : `€${Number(tariff.charge || 0).toFixed(2)}`
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-[#54a8c7]">
                      {tariff.tariffType === "DYNAMIC_EPEX"
                        ? `EPEX + €${Number(tariff.markupPerKwh || 0).toFixed(3)} / kWh`
                        : `€${Number(tariff.electricity_rate || 0).toFixed(3)} / kWh`
                      }
                    </TableCell>
                    {(user?.role === "admin" || user?.role === "superadmin") && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/tariffs/${tariff.tariff_id}/edit`}>
                            <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                              <Edit className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(tariff.tariff_id)}
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
      </div>
    </AppShell>
  );
}
