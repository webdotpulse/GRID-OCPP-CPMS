'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Download,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Activity,
  Layers,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface AuditLog {
  id: number;
  createdAt: string;
  userId: number | null;
  user?: { id: number; name: string | null; email: string } | null;
  action: string;
  target: string;
  targetId: string | null;
  ip: string;
  userAgent?: string | null;
  payload?: any;
}

export default function AuditLogsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Clear Logs State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearRange, setClearRange] = useState<'all' | '7d' | '30d' | '90d'>('30d');
  const [clearing, setClearing] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (targetFilter !== 'all') params.target = targetFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get('/audit', { params });
      const dataList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setLogs(dataList);
      const totalCount = (res as any).total ?? (res.data as any)?.total ?? dataList.length;
      setTotal(totalCount);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?.role === 'admin' || user?.role === 'superadmin')) {
      fetchLogs();
    }
  }, [actionFilter, targetFilter, debouncedSearch, authLoading, user]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params: any = {};
      if (actionFilter !== 'all') params.action = actionFilter;
      if (targetFilter !== 'all') params.target = targetFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get('/audit/export', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      toast.success('CSV audit trail downloaded successfully for compliance records.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Export Failed');
    } finally {
      setExporting(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      setClearing(true);
      const params: any = {};
      const now = new Date();

      if (clearRange === '7d') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.dateBefore = d.toISOString();
      } else if (clearRange === '30d') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.dateBefore = d.toISOString();
      } else if (clearRange === '90d') {
        const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        params.dateBefore = d.toISOString();
      }

      const res = await api.delete('/audit', { params });
      toast.success(res.data?.message || 'Audit logs cleared successfully');
      setIsClearModalOpen(false);
      fetchLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to clear audit logs');
    } finally {
      setClearing(false);
    }
  };

  const getActionBadge = (action: string) => {
    let colorClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (action.includes('CREATE') || action.includes('START') || action.includes('SIGNED')) {
      colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('REJECT') || action.includes('CLEAR')) {
      colorClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    } else if (action.includes('UPDATE') || action.includes('SYNC')) {
      colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    } else if (action.includes('AUTH') || action.includes('LOGIN')) {
      colorClass = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }

    return (
      <Badge className={`${colorClass} border font-mono text-xs px-2 py-0.5`}>
        {action}
      </Badge>
    );
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-[#54a8c7]" />
          <span className="text-xs">Loading audit logs...</span>
        </div>
      </AppShell>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Unauthorized Access</h2>
            <p className="text-sm text-muted-foreground">You do not have permission to view enterprise audit logs.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Audit Trail</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 font-heading">
              <div className="size-9 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              Enterprise Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Immutable, granular compliance and operational audit log for ISO 27001 / SOC 2 certification
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearModalOpen(true)}
              disabled={loading || logs.length === 0}
              className="border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Logs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="border-border text-foreground hover:bg-muted/50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting}
              className="bg-[#45c4a0] hover:bg-[#3bb190] text-zinc-950 font-semibold shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search action, target, IP, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background border-border text-sm h-9"
              />
            </div>

            {/* Target Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Target:</span>
            </div>
            <Select value={targetFilter} onValueChange={setTargetFilter}>
              <SelectTrigger className="w-[140px] bg-background border-border text-sm h-9">
                <SelectValue placeholder="All Targets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                <SelectItem value="Charger">Charger</SelectItem>
                <SelectItem value="Reservation">Reservation</SelectItem>
                <SelectItem value="Certificate">Certificate</SelectItem>
                <SelectItem value="Tariff">Tariff</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Payment">Payment</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Action:</span>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px] bg-background border-border text-sm h-9">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="LOCAL_AUTH_SYNC">LOCAL_AUTH_SYNC</SelectItem>
                <SelectItem value="RESERVATION_CREATE">RESERVATION_CREATE</SelectItem>
                <SelectItem value="RESERVATION_CANCEL">RESERVATION_CANCEL</SelectItem>
                <SelectItem value="CERTIFICATE_SIGNED">CERTIFICATE_SIGNED</SelectItem>
                <SelectItem value="CERTIFICATE_INSTALLED">CERTIFICATE_INSTALLED</SelectItem>
                <SelectItem value="CERTIFICATE_DELETED">CERTIFICATE_DELETED</SelectItem>
                <SelectItem value="USER_LOGIN">USER_LOGIN</SelectItem>
                <SelectItem value="CHARGER_UPDATE">CHARGER_UPDATE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            Showing <span className="text-foreground font-semibold">{logs.length}</span> of {total} total audited events
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">User / Initiator</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Target Entity</th>
                  <th className="px-5 py-3.5">IP Address</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-[#54a8c7]" />
                      Loading audit events...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No audit records matching current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 text-xs text-foreground whitespace-nowrap">
                        <div className="font-medium text-foreground">{new Date(log.createdAt).toLocaleTimeString()}</div>
                        <div className="text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {log.user?.name || log.user?.email || (log.userId ? `User #${log.userId}` : 'System / Automated')}
                        </div>
                        {log.user?.email && log.user.name && (
                          <div className="text-xs text-muted-foreground mt-0.5">{log.user.email}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">{getActionBadge(log.action)}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">{log.target}</div>
                        {log.targetId && (
                          <div className="text-xs font-mono text-muted-foreground mt-0.5">ID: {log.targetId}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{log.ip}</td>
                      <td className="px-5 py-4 text-right">
                        {log.payload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs h-8"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View Payload
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* JSON Payload Inspector Modal */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-[#fab758]" />
                Audit Event Payload (Event #{selectedLog?.id})
              </DialogTitle>
              <DialogDescription>
                Raw metadata and change payload captured at {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground">Action:</span> <span className="text-foreground font-mono font-medium">{selectedLog?.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Target:</span> <span className="text-foreground font-mono font-medium">{selectedLog?.target} ({selectedLog?.targetId || 'N/A'})</span>
                </div>
                <div>
                  <span className="text-muted-foreground">IP:</span> <span className="text-foreground font-mono font-medium">{selectedLog?.ip}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User:</span> <span className="text-foreground font-mono font-medium">{selectedLog?.user?.email || selectedLog?.userId || 'System'}</span>
                </div>
              </div>

              <div className="bg-muted/60 dark:bg-zinc-950 p-3 rounded-lg border border-border overflow-x-auto max-h-[300px]">
                <pre className="text-xs font-mono text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(selectedLog?.payload, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clear Audit Logs Modal */}
        <Dialog open={isClearModalOpen} onOpenChange={setIsClearModalOpen}>
          <DialogContent className="sm:max-w-md p-0 flex flex-col overflow-hidden bg-card text-card-foreground border-border">
            <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-rose-600 dark:text-rose-400 font-heading">
                <Trash2 className="w-5 h-5" />
                Clear Audit Trail Logs
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Purge recorded audit log entries. This action permanently deletes matching compliance log records.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700 dark:text-rose-300">
                  <span className="font-semibold block mb-0.5">Compliance Notice</span>
                  Purging audit logs cannot be undone. An immutable audit record acknowledging this purge action will be retained for SOC 2 / ISO 27001 tracking.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Purge Scope
                </label>
                <Select value={clearRange} onValueChange={(val: any) => setClearRange(val)}>
                  <SelectTrigger className="bg-background border-border text-foreground text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Logs older than 7 days</SelectItem>
                    <SelectItem value="30d">Logs older than 30 days (Recommended)</SelectItem>
                    <SelectItem value="90d">Logs older than 90 days</SelectItem>
                    <SelectItem value="all">Purge ALL Audit Logs ({total} records)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 shrink-0 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsClearModalOpen(false)}
                disabled={clearing}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClearLogs}
                disabled={clearing}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {clearing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Purging Logs...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Confirm & Purge Logs
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
