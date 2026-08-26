'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck,
  RefreshCw,
  Zap,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface LocalAuthEntry {
  id: number;
  idTag: string;
  status: string;
  parentIdTag?: string | null;
  expiryDate?: string | null;
  updatedAt: string;
}

interface LocalAuthListData {
  id: number;
  chargerId: number;
  listVersion: number;
  status: string;
  lastSyncedAt?: string | null;
  entries: LocalAuthEntry[];
}

export function LocalAuthListPanel({ chargerId, isOnline }: { chargerId: number; isOnline: boolean }) {
  const [data, setData] = useState<LocalAuthListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchLocalAuthList = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/chargers/${chargerId}/local-auth-list`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load local auth list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chargerId) {
      fetchLocalAuthList();
    }
  }, [chargerId]);

  const handleSync = async (updateType: 'Full' | 'Differential') => {
    try {
      setSyncing(true);
      const res = await api.post(`/api/chargers/${chargerId}/local-auth-list/sync`, { updateType });
      if (res.data.success) {
        toast.success(`Pushed ${res.data.data.count} tokens (Version ${res.data.data.listVersion}) via OCPP SendLocalList.`);
        fetchLocalAuthList();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Sync Failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleQueryVersion = async () => {
    try {
      setSyncing(true);
      const res = await api.post(`/api/chargers/${chargerId}/local-auth-list/version`);
      if (res.data.success) {
        toast.success(`Charger reported local list version: ${res.data.data.listVersion}`);
        fetchLocalAuthList();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Query Failed');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Synchronized':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Synchronized
          </Badge>
        );
      case 'Outdated':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Outdated
          </Badge>
        );
      case 'Failed':
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Sync Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-[#1e2228] border-zinc-800/80 shadow-sm">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#54a8c7]" />
            Local Authorization List (Offline Resilience)
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 mt-1">
            Enables charge point offline badge authorization via OCPP <code className="text-zinc-300">SendLocalList</code> &amp; <code className="text-zinc-300">GetLocalListVersion</code>.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleQueryVersion}
            disabled={!isOnline || syncing}
            className="border-zinc-800 text-xs bg-zinc-900 text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Query Version
          </Button>
          <Button
            size="sm"
            onClick={() => handleSync('Full')}
            disabled={!isOnline || syncing}
            className="bg-[#3f78e0] hover:bg-[#3364be] text-white text-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            Sync Full List
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">List Version</span>
            <div className="text-xl font-bold text-white font-mono mt-0.5">
              v{data?.listVersion ?? 0}
            </div>
          </div>
          <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">Sync Status</span>
            <div className="mt-1">
              {getStatusBadge(data?.status || 'Unknown')}
            </div>
          </div>
          <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">Cached Whitelist Tokens</span>
            <div className="text-xl font-bold text-[#54a8c7] font-mono mt-0.5">
              {data?.entries?.length || 0}
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/70 border-b border-zinc-800 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2.5">ID Tag / Token</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Parent ID Tag</th>
                <th className="px-4 py-2.5">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-[#54a8c7]" />
                    Loading local list...
                  </td>
                </tr>
              ) : !data?.entries || data.entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    <Key className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                    No local authorization entries synchronized yet. Click "Sync Full List".
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-850/40">
                    <td className="px-4 py-2.5 font-mono text-white font-medium">
                      {entry.idTag}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-zinc-400">
                      {entry.parentIdTag || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString() : 'Permanent'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
