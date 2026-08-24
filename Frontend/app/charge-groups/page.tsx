"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Users, Zap, Trash2, Edit, ArrowUpDown, Search, Cpu, Building } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ChargeGroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get('/charge-groups', { params: { search: searchQuery || undefined } });
      setGroups(response.data || []);
    } catch (error) {
      toast.error("Failed to fetch charge groups");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchGroups]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this charge group?")) return;
    try {
      await api.delete(`/charge-groups/${id}`);
      toast.success("Charge group deleted");
      fetchGroups();
    } catch {
      toast.error("Failed to delete charge group");
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGroups = [...(Array.isArray(groups) ? groups : [])].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key];
    let bVal: any = b[key];

    if (key === 'chargers') {
      aVal = a.chargers?.length || 0;
      bVal = b.chargers?.length || 0;
    } else if (key === 'users') {
      aVal = a.users?.length || 0;
      bVal = b.users?.length || 0;
    } else if (key === 'createdAt') {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
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
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <Cpu className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Charge Groups
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Group chargers and drivers to enforce dedicated power profiles and tailored pricing.
            </p>
          </div>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link href="/charge-groups/create">
              <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                <Plus className="size-4 mr-1.5" /> Create Group
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search charge groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {sortedGroups.length} Active Groups
          </Badge>
        </div>

        {/* Groups Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">Group Name <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead>Assigned Company</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('chargers')}>
                  <div className="flex items-center gap-1.5">Chargers <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('users')}>
                  <div className="flex items-center gap-1.5">Members <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1.5">Created <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading charge groups...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Cpu className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No Charge Groups Found</p>
                      <p className="text-xs text-muted-foreground">Create a group to organize charge points.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedGroups.map((group) => (
                  <TableRow key={group.id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="font-bold text-sm text-foreground flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-[#54a8c7]/10 text-[#54a8c7] flex items-center justify-center">
                          <Cpu className="size-3.5" />
                        </div>
                        <span>{group.name}</span>
                      </div>
                      {group.description && (
                        <div className="text-xs text-muted-foreground ml-9">{group.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-muted-foreground">
                      {group.company ? (
                        <span className="flex items-center gap-1 text-foreground">
                          <Building className="size-3 text-[#3f78e0]" />
                          {group.company.name}
                        </span>
                      ) : (
                        <Badge variant="soft-secondary" className="text-[10px]">Global / Public</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="soft-primary" className="text-xs font-semibold gap-1">
                        <Zap className="size-3" />
                        {group.chargers?.length || 0} Chargers
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="soft-secondary" className="text-xs font-semibold gap-1">
                        <Users className="size-3" />
                        {group.users?.length || 0} Members
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {group.createdAt ? format(new Date(group.createdAt), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/charge-groups/${group.id}/edit`}>
                          <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                            <Edit className="size-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(group.id)}
                          className="rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
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
