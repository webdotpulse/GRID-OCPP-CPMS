"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Edit,
  Building,
  User as UserIcon,
  Briefcase,
  Search,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  MapPin,
  FileText,
  Zap,
  Info,
  Check,
  X,
  CreditCard,
  Building2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CompanyItem {
  id: number;
  name: string;
  clientNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxNumber?: string;
  kvkNumber?: string;
  billingEmail?: string;
  status: string;
  notes?: string;
  usersCount: number;
  stationsCount: number;
  invoicesCount: number;
  chargersCount: number;
  activeChargersCount: number;
  recentUsers?: Array<{ id: number; name?: string; email: string; role: string }>;
  createdAt?: string;
}

interface UserItem {
  id: number;
  name?: string;
  email: string;
  role: string;
  userType?: string;
  companyName?: string;
  company_name?: string;
  companyId?: number;
  company?: {
    id: number;
    name: string;
    clientNumber?: string;
    status?: string;
  };
  phone?: string;
  address?: string;
  taxNumber?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  rfidCardsCount?: number;
  stationsCount?: number;
  createdAt?: string;
}

interface RoleCapability {
  key: string;
  name: string;
  category: string;
  description: string;
  allowedRoles: string[];
}

interface RoleItem {
  role: string;
  name: string;
  badgeColor: string;
  level: number;
  scope: string;
  description: string;
  isSystem: boolean;
  userCount?: number;
  capabilities?: string[];
}

