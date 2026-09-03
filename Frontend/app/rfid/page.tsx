"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, CreditCard, ArrowUpDown, Search, ShieldCheck, Globe, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { GoogleWalletModal } from "@/components/rfid/GoogleWalletModal";

interface RfidTag {
  rfid_user_id: number;
  rfid_tag: string;
  name?: string;
  type: string;
  cardScope?: string;
  active: boolean;
  createdAt: string;
  holderType?: string | null;
  holderUserId?: number | null;
  holderCompanyId?: number | null;
  holderUser?: { id: number; email: string; name?: string | null } | null;
  holderCompany?: { id: number; name: string } | null;
  owner?: { id: number; email: string; name?: string | null } | null;
  ownerCompany?: { id: number; name: string } | null;
}

const getAssignedHolder = (tag: RfidTag) => {
  if (tag.holderCompany?.name) {
    return { name: tag.holderCompany.name, type: 'company' as const };
  }
  if (tag.holderUser) {
    const name = tag.holderUser.name || tag.holderUser.email;
    const sub = tag.holderUser.name ? tag.holderUser.email : undefined;
    return { name, sub, type: 'user' as const };
  }
  if (tag.name && tag.name.trim() !== '' && tag.name !== 'Unassigned') {
    return { name: tag.name, type: 'legacy' as const };
  }
  return { name: 'Unassigned', type: 'none' as const };
};

export default function RfidPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<RfidTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Google Wallet modal state
  const [selectedWalletTag, setSelectedWalletTag] = useState<RfidTag | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

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

    let aVal: any = a[key as keyof RfidTag];
    let bVal: any = b[key as keyof RfidTag];

    if (key === 'name') {
      aVal = getAssignedHolder(a).name.toLowerCase();
      bVal = getAssignedHolder(b).name.toLowerCase();
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
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
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('cardScope')}>
                  <div className="flex items-center gap-1.5">Scope <ArrowUpDown className="size-3" /></div>
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
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading authorization tags...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
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
                    <TableCell>
                      {(() => {
                        const holder = getAssignedHolder(tag);
                        if (holder.type === 'company') {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="size-7 rounded-lg bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center shrink-0">
                                <Building2 className="size-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm text-foreground">{holder.name}</span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-[#54a8c7]/10 text-[#54a8c7] border-[#54a8c7]/30">Company</Badge>
                                </span>
                              </div>
                            </div>
                          );
                        }
                        if (holder.type === 'user') {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="size-7 rounded-lg bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center shrink-0">
                                <User className="size-3.5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm text-foreground">{holder.name}</span>
                                {holder.sub && <span className="text-xs text-muted-foreground">{holder.sub}</span>}
                              </div>
                            </div>
                          );
                        }
                        if (holder.type === 'legacy') {
                          return <span className="font-semibold text-sm text-foreground">{holder.name}</span>;
                        }
                        return <span className="text-sm text-muted-foreground/70 italic">Unassigned</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {tag.cardScope?.toLowerCase() === 'local' ? (
                        <Badge variant="outline" className="text-[11px] bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1 inline-flex items-center font-medium">
                          <Building2 className="size-3" /> Local
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] bg-[#54a8c7]/10 text-[#54a8c7] border-[#54a8c7]/30 gap-1 inline-flex items-center font-medium">
                          <Globe className="size-3" /> Roaming
                        </Badge>
                      )}
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
                        {/* Apple Wallet Button */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Add to Apple Wallet (NFC Pass)"
                          onClick={() => {
                            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                            const query = token ? `?token=${encodeURIComponent(token)}` : "";
                            window.open(`/api/rfid/${tag.rfid_user_id}/apple-wallet${query}`, '_blank');
                          }}
                          className="rounded-lg text-foreground hover:bg-muted/80"
                        >
                          <span className="text-[10px] font-bold">🍏</span>
                        </Button>

                        {/* Google Wallet Button */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Add to Google Wallet (NFC Pass)"
                          onClick={() => {
                            setSelectedWalletTag(tag);
                            setIsWalletModalOpen(true);
                          }}
                          className="rounded-lg text-emerald-500 hover:bg-emerald-500/10"
                        >
                          <span className="text-[10px] font-bold">💳</span>
                        </Button>

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

      {/* Google Wallet & NFC Digital Pass Modal */}
      <GoogleWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setSelectedWalletTag(null);
        }}
        rfidUserId={selectedWalletTag?.rfid_user_id || null}
        rfidTag={selectedWalletTag?.rfid_tag}
        cardholderName={selectedWalletTag ? getAssignedHolder(selectedWalletTag).name : undefined}
      />
    </AppShell>
  );
}
