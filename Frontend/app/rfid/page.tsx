"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, CreditCard, ArrowUpDown, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface RfidTag {
  rfid_user_id: number;
  rfid_tag: string;
  name: string;
  type: string;
  active: boolean;
  createdAt: string;
}

export default function RfidPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<RfidTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const response = await api.get('/rfid', { params: { search: searchQuery || undefined } });
      setTags(response.data?.data || response.data || []);
    } catch (error) {
      logger.error("Failed to fetch RFID tags", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTags();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTags]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this RFID tag? This action cannot be undone.")) return;
    try {
      await api.delete(`/rfid/${id}`);
      setTags(tags.filter(t => t.rfid_user_id !== id));
    } catch (error) {
      logger.error("Failed to delete RFID tag", error);
      alert("Error deleting tag.");
    }
  };

  const toggleActive = async (id: number) => {
    try {
      await api.patch(`/rfid/${id}/toggle`);
      setTags(tags.map(t => t.rfid_user_id === id ? { ...t, active: !t.active } : t));
    } catch (error) {
      logger.error("Failed to toggle RFID status", error);
      alert("Error updating tag status.");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTags = [...tags].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    const aVal: any = a[key as keyof RfidTag];
    const bVal: any = b[key as keyof RfidTag];

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
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <CreditCard className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                RFID & Access Authorization
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage authorized RFID tags, key fobs, driver credentials, and whitelist sync.
            </p>
          </div>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link href="/rfid/new">
              <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                <Plus className="size-4 mr-1.5" /> Register Tag
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tags by UID, assigned user, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {tags.length} Whitelist Tokens
          </Badge>
        </div>

        {/* RFID Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('rfid_tag')}>
                  <div className="flex items-center gap-1.5">Tag ID (UID) <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">Assigned Holder <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-1.5">Type <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead>Authorization Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading authorization tags...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <CreditCard className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No RFID Tags Found</p>
                      <p className="text-xs text-muted-foreground">Add RFID tokens to authorize charging sessions.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTags.map((tag) => (
                  <TableRow key={tag.rfid_user_id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-mono font-bold text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-[#54a8c7]/10 text-[#54a8c7] flex items-center justify-center font-sans">
                          <CreditCard className="size-3.5" />
                        </div>
                        <span>{tag.rfid_tag}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-foreground">
                      {tag.name || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs uppercase">
                        {tag.type || 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={tag.active}
                          onCheckedChange={() => toggleActive(tag.rfid_user_id)}
                          disabled={user?.role !== "admin" && user?.role !== "superadmin"}
                        />
                        <Badge
                          variant={tag.active ? "soft-success" : "soft-secondary"}
                          className="text-[10px] font-bold uppercase tracking-wider py-0.5"
                        >
                          {tag.active ? "Active / Whitelisted" : "Blocked"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/rfid/${tag.rfid_user_id}`}>
                          <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                            <CreditCard className="size-3.5" />
                          </Button>
                        </Link>
                        {(user?.role === "admin" || user?.role === "superadmin") && (
                          <>
                            <Link href={`/rfid/${tag.rfid_user_id}/edit`}>
                              <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                                <Edit className="size-3.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDelete(tag.rfid_user_id)}
                              className="rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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
