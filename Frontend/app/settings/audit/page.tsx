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

  const getActionBadge = (action: string) => {
    let colorClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (action.includes('CREATE') || action.includes('START') || action.includes('SIGNED')) {
      colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    } else if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('REJECT')) {
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#fab758]/15 text-[#fab758] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              Enterprise Audit Trail
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Immutable, granular compliance and operational audit log for ISO 27001 / SOC 2 certification
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="border-zinc-800 bg-[#1e2228] text-zinc-300 hover:text-white hover:bg-zinc-800"
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
        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search action, target, IP, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-zinc-900/60 border-zinc-800 text-sm text-white placeholder:text-zinc-500 h-9"
              />
            </div>

            {/* Target Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-400 font-medium">Target:</span>
            </div>
            <Select value={targetFilter} onValueChange={setTargetFilter}>
              <SelectTrigger className="w-[140px] bg-zinc-900/60 border-zinc-800 text-sm h-9">
                <SelectValue placeholder="All Targets" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
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
              <span className="text-xs text-zinc-400 font-medium">Action:</span>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px] bg-zinc-900/60 border-zinc-800 text-sm h-9">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
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

          <div className="text-xs text-zinc-400 font-medium whitespace-nowrap">
            Showing <span className="text-white font-semibold">{logs.length}</span> of {total} total audited events
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-xl bg-[#1e2228] border border-zinc-800/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/70 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">User / Initiator</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Target Entity</th>
                  <th className="px-5 py-3.5">IP Address</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-[#54a8c7]" />
                      Loading audit events...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No audit records matching current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-850/40 transition-colors">
                      <td className="px-5 py-4 text-xs text-zinc-300 whitespace-nowrap">
                        <div className="font-medium text-white">{new Date(log.createdAt).toLocaleTimeString()}</div>
                        <div className="text-zinc-500">{new Date(log.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          {log.user?.name || log.user?.email || (log.userId ? `User #${log.userId}` : 'System / Automated')}
                        </div>
                        {log.user?.email && log.user.name && (
                          <div className="text-xs text-zinc-500 mt-0.5">{log.user.email}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">{getActionBadge(log.action)}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-zinc-200">{log.target}</div>
                        {log.targetId && (
                          <div className="text-xs font-mono text-zinc-400 mt-0.5">ID: {log.targetId}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-zinc-400">{log.ip}</td>
                      <td className="px-5 py-4 text-right">
                        {log.payload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs h-8"
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
          <DialogContent className="bg-[#1e2228] border-zinc-800 text-white sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-white">
                <Activity className="w-5 h-5 text-[#fab758]" />
                Audit Event Payload (Event #{selectedLog?.id})
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-sm">
                Raw metadata and change payload captured at {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                <div>
                  <span className="text-zinc-500">Action:</span> <span className="text-white font-mono">{selectedLog?.action}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Target:</span> <span className="text-white font-mono">{selectedLog?.target} ({selectedLog?.targetId || 'N/A'})</span>
                </div>
                <div>
                  <span className="text-zinc-500">IP:</span> <span className="text-white font-mono">{selectedLog?.ip}</span>
                </div>
                <div>
                  <span className="text-zinc-500">User:</span> <span className="text-white font-mono">{selectedLog?.user?.email || selectedLog?.userId || 'System'}</span>
                </div>
              </div>

              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 overflow-x-auto max-h-[300px]">
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(selectedLog?.payload, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
