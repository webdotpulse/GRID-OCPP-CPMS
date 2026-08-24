"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit, Building, User as UserIcon, Briefcase, ArrowUpDown, Search, Users, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const { user } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users', { params: { search: searchQuery || undefined } });
      setUsers(response.data || []);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete user");
    }
  };

  const getUserTypeIcon = (type: string) => {
    if (type === 'company') return <Building className="size-3.5 text-[#3f78e0]" />;
    if (type === 'employee') return <Briefcase className="size-3.5 text-[#45c4a0]" />;
    return <UserIcon className="size-3.5 text-[#fab758]" />;
  };

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
          <Shield className="size-10 text-muted-foreground/50" />
          <p className="text-foreground font-bold">Admin Privileges Required</p>
          <p className="text-xs text-muted-foreground">Only system administrators can access user accounts.</p>
        </div>
      </AppShell>
    );
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...(Array.isArray(users) ? users : [])].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key];
    let bVal: any = b[key];

    if (key === 'createdAt') {
      aVal = new Date(a.createdAt || 0).getTime();
      bVal = new Date(b.createdAt || 0).getTime();
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
                <Users className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Users & Customers
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage system operators, fleet company accounts, and EV driver memberships.
            </p>
          </div>
          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link href="/users/create">
              <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20">
                <Plus className="size-4 mr-1.5" /> Add User
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {sortedUsers.length} Registered Accounts
          </Badge>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">User / Contact <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('user_type')}>
                  <div className="flex items-center gap-1.5">Account Type <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('role')}>
                  <div className="flex items-center gap-1.5">Role <ArrowUpDown className="size-3" /></div>
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
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading user directory...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Users className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No Users Found</p>
                      <p className="text-xs text-muted-foreground">Add a new user to grant access.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((u) => (
                  <TableRow key={u.user_id || u.id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-gradient-to-br from-[#54a8c7]/20 to-[#3f78e0]/20 border border-[#54a8c7]/30 flex items-center justify-center text-xs font-bold text-[#54a8c7]">
                          {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">
                            {u.name || u.email?.split('@')[0]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getUserTypeIcon(u.user_type)}
                        <span className="text-xs font-semibold capitalize text-foreground">
                          {u.user_type || 'Private'}
                        </span>
                        {u.company_name && (
                          <span className="text-xs text-muted-foreground">({u.company_name})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' || u.role === 'superadmin' ? 'soft-danger' : 'soft-primary'}
                        className="text-[10px] font-bold uppercase tracking-wider py-0.5"
                      >
                        {u.role || 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {u.createdAt ? format(new Date(u.createdAt), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/users/${u.user_id || u.id}/edit`}>
                          <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                            <Edit className="size-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(u.user_id || u.id)}
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
