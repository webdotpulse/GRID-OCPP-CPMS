'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Key,
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Search,
  Filter,
  Layers,
  Lock,
  Zap,
  Globe,
  Settings,
  Check,
  X,
  FileCode,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface Capability {
  key: string;
  name: string;
  category: string;
  description: string;
  allowedRoles: string[];
}

interface RoleItem {
  id?: number;
  role: string;
  name: string;
  slug?: string;
  description: string;
  badgeColor: string;
  level: number;
  scope: string;
  isSystem: boolean;
  isCustom?: boolean;
  companyId?: number | null;
  companyName?: string | null;
  userCount: number;
  capabilities: string[];
  permissions?: string[];
  siteScopes?: number[];
}

export default function RolesManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Role Edit/Create Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleColor, setRoleColor] = useState('#3f78e0');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedSiteScopes, setSelectedSiteScopes] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Assign Role Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignRoleSlug, setAssignRoleSlug] = useState('');
  const [assignCustomRoleId, setAssignCustomRoleId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchRolesData = async () => {
    try {
      setLoading(true);
      const [rolesRes, stationsRes, usersRes] = await Promise.all([
        api.get('/roles'),
        api.get('/stations'),
        api.get('/users?limit=100'),
      ]);

      const data = rolesRes.data?.data || rolesRes.data;
      if (data) {
        setRoles(data.roles || []);
        setCapabilities(data.capabilities || []);
      }

      const stationsList = Array.isArray(stationsRes.data)
        ? stationsRes.data
        : stationsRes.data?.data || [];
      setStations(stationsList);

      const uList = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data?.data || usersRes.data?.users || [];
      setUsersList(uList);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchRolesData();
    }
  }, [authLoading, user]);

  const categories = Array.from(new Set(capabilities.map((c) => c.category)));

  const handleOpenCreateModal = () => {
    setEditingRoleId(null);
    setRoleName('');
    setRoleSlug('');
    setRoleDescription('');
    setRoleColor('#3f78e0');
    setSelectedPermissions([]);
    setSelectedSiteScopes([]);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditModal = (role: RoleItem) => {
    if (role.isSystem) {
      toast.error('System roles are immutable. You can create a custom role based on its capabilities.');
      return;
    }
    setEditingRoleId(role.id || null);
    setRoleName(role.name);
    setRoleSlug(role.slug || role.role);
    setRoleDescription(role.description || '');
    setRoleColor(role.badgeColor || '#3f78e0');
    setSelectedPermissions(role.permissions || role.capabilities || []);
    setSelectedSiteScopes(role.siteScopes || []);
    setIsRoleModalOpen(true);
  };

  const handleTogglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleCategoryAll = (category: string) => {
    const categoryKeys = capabilities.filter((c) => c.category === category).map((c) => c.key);
    const allSelected = categoryKeys.every((k) => selectedPermissions.includes(k));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !categoryKeys.includes(k)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...categoryKeys])));
    }
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: roleName.trim(),
        slug: roleSlug.trim() || undefined,
        description: roleDescription.trim(),
        color: roleColor,
        permissions: selectedPermissions,
        siteScopes: selectedSiteScopes,
      };

      if (editingRoleId) {
        await api.put(`/roles/${editingRoleId}`, payload);
        toast.success(`Custom role "${roleName}" updated successfully`);
      } else {
        await api.post('/roles', payload);
        toast.success(`Custom role "${roleName}" created successfully`);
      }

      setIsRoleModalOpen(false);
      fetchRolesData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    if (!role.id || role.isSystem) return;
    if (!confirm(`Are you sure you want to delete custom role "${role.name}"?`)) return;

    try {
      await api.delete(`/roles/${role.id}`);
      toast.success(`Role "${role.name}" deleted successfully`);
      fetchRolesData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete role');
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    try {
      setAssigning(true);
      const payload: any = { userId: parseInt(selectedUserId, 10) };
      if (assignCustomRoleId) {
        payload.customRoleId = parseInt(assignCustomRoleId, 10);
      } else if (assignRoleSlug) {
        payload.role = assignRoleSlug;
      } else {
        toast.error('Please select a target role');
        return;
      }

      await api.post('/roles/assign', payload);
      toast.success('Role assigned successfully to user');
      setIsAssignModalOpen(false);
      fetchRolesData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to assign role');
    } finally {
      setAssigning(false);
    }
  };

  const filteredRoles = roles.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalUsers = roles.reduce((sum, r) => sum + (r.userCount || 0), 0);
  const customRoleCount = roles.filter((r) => r.isCustom).length;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header Breadcrumbs & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link href="/settings" className="hover:text-foreground transition-colors">
                Settings
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-foreground font-medium">Fine-Grained PBAC & Roles</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ShieldCheck className="size-6 text-[#8b5cf6]" />
              Roles & Policy-Based Access Control (PBAC)
            </h1>
            <p className="text-sm text-muted-foreground">
              Define granular permissions, configure custom operational roles, and enforce site-level isolation.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(true)}
              className="gap-2 border-border/60 hover:bg-muted/50"
            >
              <Users className="size-4 text-[#3f78e0]" />
              Assign User Role
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="gap-2 bg-gradient-to-r from-[#8b5cf6] to-[#3f78e0] text-white hover:opacity-90 shadow-md shadow-[#8b5cf6]/20"
            >
              <Plus className="size-4" />
              Create Custom Role
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#8b5cf6]/15 flex items-center justify-center text-[#8b5cf6]">
                <Shield className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Access Roles</p>
                <p className="text-xl font-bold text-foreground">{roles.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#3f78e0]/15 flex items-center justify-center text-[#3f78e0]">
                <Layers className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Custom PBAC Policies</p>
                <p className="text-xl font-bold text-foreground">{customRoleCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#45c4a0]/15 flex items-center justify-center text-[#45c4a0]">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Assigned Users</p>
                <p className="text-xl font-bold text-foreground">{totalUsers}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#fab758]/15 flex items-center justify-center text-[#fab758]">
                <Key className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">System Capabilities</p>
                <p className="text-xl font-bold text-foreground">{capabilities.length} Actions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search roles or capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card/60 border-border/40"
            />
          </div>
        </div>

        {/* Roles List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-[#8b5cf6]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoles.map((role) => (
              <Card
                key={role.role || role.id}
                className="bg-card/60 backdrop-blur border-border/40 hover:border-border/80 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-3.5 rounded-full"
                        style={{ backgroundColor: role.badgeColor || '#3f78e0' }}
                      />
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          {role.name}
                          {role.isSystem ? (
                            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                              System
                            </Badge>
                          ) : (
                            <Badge className="bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/30 text-[10px] uppercase font-semibold">
                              Custom PBAC
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                          slug: {role.slug || role.role} • Scope: {role.scope}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-xs bg-muted/30">
                      {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-4">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {role.description || 'No description provided.'}
                  </p>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Permissions ({role.capabilities?.length || 0})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {(role.capabilities || []).map((capKey) => {
                        const cap = capabilities.find((c) => c.key === capKey);
                        return (
                          <span
                            key={capKey}
                            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-foreground/80 border border-border/40"
                            title={cap?.description || capKey}
                          >
                            {cap?.name || capKey}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  {!role.isSystem && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(role)}
                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="size-3.5" />
                        Edit Policy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRole(role)}
                        className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create / Edit Custom Role Modal */}
        <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#8b5cf6]" />
                {editingRoleId ? 'Edit Custom PBAC Role' : 'Create Custom Access Role'}
              </DialogTitle>
              <DialogDescription>
                Configure fine-grained action permissions and optional site location scopes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Role Name *</Label>
                  <Input
                    placeholder="e.g. Site Operations Technician"
                    value={roleName}
                    onChange={(e) => {
                      setRoleName(e.target.value);
                      if (!editingRoleId) {
                        setRoleSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, '')
                        );
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Role Slug (identifier)</Label>
                  <Input
                    placeholder="e.g. site-technician"
                    value={roleSlug}
                    onChange={(e) => setRoleSlug(e.target.value)}
                    disabled={Boolean(editingRoleId)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={roleColor}
                      onChange={(e) => setRoleColor(e.target.value)}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      value={roleColor}
                      onChange={(e) => setRoleColor(e.target.value)}
                      placeholder="#3f78e0"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Site / Hub Scoping (Optional)</Label>
                  <Select
                    value={selectedSiteScopes.length > 0 ? 'restricted' : 'all'}
                    onValueChange={(val) => {
                      if (val === 'all') setSelectedSiteScopes([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sites (Unrestricted)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites & Chargers (Global)</SelectItem>
                      <SelectItem value="restricted">Restricted to Assigned Sites</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="Outline the operational responsibilities and permission boundaries of this role..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Permission Capability Selector */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-1.5">
                    <Key className="size-4 text-[#8b5cf6]" />
                    Permissions Matrix ({selectedPermissions.length} selected)
                  </Label>
                </div>

                <div className="space-y-4">
                  {categories.map((category) => {
                    const catCaps = capabilities.filter((c) => c.category === category);
                    const allSelected = catCaps.every((c) => selectedPermissions.includes(c.key));

                    return (
                      <div
                        key={category}
                        className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            {category}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCategoryAll(category)}
                            className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {allSelected ? 'Deselect All' : 'Select All in Category'}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catCaps.map((cap) => {
                            const isChecked = selectedPermissions.includes(cap.key);
                            return (
                              <div
                                key={cap.key}
                                onClick={() => handleTogglePermission(cap.key)}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                                  isChecked
                                    ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/50 text-foreground'
                                    : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                                }`}
                              >
                                <div
                                  className={`size-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                                    isChecked
                                      ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                                      : 'border-muted-foreground/40'
                                  }`}
                                >
                                  {isChecked && <Check className="size-3 stroke-[3]" />}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs font-semibold leading-none">{cap.name}</p>
                                  <p className="text-[11px] text-muted-foreground leading-tight">
                                    {cap.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={submitting}
                className="bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white gap-2"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {editingRoleId ? 'Save Changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Role to User Modal */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="size-5 text-[#3f78e0]" />
                Assign Role to User
              </DialogTitle>
              <DialogDescription>
                Assign a default system role or custom PBAC policy to an existing user account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Select User *</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name || u.email} ({u.email}) - Current: {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Select Role / Policy *</Label>
                <Select
                  value={assignCustomRoleId ? `custom_${assignCustomRoleId}` : assignRoleSlug}
                  onValueChange={(val) => {
                    if (val.startsWith('custom_')) {
                      setAssignCustomRoleId(val.replace('custom_', ''));
                      setAssignRoleSlug('');
                    } else {
                      setAssignRoleSlug(val);
                      setAssignCustomRoleId('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                      System Roles
                    </div>
                    {roles
                      .filter((r) => r.isSystem)
                      .map((r) => (
                        <SelectItem key={r.role} value={r.role}>
                          {r.name} ({r.scope})
                        </SelectItem>
                      ))}

                    {customRoleCount > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground border-t mt-1 pt-1">
                          Custom PBAC Roles
                        </div>
                        {roles
                          .filter((r) => r.isCustom)
                          .map((r) => (
                            <SelectItem key={`custom_${r.id}`} value={`custom_${r.id}`}>
                              {r.name} (Custom Policy)
                            </SelectItem>
                          ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignRole}
                disabled={assigning}
                className="bg-[#3f78e0] hover:bg-[#3f78e0]/90 text-white gap-2"
              >
                {assigning && <Loader2 className="size-4 animate-spin" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
