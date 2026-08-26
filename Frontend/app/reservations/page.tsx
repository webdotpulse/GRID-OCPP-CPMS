'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Search,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  ShieldCheck,
  Filter,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Reservation {
  id: number;
  reservationId: number;
  chargerId: number;
  connectorId: number;
  idTag: string;
  parentIdTag?: string | null;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Consumed' | 'Cancelled';
  createdAt: string;
  charger?: { charger_id: number; name: string; model: string | null };
  user?: { id: number; name: string | null; email: string };
  rfidUser?: { rfid_user_id: number; name: string; rfid_tag: string };
}

interface ChargerOption {
  charger_id: number;
  name: string;
  model?: string;
  status?: string;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [chargers, setChargers] = useState<ChargerOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // New reservation form state
  const [selectedChargerId, setSelectedChargerId] = useState<string>('');
  const [connectorId, setConnectorId] = useState('1');
  const [idTag, setIdTag] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get('/api/reservations', { params });
      if (res.data.success) {
        setReservations(res.data.data || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const fetchChargers = async () => {
    try {
      const res = await api.get('/api/chargers');
      if (res.data.success) {
        setChargers(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching chargers:', error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchChargers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReservations();
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargerId || !idTag) {
      toast.error('Please select a charger and enter an RFID / EMAID tag');
      return;
    }

    try {
      setSubmitting(true);
      const expiryDate = new Date(Date.now() + parseInt(durationMinutes, 10) * 60 * 1000);

      const res = await api.post('/api/reservations', {
        chargerId: parseInt(selectedChargerId, 10),
        connectorId: parseInt(connectorId, 10),
        idTag,
        expiryDate: expiryDate.toISOString(),
      });

      if (res.data.success) {
        toast.success(`Reservation #${res.data.data.reservationId} successfully dispatched to charger`);
        setIsNewModalOpen(false);
        setSelectedChargerId('');
        setIdTag('');
        fetchReservations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Reservation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (reservationId: number) => {
    try {
      const res = await api.post(`/api/reservations/${reservationId}/cancel`);
      if (res.data.success) {
        toast.success(`Reservation #${reservationId} was successfully cancelled`);
        fetchReservations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Cancellation Failed');
    }
  };

  const activeCount = reservations.filter((r) => r.status === 'Active').length;
  const consumedCount = reservations.filter((r) => r.status === 'Consumed').length;
  const expiredCount = reservations.filter((r) => r.status === 'Expired').length;
  const cancelledCount = reservations.filter((r) => r.status === 'Cancelled').length;

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'Active':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </Badge>
        );
      case 'Consumed':
        return (
          <Badge className="bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1.5 px-2.5 py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Consumed
          </Badge>
        );
      case 'Expired':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 px-2.5 py-0.5">
            <Clock className="w-3 h-3" />
            Expired
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 px-2.5 py-0.5">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CalendarClock className="w-7 h-7 text-[#54a8c7]" />
            Connector Reservations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Dispatch, track, and manage OCPP 1.6 & 2.0.1 / 2.1 hardware connector reservations (ReserveNow / CancelReservation)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReservations}
            disabled={loading}
            className="border-zinc-800 bg-[#1e2228] text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="bg-[#3f78e0] hover:bg-[#3364be] text-white shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reservation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Reservations</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Consumed (Charged)</p>
            <h3 className="text-2xl font-bold text-sky-400 mt-1">{consumedCount}</h3>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Expired</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{expiredCount}</h3>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cancelled</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">{cancelledCount}</h3>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#1e2228] border border-zinc-800/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by RFID Tag or Charger..."
              className="pl-9 bg-zinc-900/60 border-zinc-800 text-sm focus-visible:ring-[#3f78e0]"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium">Status:</span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-zinc-900/60 border-zinc-800 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Consumed">Consumed</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-xl bg-[#1e2228] border border-zinc-800/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 border-b border-zinc-800/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Reservation ID</th>
                <th className="px-5 py-3.5">Charger & EVSE</th>
                <th className="px-5 py-3.5">RFID / ID Tag</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Expires At</th>
                <th className="px-5 py-3.5">Created At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-[#54a8c7]" />
                    Loading reservations...
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                    <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No reservations found. Click "New Reservation" to reserve a connector.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-zinc-850/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-white flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-[#54a8c7]" />
                      #{res.reservationId}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">
                        {res.charger?.name || `Charger #${res.chargerId}`}
                      </div>
                      <div className="text-xs text-zinc-400">
                        Connector {res.connectorId} {res.charger?.model ? `• ${res.charger.model}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-200">
                          {res.idTag}
                        </span>
                      </div>
                      {res.rfidUser && (
                        <div className="text-xs text-zinc-400 mt-0.5">{res.rfidUser.name}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(res.status)}</td>
                    <td className="px-5 py-4 text-xs text-zinc-300">
                      <div className="font-medium">{new Date(res.expiryDate).toLocaleTimeString()}</div>
                      <div className="text-zinc-500">{new Date(res.expiryDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-400">
                      {new Date(res.createdAt).toLocaleDateString()}{' '}
                      {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {res.status === 'Active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelReservation(res.reservationId)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Cancel
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

      {/* New Reservation Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="bg-[#1e2228] border-zinc-800 text-white sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              <CalendarClock className="w-5 h-5 text-[#3f78e0]" />
              Create Connector Reservation
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              Sends an OCPP <code className="text-zinc-300">ReserveNow</code> command directly to the charge point.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateReservation} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Select Charge Point</Label>
              <Select value={selectedChargerId} onValueChange={setSelectedChargerId}>
                <SelectTrigger className="bg-zinc-900/80 border-zinc-800 text-white">
                  <SelectValue placeholder="Choose a charger..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
                  {chargers.map((ch) => (
                    <SelectItem key={ch.charger_id} value={String(ch.charger_id)}>
                      {ch.name} {ch.model ? `(${ch.model})` : ''} - #{ch.charger_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-300">Connector / Channel</Label>
                <Select value={connectorId} onValueChange={setConnectorId}>
                  <SelectTrigger className="bg-zinc-900/80 border-zinc-800 text-white">
                    <SelectValue placeholder="Connector ID" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
                    <SelectItem value="1">Connector 1</SelectItem>
                    <SelectItem value="2">Connector 2</SelectItem>
                    <SelectItem value="0">Any / Station Main (0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-300">Reservation Duration</Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger className="bg-zinc-900/80 border-zinc-800 text-white">
                    <SelectValue placeholder="Duration" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e2228] border-zinc-800 text-white">
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-300">Authorized RFID Tag / EMAID</Label>
              <Input
                value={idTag}
                onChange={(e) => setIdTag(e.target.value)}
                placeholder="e.g. TAG-998231 or EMAID..."
                className="bg-zinc-900/80 border-zinc-800 font-mono text-sm focus-visible:ring-[#3f78e0]"
                required
              />
              <p className="text-[11px] text-zinc-500">
                Only this RFID card or ISO 15118 vehicle certificate will be permitted to start a session on the reserved connector.
              </p>
            </div>

            <DialogFooter className="pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewModalOpen(false)}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#3f78e0] hover:bg-[#3364be] text-white"
              >
                {submitting ? 'Dispatching...' : 'Dispatch ReserveNow'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