export default function UsersAdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("users");

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");

  // Clients State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(true);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("all");

  // Roles State
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [capabilities, setCapabilities] = useState<RoleCapability[]>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(true);

  // Modals and Drawers
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserItem | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState("");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserItem | null>(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<CompanyItem | null>(null);

  // Client Create/Edit Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CompanyItem | null>(null);
  const [clientFormData, setClientFormData] = useState({
    name: "",
    clientNumber: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "Netherlands",
    taxNumber: "",
    kvkNumber: "",
    billingEmail: "",
    status: "active",
    notes: "",
  });
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setIsUsersLoading(true);
      const params: any = {};
      if (userSearchQuery) params.search = userSearchQuery;
      if (roleFilter !== "all") params.role = roleFilter;
      if (clientFilter !== "all") params.companyId = clientFilter;
      if (userTypeFilter !== "all") params.userType = userTypeFilter;

      const res = await api.get("/users", { params });
      const userList = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.data || []);
      setUsers(Array.isArray(userList) ? userList : []);
    } catch (error) {
      toast.error("Failed to fetch user directory");
    } finally {
      setIsUsersLoading(false);
    }
  }, [userSearchQuery, roleFilter, clientFilter, userTypeFilter]);

  // Fetch Companies / Clients
  const fetchCompanies = useCallback(async () => {
    try {
      setIsCompaniesLoading(true);
      const params: any = {};
      if (clientSearchQuery) params.search = clientSearchQuery;
      if (clientStatusFilter !== "all") params.status = clientStatusFilter;

      const res = await api.get("/companies", { params });
      const compList = Array.isArray(res.data) ? res.data : (res.data?.companies || res.data?.data || []);
      setCompanies(Array.isArray(compList) ? compList : []);
    } catch (error) {
      toast.error("Failed to fetch clients");
    } finally {
      setIsCompaniesLoading(false);
    }
  }, [clientSearchQuery, clientStatusFilter]);

  // Fetch Roles & Capabilities
  const fetchRoles = useCallback(async () => {
    try {
      setIsRolesLoading(true);
      const res = await api.get("/roles");
      const rolesData = res.data?.roles ? res.data : (res.data?.data || {});
      setRoles(rolesData.roles || []);
      setCapabilities(rolesData.capabilities || []);
    } catch (error) {
      // Fallback if roles endpoint fails
    } finally {
      setIsRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Delete User
  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user account?")) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success("User deleted successfully");
      fetchUsers();
      fetchRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete user");
    }
  };

  // Change User Role
  const handleSaveRoleChange = async () => {
    if (!selectedUserForRole || !newRoleSelection) return;
    try {
      setIsUpdatingRole(true);
      await api.put(`/users/${selectedUserForRole.id}/role`, { role: newRoleSelection });
      toast.success(`Role updated to ${newRoleSelection}`);
      setSelectedUserForRole(null);
      fetchUsers();
      fetchRoles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update role");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Admin Reset User Password
  const handleSavePasswordReset = async () => {
    if (!selectedUserForPassword || !newPasswordInput) return;
    if (newPasswordInput.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    try {
      setIsResettingPassword(true);
      await api.post(`/users/${selectedUserForPassword.id}/reset-password`, {
        newPassword: newPasswordInput,
      });
      toast.success("Password reset successfully");
      setSelectedUserForPassword(null);
      setNewPasswordInput("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Open Create/Edit Client Modal
  const openCreateClientModal = () => {
    setEditingClient(null);
    setClientFormData({
      name: "",
      clientNumber: `CLI-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Netherlands",
      taxNumber: "",
      kvkNumber: "",
      billingEmail: "",
      status: "active",
      notes: "",
    });
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client: CompanyItem) => {
    setEditingClient(client);
    setClientFormData({
      name: client.name || "",
      clientNumber: client.clientNumber || "",
      contactName: client.contactName || "",
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      address: client.address || "",
      city: client.city || "",
      postalCode: client.postalCode || "",
      country: client.country || "Netherlands",
      taxNumber: client.taxNumber || "",
      kvkNumber: client.kvkNumber || "",
      billingEmail: client.billingEmail || "",
      status: client.status || "active",
      notes: client.notes || "",
    });
    setIsClientModalOpen(true);
  };

  // Save Client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormData.name) {
      return toast.error("Company name is required");
    }

    try {
      setIsSavingClient(true);
      if (editingClient) {
        await api.put(`/companies/${editingClient.id}`, clientFormData);
        toast.success("Client account updated successfully");
      } else {
        await api.post("/companies", clientFormData);
        toast.success("Corporate client created successfully");
      }
      setIsClientModalOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save client account");
    } finally {
      setIsSavingClient(false);
    }
  };

  // Delete Client
  const handleDeleteClient = async (id: number) => {
    if (!confirm("Are you sure you want to remove or archive this client account?")) return;
    try {
      await api.delete(`/companies/${id}`);
      toast.success("Client account removed or deactivated");
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete client");
    }
  };

  // Role Badge Helper
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return (
          <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 font-semibold px-2 py-0.5 text-[11px] gap-1">
            <ShieldAlert className="size-3" /> Superadmin
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold px-2 py-0.5 text-[11px] gap-1">
            <ShieldCheck className="size-3" /> Admin
          </Badge>
        );
      case "operator":
        return (
          <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold px-2 py-0.5 text-[11px] gap-1">
            <Zap className="size-3" /> Operator
          </Badge>
        );
      case "client_admin":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold px-2 py-0.5 text-[11px] gap-1">
            <Building2 className="size-3" /> Client Admin
          </Badge>
        );
      case "user":
      default:
        return (
          <Badge className="bg-[#54a8c7]/15 text-[#54a8c7] border border-[#54a8c7]/30 font-semibold px-2 py-0.5 text-[11px] gap-1">
            <UserIcon className="size-3" /> EV Driver
          </Badge>
        );
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            Active
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
            Pending
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
            Suspended
          </Badge>
        );
      case "inactive":
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            Inactive
          </Badge>
        );
    }
  };

  // Authorization Check
  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-80 gap-3 text-center">
          <div className="size-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
            <Shield className="size-8" />
          </div>
          <p className="text-lg font-bold text-foreground">Administrator Privileges Required</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Only system administrators and CPO operators have access to user accounts, client organizations, and role permissions.
          </p>
        </div>
      </AppShell>
    );
  }

  // Summary Metrics
  const totalUsersCount = users.length;
  const totalClientsCount = companies.length;
  const totalDriversCount = users.filter((u) => u.role === "user").length;
  const totalAdminsCount = users.filter((u) => u.role === "admin" || u.role === "superadmin" || u.role === "operator").length;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] text-white flex items-center justify-center shadow-lg shadow-[#54a8c7]/20">
                <Users className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                  Users, Clients & Roles
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Centralized enterprise administration for individual logins, corporate clients, and access control.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "users" && (
              <Link href="/users/create">
                <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/20 font-semibold gap-2">
                  <Plus className="size-4" /> Add User
                </Button>
              </Link>
            )}
            {activeTab === "clients" && (
              <Button
                onClick={openCreateClientModal}
                className="rounded-xl bg-[#3f78e0] hover:bg-[#3f78e0]/90 text-white shadow-md shadow-[#3f78e0]/20 font-semibold gap-2"
              >
                <Plus className="size-4" /> Add Corporate Client
              </Button>
            )}
          </div>
        </div>

        {/* Quick KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center shrink-0">
                <Users className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Users</p>
                <p className="text-2xl font-black text-foreground">{totalUsersCount}</p>
                <p className="text-[11px] text-muted-foreground">Registered login accounts</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center shrink-0">
                <Building2 className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corporate Clients</p>
                <p className="text-2xl font-black text-foreground">{totalClientsCount}</p>
                <p className="text-[11px] text-muted-foreground">B2B organizations & fleets</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center shrink-0">
                <UserIcon className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">EV Drivers</p>
                <p className="text-2xl font-black text-foreground">{totalDriversCount}</p>
                <p className="text-[11px] text-muted-foreground">Active charging motorists</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admins & Operators</p>
                <p className="text-2xl font-black text-foreground">{totalAdminsCount}</p>
                <p className="text-[11px] text-muted-foreground">System managers & techs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Structural Distinction Callout Banner: Clients vs. Users */}
        <div className="rounded-2xl border border-[#3f78e0]/30 bg-gradient-to-r from-[#3f78e0]/10 via-[#54a8c7]/5 to-transparent p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-9 rounded-xl bg-[#3f78e0] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Info className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  Understanding Entity Scopes: <span className="text-[#3f78e0]">Clients</span> vs.{" "}
                  <span className="text-[#54a8c7]">Users</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2 bg-card/80 p-2.5 rounded-xl border border-border/50">
                    <Building2 className="size-4 text-[#3f78e0] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Clients (Corporate Accounts):</strong> Legal business
                      entities, corporate fleets, and billing accounts with VAT/KvK, billing address, assigned stations &
                      chargers, and multiple linked employee users.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-card/80 p-2.5 rounded-xl border border-border/50">
                    <UserIcon className="size-4 text-[#54a8c7] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Users (Individual Logins):</strong> Human accounts with
                      email/password credentials, 2FA, system roles (Superadmin, Admin, Operator, Driver), personal RFID
                      cards, and vehicle profiles.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabbed Navigation Hub */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/80 p-1 rounded-2xl border border-border/70 h-auto grid grid-cols-3 max-w-xl">
            <TabsTrigger
              value="users"
              className="rounded-xl py-2.5 data-[state=active]:bg-[#54a8c7] data-[state=active]:text-white font-semibold text-xs sm:text-sm flex items-center gap-2"
            >
              <Users className="size-4" /> Users Directory
            </TabsTrigger>
            <TabsTrigger
              value="clients"
              className="rounded-xl py-2.5 data-[state=active]:bg-[#3f78e0] data-[state=active]:text-white font-semibold text-xs sm:text-sm flex items-center gap-2"
            >
              <Building2 className="size-4" /> Clients & Accounts
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              className="rounded-xl py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold text-xs sm:text-sm flex items-center gap-2"
            >
              <ShieldCheck className="size-4" /> Roles & Permissions
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: USERS DIRECTORY */}
          {/* ========================================================================= */}
          <TabsContent value="users" className="space-y-4 m-0">
            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/40 border-border/60 rounded-xl"
                />
              </div>

              <div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 bg-muted/40 border-border/60 rounded-xl text-xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                    <SelectItem value="admin">Platform Admin</SelectItem>
                    <SelectItem value="operator">Operator / Tech</SelectItem>
                    <SelectItem value="client_admin">Client Admin</SelectItem>
                    <SelectItem value="user">EV Driver / User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-10 bg-muted/40 border-border/60 rounded-xl text-xs">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger className="h-10 bg-muted/40 border-border/60 rounded-xl text-xs">
                    <SelectValue placeholder="All Account Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Account Types</SelectItem>
                    <SelectItem value="private">Private Driver</SelectItem>
                    <SelectItem value="employee">Corporate Employee</SelectItem>
                    <SelectItem value="company">Company Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>User / Identity</TableHead>
                    <TableHead>Client / Company</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Security & 2FA</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isUsersLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Loading users directory...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Users className="size-8 text-muted-foreground/50" />
                          <p className="font-semibold text-foreground text-sm">No Users Found</p>
                          <p className="text-xs text-muted-foreground">Adjust filters or create a new user account.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-[#54a8c7]/5 transition-colors">
                        <TableCell className="font-medium">
                          <Link href={`/users/${u.id}`} className="group flex items-center gap-3 hover:opacity-90 transition-opacity">
                            <div className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7]/20 to-[#3f78e0]/20 border border-[#54a8c7]/30 flex items-center justify-center text-xs font-black text-[#54a8c7] shrink-0 group-hover:scale-105 transition-transform">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground flex items-center gap-1.5 group-hover:text-[#54a8c7] transition-colors">
                                {u.name || u.email?.split("@")[0]}
                                {u.id === currentUser?.id && (
                                  <span className="text-[10px] text-[#54a8c7] font-semibold bg-[#54a8c7]/10 px-1.5 py-0.2 rounded-md">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </Link>
                        </TableCell>

                        <TableCell>
                          {u.company ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="size-3.5 text-[#3f78e0] shrink-0" />
                              <div>
                                <div className="text-xs font-semibold text-foreground">{u.company.name}</div>
                                {u.company.clientNumber && (
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {u.company.clientNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : u.company_name ? (
                            <span className="text-xs text-muted-foreground">{u.company_name}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">None (Private)</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="text-xs font-medium capitalize text-foreground">
                            {u.userType === "employee"
                              ? "Fleet Driver"
                              : u.userType === "company"
                              ? "Company Account"
                              : "Private User"}
                          </span>
                        </TableCell>

                        <TableCell>{getRoleBadge(u.role)}</TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {u.twoFactorEnabled ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0.5 gap-1">
                                <Lock className="size-2.5" /> 2FA Active
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">2FA Off</span>
                            )}
                            {u.emailVerified && (
                              <span title="Email Verified">
                                <CheckCircle2 className="size-3.5 text-emerald-400" />
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border border-border/70 shadow-lg">
                              <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase">
                                Manage Account
                              </DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/users/${u.id}`} className="flex items-center gap-2 cursor-pointer">
                                  <UserIcon className="size-3.5 text-[#54a8c7]" /> View Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/users/${u.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                                  <Edit className="size-3.5 text-foreground" /> Edit Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserForRole(u);
                                  setNewRoleSelection(u.role);
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Shield className="size-3.5 text-purple-400" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserForPassword(u);
                                  setNewPasswordInput("");
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <KeyRound className="size-3.5 text-amber-400" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSelectedUserForDetails(u)}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Info className="size-3.5 text-[#54a8c7]" /> View Summary
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(u.id)}
                                className="flex items-center gap-2 text-rose-500 focus:text-rose-500 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" /> Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: CLIENTS & ORGANIZATIONS (B2B ACCOUNTS) */}
          {/* ========================================================================= */}
          <TabsContent value="clients" className="space-y-4 m-0">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name, code, contact or city..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/40 border-border/60 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                  <SelectTrigger className="h-10 bg-muted/40 border-border/60 rounded-xl text-xs min-w-[140px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="outline" className="text-xs font-semibold px-3 py-1 shrink-0">
                  {companies.length} Corporate Accounts
                </Badge>
              </div>
            </div>

            {/* Clients Table */}
            <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Client Code & Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Registration & Tax</TableHead>
                    <TableHead>Assigned Fleets & EVSEs</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isCompaniesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="size-6 border-2 border-[#3f78e0] border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Loading corporate clients...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Building2 className="size-8 text-muted-foreground/50" />
                          <p className="font-semibold text-foreground text-sm">No Corporate Clients Found</p>
                          <p className="text-xs text-muted-foreground">
                            Add a corporate client account to assign charging fleets.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    companies.map((c) => (
                      <TableRow key={c.id} className="hover:bg-[#3f78e0]/5 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-gradient-to-br from-[#3f78e0]/20 to-[#54a8c7]/20 border border-[#3f78e0]/30 flex items-center justify-center text-xs font-black text-[#3f78e0] shrink-0">
                              <Building2 className="size-5" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                {c.name}
                              </div>
                              <div className="text-[11px] font-mono font-semibold text-[#3f78e0]">
                                {c.clientNumber || `CLI-${c.id.toString().padStart(4, "0")}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>{getStatusBadge(c.status)}</TableCell>

                        <TableCell>
                          {c.contactName || c.contactEmail ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-foreground">{c.contactName || "—"}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Mail className="size-3" /> {c.contactEmail || "No email"}
                              </div>
                              {c.contactPhone && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="size-3" /> {c.contactPhone}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic">No contact specified</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            {c.taxNumber && (
                              <div className="text-foreground">
                                <span className="text-muted-foreground">VAT: </span>
                                <span className="font-mono font-medium">{c.taxNumber}</span>
                              </div>
                            )}
                            {c.kvkNumber && (
                              <div className="text-muted-foreground">
                                <span>KvK: </span>
                                <span className="font-mono">{c.kvkNumber}</span>
                              </div>
                            )}
                            {!c.taxNumber && !c.kvkNumber && (
                              <span className="text-xs text-muted-foreground/60 italic">—</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="bg-[#54a8c7]/10 text-[#54a8c7] border-[#54a8c7]/20 text-[10px] font-semibold py-0.5 gap-1">
                              <Users className="size-2.5" /> {c.usersCount} Drivers
                            </Badge>
                            <Badge variant="outline" className="bg-[#3f78e0]/10 text-[#3f78e0] border-[#3f78e0]/20 text-[10px] font-semibold py-0.5 gap-1">
                              <Zap className="size-2.5" /> {c.chargersCount} Chargers
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                            <span>{c.city || c.country || "—"}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSelectedClientForDetails(c)}
                              title="View Client Profile"
                              className="rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Info className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditClientModal(c)}
                              title="Edit Client"
                              className="rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteClient(c.id)}
                              title="Delete Client"
                              className="rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: ROLES & PERMISSIONS MATRIX */}
          {/* ========================================================================= */}
          <TabsContent value="roles" className="space-y-6 m-0">
            {/* Roles Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {roles.map((r) => (
                <Card key={r.role} className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    {getRoleBadge(r.role)}
                    <span className="text-xs font-bold text-muted-foreground">
                      {r.userCount || 0} {r.userCount === 1 ? "user" : "users"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-foreground">{r.name}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Scope: <strong className="text-foreground">{r.scope}</strong></span>
                    <span>Level: {r.level}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Permissions Matrix */}
            <Card className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="text-base font-heading font-bold flex items-center gap-2">
                  <Shield className="size-5 text-purple-400" />
                  Role Capabilities & Permission Matrix
                </CardTitle>
                <CardDescription className="text-xs">
                  Granular system capabilities and functional access matrix across all CPMS modules.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[300px]">Module Capability</TableHead>
                      <TableHead className="w-[120px]">Category</TableHead>
                      <TableHead className="text-center">Superadmin</TableHead>
                      <TableHead className="text-center">Admin</TableHead>
                      <TableHead className="text-center">Operator</TableHead>
                      <TableHead className="text-center">Client Admin</TableHead>
                      <TableHead className="text-center">EV Driver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capabilities.map((cap) => (
                      <TableRow key={cap.key} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs text-foreground">{cap.name}</div>
                            <div className="text-[11px] text-muted-foreground">{cap.description}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-semibold py-0.5">
                            {cap.category}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">
                          {cap.allowedRoles.includes("superadmin") ? (
                            <div className="inline-flex size-6 rounded-full bg-purple-500/15 text-purple-400 items-center justify-center">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="inline-flex size-6 rounded-full bg-muted/40 text-muted-foreground/40 items-center justify-center">
                              <X className="size-3.5" />
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {cap.allowedRoles.includes("admin") ? (
                            <div className="inline-flex size-6 rounded-full bg-rose-500/15 text-rose-400 items-center justify-center">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="inline-flex size-6 rounded-full bg-muted/40 text-muted-foreground/40 items-center justify-center">
                              <X className="size-3.5" />
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {cap.allowedRoles.includes("operator") ? (
                            <div className="inline-flex size-6 rounded-full bg-blue-500/15 text-blue-400 items-center justify-center">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="inline-flex size-6 rounded-full bg-muted/40 text-muted-foreground/40 items-center justify-center">
                              <X className="size-3.5" />
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {cap.allowedRoles.includes("client_admin") ? (
                            <div className="inline-flex size-6 rounded-full bg-emerald-500/15 text-emerald-400 items-center justify-center">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="inline-flex size-6 rounded-full bg-muted/40 text-muted-foreground/40 items-center justify-center">
                              <X className="size-3.5" />
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {cap.allowedRoles.includes("user") ? (
                            <div className="inline-flex size-6 rounded-full bg-[#54a8c7]/15 text-[#54a8c7] items-center justify-center">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="inline-flex size-6 rounded-full bg-muted/40 text-muted-foreground/40 items-center justify-center">
                              <X className="size-3.5" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ========================================================================= */}
        {/* MODAL: CHANGE USER ROLE */}
        {/* ========================================================================= */}
        <Dialog open={!!selectedUserForRole} onOpenChange={(open) => !open && setSelectedUserForRole(null)}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="size-5 text-purple-400" /> Change User Role
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update access tier for <strong>{selectedUserForRole?.email}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Role</Label>
                <Select value={newRoleSelection} onValueChange={setNewRoleSelection}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select system role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Administrator (Global)</SelectItem>
                    <SelectItem value="admin">Platform / CPO Admin</SelectItem>
                    <SelectItem value="operator">Operations & Field Technician</SelectItem>
                    <SelectItem value="client_admin">Corporate Client / Fleet Admin</SelectItem>
                    <SelectItem value="user">EV Driver / Standard User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Role Scope Notice:</p>
                <p>
                  Changing this role will immediately update the user's navigational privileges, remote command
                  authorizations, and API tenant boundaries.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUserForRole(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleSaveRoleChange}
                disabled={isUpdatingRole}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {isUpdatingRole ? "Updating..." : "Save Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: ADMIN RESET PASSWORD */}
        {/* ========================================================================= */}
        <Dialog open={!!selectedUserForPassword} onOpenChange={(open) => !open && setSelectedUserForPassword(null)}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-amber-400" /> Reset Password
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set a temporary or new password for <strong>{selectedUserForPassword?.email}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">New Password</Label>
                <Input
                  type="password"
                  placeholder="Enter at least 6 characters..."
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-300/90 space-y-1">
                <p className="font-semibold">Security Confirmation:</p>
                <p>
                  The user will be required to authenticate using this new password upon their next session login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUserForPassword(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleSavePasswordReset}
                disabled={isResettingPassword || !newPasswordInput}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                {isResettingPassword ? "Resetting..." : "Confirm Reset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* MODAL: CREATE / EDIT CORPORATE CLIENT */}
        {/* ========================================================================= */}
        <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
          <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveClient}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-[#3f78e0]" />
                  {editingClient ? "Edit Corporate Client" : "Create Corporate Client"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Configure corporate billing entity, contact parameters, and organizational settings.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Company Name *</Label>
                    <Input
                      placeholder="e.g. Amsterdam Fleet Logistics BV"
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                      required
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client Number / Code</Label>
                    <Input
                      placeholder="e.g. CLI-1001"
                      value={clientFormData.clientNumber}
                      onChange={(e) => setClientFormData({ ...clientFormData, clientNumber: e.target.value })}
                      className="h-9.5 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contact Person</Label>
                    <Input
                      placeholder="e.g. Jan de Vries"
                      value={clientFormData.contactName}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactName: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contact Email</Label>
                    <Input
                      type="email"
                      placeholder="jan@fleet.nl"
                      value={clientFormData.contactEmail}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactEmail: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contact Phone</Label>
                    <Input
                      placeholder="+31 20 123 4567"
                      value={clientFormData.contactPhone}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactPhone: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">VAT / Tax Number</Label>
                    <Input
                      placeholder="e.g. NL123456789B01"
                      value={clientFormData.taxNumber}
                      onChange={(e) => setClientFormData({ ...clientFormData, taxNumber: e.target.value })}
                      className="h-9.5 rounded-xl font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Chamber of Commerce (KvK)</Label>
                    <Input
                      placeholder="e.g. 87654321"
                      value={clientFormData.kvkNumber}
                      onChange={(e) => setClientFormData({ ...clientFormData, kvkNumber: e.target.value })}
                      className="h-9.5 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold">Street Address</Label>
                    <Input
                      placeholder="Keizersgracht 100"
                      value={clientFormData.address}
                      onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Postal Code</Label>
                    <Input
                      placeholder="1015 AA"
                      value={clientFormData.postalCode}
                      onChange={(e) => setClientFormData({ ...clientFormData, postalCode: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">City</Label>
                    <Input
                      placeholder="Amsterdam"
                      value={clientFormData.city}
                      onChange={(e) => setClientFormData({ ...clientFormData, city: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Country</Label>
                    <Input
                      placeholder="Netherlands"
                      value={clientFormData.country}
                      onChange={(e) => setClientFormData({ ...clientFormData, country: e.target.value })}
                      className="h-9.5 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Account Status</Label>
                    <Select
                      value={clientFormData.status}
                      onValueChange={(val) => setClientFormData({ ...clientFormData, status: val })}
                    >
                      <SelectTrigger className="h-9.5 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Invoicing / Billing Email</Label>
                  <Input
                    type="email"
                    placeholder="billing@fleet.nl"
                    value={clientFormData.billingEmail}
                    onChange={(e) => setClientFormData({ ...clientFormData, billingEmail: e.target.value })}
                    className="h-9.5 rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsClientModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingClient}
                  className="rounded-xl bg-[#3f78e0] hover:bg-[#3f78e0]/90 text-white font-semibold"
                >
                  {isSavingClient ? "Saving..." : editingClient ? "Update Client" : "Create Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* DRAWER: USER SUMMARY DETAILS */}
        {/* ========================================================================= */}
        <Sheet open={!!selectedUserForDetails} onOpenChange={(open) => !open && setSelectedUserForDetails(null)}>
          <SheetContent className="rounded-l-2xl sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <UserIcon className="size-5 text-[#54a8c7]" /> User Account Summary
              </SheetTitle>
              <SheetDescription className="text-xs">
                Detailed profile parameters and active credentials.
              </SheetDescription>
            </SheetHeader>

            {selectedUserForDetails && (
              <div className="space-y-5 py-5 text-xs">
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-2xl border border-border/60">
                  <div className="size-12 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] text-white font-black text-lg flex items-center justify-center">
                    {(selectedUserForDetails.name || selectedUserForDetails.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {selectedUserForDetails.name || "Unnamed User"}
                    </h4>
                    <p className="text-muted-foreground">{selectedUserForDetails.email}</p>
                    <div className="pt-1">{getRoleBadge(selectedUserForDetails.role)}</div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-4">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[10px]">Client Association</h5>
                  <div className="p-3 bg-card rounded-xl border border-border/50 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Corporate Client:</span>
                      <strong className="text-foreground">
                        {selectedUserForDetails.company?.name || selectedUserForDetails.company_name || "None (Private)"}
                      </strong>
                    </div>
                    {selectedUserForDetails.company?.clientNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client Code:</span>
                        <span className="font-mono text-[#3f78e0] font-semibold">
                          {selectedUserForDetails.company.clientNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-4">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[10px]">Security & Identity</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-card rounded-xl border border-border/50">
                      <span className="text-muted-foreground block text-[10px]">Email Verification</span>
                      <span className="font-semibold text-foreground">
                        {selectedUserForDetails.emailVerified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-card rounded-xl border border-border/50">
                      <span className="text-muted-foreground block text-[10px]">2FA TOTP</span>
                      <span className="font-semibold text-foreground">
                        {selectedUserForDetails.twoFactorEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Link href={`/users/${selectedUserForDetails.id}`}>
                    <Button variant="outline" className="rounded-xl gap-1.5 font-semibold text-xs border-border/80">
                      <UserIcon className="size-3.5 text-[#54a8c7]" /> View Full Profile
                    </Button>
                  </Link>
                  <Link href={`/users/${selectedUserForDetails.id}/edit`}>
                    <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white gap-1.5 font-semibold text-xs">
                      <Edit className="size-3.5" /> Full Edit
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* ========================================================================= */}
        {/* DRAWER: CLIENT SUMMARY DETAILS */}
        {/* ========================================================================= */}
        <Sheet open={!!selectedClientForDetails} onOpenChange={(open) => !open && setSelectedClientForDetails(null)}>
          <SheetContent className="rounded-l-2xl sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-[#3f78e0]" /> Client Organization Profile
              </SheetTitle>
              <SheetDescription className="text-xs">
                Corporate fleet parameters, assigned stations, and linked employees.
              </SheetDescription>
            </SheetHeader>

            {selectedClientForDetails && (
              <div className="space-y-5 py-5 text-xs overflow-y-auto max-h-[85vh]">
                <div className="p-4 bg-muted/40 rounded-2xl border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-foreground">{selectedClientForDetails.name}</h3>
                    {getStatusBadge(selectedClientForDetails.status)}
                  </div>
                  <p className="font-mono text-xs text-[#3f78e0] font-bold">
                    {selectedClientForDetails.clientNumber}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-card rounded-xl border border-border/50 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Linked Drivers</span>
                    <p className="text-xl font-black text-foreground">{selectedClientForDetails.usersCount}</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border/50 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Assigned Chargers</span>
                    <p className="text-xl font-black text-foreground">{selectedClientForDetails.chargersCount}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-4">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[10px]">Contact & Location</h5>
                  <div className="p-3 bg-card rounded-xl border border-border/50 space-y-1.5">
                    {selectedClientForDetails.contactName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact Person:</span>
                        <strong className="text-foreground">{selectedClientForDetails.contactName}</strong>
                      </div>
                    )}
                    {selectedClientForDetails.contactEmail && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="text-foreground">{selectedClientForDetails.contactEmail}</span>
                      </div>
                    )}
                    {selectedClientForDetails.contactPhone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="text-foreground">{selectedClientForDetails.contactPhone}</span>
                      </div>
                    )}
                    {selectedClientForDetails.address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="text-foreground">
                          {selectedClientForDetails.address}, {selectedClientForDetails.city}{" "}
                          {selectedClientForDetails.postalCode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/60 pt-4">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[10px]">Business Registration</h5>
                  <div className="p-3 bg-card rounded-xl border border-border/50 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">VAT / Tax ID:</span>
                      <span className="text-foreground">{selectedClientForDetails.taxNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">KvK Number:</span>
                      <span className="text-foreground">{selectedClientForDetails.kvkNumber || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      const c = selectedClientForDetails;
                      setSelectedClientForDetails(null);
                      openEditClientModal(c);
                    }}
                    className="rounded-xl bg-[#3f78e0] hover:bg-[#3f78e0]/90 text-white gap-1.5 font-semibold text-xs"
                  >
                    <Edit className="size-3.5" /> Edit Client
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
