'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { toast } from 'sonner';
import {
  CalendarRange,
  Plus,
  RefreshCw,
  Search,
  Clock,
  Zap,
  Play,
  Pause,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Car,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Sliders,
  Check,
  X,
  CreditCard,
  BatteryCharging,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface ScheduledCharging {
  id: number;
  userId?: number | null;
  chargerId: number;
  connectorId: number;
  idTag?: string | null;
  name: string;
  scheduleType: 'time_window' | 'departure_time' | 'cheapest_tariff' | 'solar_optimal';
  recurrence: 'once' | 'daily' | 'weekdays' | 'weekends' | 'custom';
  daysOfWeek?: string[] | null;
  startTime?: string | null;
  stopTime?: string | null;
  startDate?: string | null;
  stopDate?: string | null;
  departureTime?: string | null;
  maxCurrentAmps: number;
  maxPowerKw: number;
  targetSoc?: number | null;
  energyLimitKwh?: number | null;
  status: 'Active' | 'Paused' | 'Executing' | 'Completed' | 'Cancelled';
  lastExecutedAt?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
  createdAt: string;
  charger?: {
    charger_id: number;
    name: string;
    model: string;
    manufacturer: string;
    status: string;
  };
  user?: {
    id: number;
    name: string | null;
    email: string;
  };
}

interface ChargerOption {
  charger_id: number;
  name: string;
  model?: string;
  manufacturer?: string;
  status?: string;
  evses?: Array<{ connectors: Array<{ connector_id: number; connector_name: string }> }>;
}

interface RfidOption {
  rfid_user_id: number;
  rfid_tag: string;
  name?: string;
}

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'M', full: 'Mon' },
  { key: 'tue', label: 'T', full: 'Tue' },
  { key: 'wed', label: 'W', full: 'Wed' },
  { key: 'thu', label: 'T', full: 'Thu' },
  { key: 'fri', label: 'F', full: 'Fri' },
  { key: 'sat', label: 'S', full: 'Sat' },
  { key: 'sun', label: 'S', full: 'Sun' },
];

export default function ScheduledChargingPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledCharging[]>([]);
  const [chargers, setChargers] = useState<ChargerOption[]>([]);
  const [rfidTags, setRfidTags] = useState<RfidOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledCharging | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('Overnight Charge');
  const [formChargerId, setFormChargerId] = useState<string>('');
  const [formConnectorId, setFormConnectorId] = useState('1');
  const [formIdTag, setFormIdTag] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<string>('time_window');
  const [formRecurrence, setFormRecurrence] = useState<string>('daily');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [formStartTime, setFormStartTime] = useState('23:00');
  const [formStopTime, setFormStopTime] = useState('07:00');
  const [formDepartureTime, setFormDepartureTime] = useState('07:30');
  const [formMaxAmps, setFormMaxAmps] = useState(16);
  const [formMaxPowerKw, setFormMaxPowerKw] = useState(11);
  const [formTargetSoc, setFormTargetSoc] = useState(80);
  const [formEnergyLimitKwh, setFormEnergyLimitKwh] = useState<string>('');

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get('/scheduled-charging', { params });
      const dataList = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setSchedules(dataList);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to load scheduled charging plans');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [chargersRes, rfidRes] = await Promise.allSettled([
        api.get('/chargers'),
        api.get('/rfid'),
      ]);

      if (chargersRes.status === 'fulfilled') {
        const cData = Array.isArray(chargersRes.value.data)
          ? chargersRes.value.data
          : chargersRes.value.data?.chargers || chargersRes.value.data?.data || [];
        setChargers(cData);
        if (cData.length > 0 && !formChargerId) {
          setFormChargerId(String(cData[0].charger_id));
        }
      }

      if (rfidRes.status === 'fulfilled') {
        const rData = Array.isArray(rfidRes.value.data)
          ? rfidRes.value.data
          : rfidRes.value.data?.data || [];
        setRfidTags(rData);
        if (rData.length > 0 && !formIdTag) {
          setFormIdTag(rData[0].rfid_tag);
        }
      }
    } catch (err) {
      // Ignored
    }
  }, [formChargerId, formIdTag]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Quick Preset Handlers
  const applyPreset = (preset: 'night' | 'solar' | 'commute' | 'office') => {
    if (preset === 'night') {
      setFormName('🌙 Overnight Off-Peak');
      setFormScheduleType('time_window');
      setFormRecurrence('daily');
      setFormStartTime('23:00');
      setFormStopTime('07:00');
      setFormMaxAmps(16);
      setFormMaxPowerKw(11);
    } else if (preset === 'solar') {
      setFormName('⚡ Solar Noon Peak');
      setFormScheduleType('solar_optimal');
      setFormRecurrence('daily');
      setFormStartTime('11:30');
      setFormStopTime('15:30');
      setFormMaxAmps(32);
      setFormMaxPowerKw(22);
    } else if (preset === 'commute') {
      setFormName('🚗 Morning Commute Ready');
      setFormScheduleType('departure_time');
      setFormRecurrence('weekdays');
      setFormDepartureTime('07:30');
      setFormTargetSoc(85);
      setFormMaxAmps(16);
      setFormMaxPowerKw(11);
    } else if (preset === 'office') {
      setFormName('🏢 Workplace Daytime');
      setFormScheduleType('time_window');
      setFormRecurrence('weekdays');
      setFormDaysOfWeek(['mon', 'tue', 'wed', 'thu', 'fri']);
      setFormStartTime('09:00');
      setFormStopTime('17:00');
      setFormMaxAmps(16);
      setFormMaxPowerKw(11);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    setFormName('🌙 Overnight Off-Peak');
    if (chargers.length > 0) setFormChargerId(String(chargers[0].charger_id));
    setFormConnectorId('1');
    if (rfidTags.length > 0) setFormIdTag(rfidTags[0].rfid_tag);
    setFormScheduleType('time_window');
    setFormRecurrence('daily');
    setFormDaysOfWeek(['mon', 'tue', 'wed', 'thu', 'fri']);
    setFormStartTime('23:00');
    setFormStopTime('07:00');
    setFormDepartureTime('07:30');
    setFormMaxAmps(16);
    setFormMaxPowerKw(11);
    setFormTargetSoc(80);
    setFormEnergyLimitKwh('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: ScheduledCharging) => {
    setEditingSchedule(s);
    setFormName(s.name);
    setFormChargerId(String(s.chargerId));
    setFormConnectorId(String(s.connectorId || 1));
    setFormIdTag(s.idTag || '');
    setFormScheduleType(s.scheduleType || 'time_window');
    setFormRecurrence(s.recurrence || 'once');
    setFormDaysOfWeek((s.daysOfWeek as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri']);
    setFormStartTime(s.startTime || '23:00');
    setFormStopTime(s.stopTime || '07:00');
    setFormDepartureTime(s.departureTime || '07:30');
    setFormMaxAmps(s.maxCurrentAmps || 16);
    setFormMaxPowerKw(s.maxPowerKw || 11);
    setFormTargetSoc(s.targetSoc || 80);
    setFormEnergyLimitKwh(s.energyLimitKwh ? String(s.energyLimitKwh) : '');
    setIsModalOpen(true);
  };

  const toggleDayOfWeek = (dayKey: string) => {
    if (formDaysOfWeek.includes(dayKey)) {
      setFormDaysOfWeek(formDaysOfWeek.filter((d) => d !== dayKey));
    } else {
      setFormDaysOfWeek([...formDaysOfWeek, dayKey]);
    }
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formChargerId) {
      toast.error('Please select a target charger');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formName || 'Scheduled Charge',
        chargerId: Number(formChargerId),
        connectorId: Number(formConnectorId || 1),
        idTag: formIdTag || undefined,
        scheduleType: formScheduleType,
        recurrence: formRecurrence,
        daysOfWeek: formRecurrence === 'custom' ? formDaysOfWeek : undefined,
        startTime: formScheduleType === 'departure_time' ? undefined : formStartTime,
        stopTime: formScheduleType === 'departure_time' ? undefined : formStopTime,
        departureTime: formScheduleType === 'departure_time' ? formDepartureTime : undefined,
        maxCurrentAmps: Number(formMaxAmps),
        maxPowerKw: Number(formMaxPowerKw),
        targetSoc: formScheduleType === 'departure_time' ? Number(formTargetSoc) : undefined,
        energyLimitKwh: formEnergyLimitKwh ? Number(formEnergyLimitKwh) : undefined,
      };

      if (editingSchedule) {
        await api.put(`/scheduled-charging/${editingSchedule.id}`, payload);
        toast.success(`Schedule "${payload.name}" updated successfully`);
      } else {
        await api.post('/scheduled-charging', payload);
        toast.success(`Schedule "${payload.name}" created successfully`);
      }

      setIsModalOpen(false);
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSchedule = async (id: number) => {
    try {
      const res = await api.post(`/scheduled-charging/${id}/toggle`);
      toast.success(`Schedule status updated to ${res.data?.data?.status || 'updated'}`);
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to toggle schedule');
    }
  };

  const handleExecuteNow = async (id: number, name: string) => {
    try {
      toast.info(`Executing schedule "${name}" now...`);
      await api.post(`/scheduled-charging/${id}/execute-now`);
      toast.success(`Schedule "${name}" started successfully`);
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to execute schedule');
    }
  };

  const handleDeleteSchedule = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete scheduled charging plan "${name}"?`)) {
      return;
    }
    try {
      await api.delete(`/scheduled-charging/${id}`);
      toast.success(`Schedule "${name}" deleted`);
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete schedule');
    }
  };

  // KPIs
  const kpiData = useMemo(() => {
    const active = schedules.filter((s) => s.status === 'Active' || s.status === 'Executing').length;
    const executing = schedules.filter((s) => s.status === 'Executing').length;
    const totalKw = schedules
      .filter((s) => s.status === 'Active' || s.status === 'Executing')
      .reduce((sum, s) => sum + (s.maxPowerKw || 11), 0);
    return { active, executing, totalKw, total: schedules.length };
  }, [schedules]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-lg shadow-[#54a8c7]/20 text-white">
                <CalendarRange className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Scheduled Charging
                  {kpiData.executing > 0 && (
                    <Badge variant="soft-primary" className="animate-pulse text-xs">
                      {kpiData.executing} Charging Now
                    </Badge>
                  )}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Automate smart EV charging windows, dynamic off-peak rates, and departure-time targets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSchedules}
              disabled={loading}
              className="border-white/10 hover:bg-white/5 text-slate-300"
            >
              <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={handleOpenCreateModal}
              className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] hover:opacity-90 text-white shadow-md shadow-[#54a8c7]/20"
            >
              <Plus className="size-4 mr-2" />
              New Schedule
            </Button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1e2228]/80 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Schedules
                </p>
                <div className="text-2xl font-bold text-white">{kpiData.active}</div>
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Ready for dispatch
                </p>
              </div>
              <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Clock className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Charging
                </p>
                <div className="text-2xl font-bold text-white">{kpiData.executing}</div>
                <p className="text-xs text-[#54a8c7] font-medium flex items-center gap-1">
                  <BatteryCharging className="size-3.5" /> Sessions currently open
                </p>
              </div>
              <div className="size-11 rounded-xl bg-[#54a8c7]/10 border border-[#54a8c7]/20 flex items-center justify-center text-[#54a8c7]">
                <Zap className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Scheduled Fleet Power
                </p>
                <div className="text-2xl font-bold text-white">{kpiData.totalKw.toFixed(1)} kW</div>
                <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
                  <Sliders className="size-3.5" /> Smart profile derated
                </p>
              </div>
              <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sliders className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1e2228]/80 border-white/10 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Schedule Plans
                </p>
                <div className="text-2xl font-bold text-white">{kpiData.total}</div>
                <p className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                  <Layers className="size-3.5" /> Across all chargers
                </p>
              </div>
              <div className="size-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CalendarRange className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1e2228]/60 p-3 rounded-xl border border-white/10">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search schedules or chargers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-black/20 border-white/10 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-black/20 border-white/10 h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Executing">Executing</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Schedules Grid / List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-[#1e2228]/40 rounded-2xl border border-white/10">
            <div className="size-8 rounded-full border-2 border-[#54a8c7] border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading scheduled charging plans...</p>
          </div>
        ) : schedules.length === 0 ? (
          <Card className="bg-[#1e2228]/40 border-dashed border-white/10">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="size-14 rounded-2xl bg-[#54a8c7]/10 flex items-center justify-center text-[#54a8c7]">
                <CalendarRange className="size-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-semibold text-lg text-white">No Scheduled Charges Configured</h3>
                <p className="text-xs text-muted-foreground">
                  Create your first charging schedule to charge automatically during off-peak windows or solar hours.
                </p>
              </div>
              <Button
                onClick={handleOpenCreateModal}
                className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white"
              >
                <Plus className="size-4 mr-2" /> Create Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {schedules.map((schedule) => {
              const isActive = schedule.status === 'Active';
              const isExecuting = schedule.status === 'Executing';
              const isPaused = schedule.status === 'Paused';

              return (
                <Card
                  key={schedule.id}
                  className={`border transition-all duration-200 hover:shadow-xl ${
                    isExecuting
                      ? 'bg-gradient-to-b from-[#54a8c7]/10 to-[#1e2228] border-[#54a8c7]/40 shadow-lg shadow-[#54a8c7]/10'
                      : isActive
                      ? 'bg-[#1e2228]/90 border-white/10 hover:border-white/20'
                      : 'bg-[#1e2228]/50 border-white/5 opacity-75'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-white leading-snug">
                            {schedule.name}
                          </CardTitle>
                          {isExecuting && (
                            <Badge className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] animate-pulse">
                              ⚡ CHARGING
                            </Badge>
                          )}
                          {isActive && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                              ACTIVE
                            </Badge>
                          )}
                          {isPaused && (
                            <Badge variant="soft-secondary" className="text-[10px]">
                              PAUSED
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs flex items-center gap-1.5 text-slate-400">
                          <Zap className="size-3.5 text-[#54a8c7]" />
                          {schedule.charger?.name || `Charger #${schedule.chargerId}`}
                          <span className="text-white/30">•</span>
                          <span>Ch {schedule.connectorId}</span>
                        </CardDescription>
                      </div>

                      {/* Switch for instant enable/pause */}
                      <Switch
                        checked={schedule.status === 'Active' || schedule.status === 'Executing'}
                        onCheckedChange={() => handleToggleSchedule(schedule.id)}
                        title={isActive ? 'Click to Pause' : 'Click to Activate'}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    {/* Time Window Visual Bar */}
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3.5 text-[#54a8c7]" />
                          {schedule.scheduleType === 'departure_time' ? 'Departure Ready' : 'Time Window'}
                        </span>
                        <span className="font-semibold text-white font-mono">
                          {schedule.scheduleType === 'departure_time'
                            ? `By ${schedule.departureTime || '07:30'}`
                            : `${schedule.startTime || '--:--'} ➔ ${schedule.stopTime || '--:--'}`}
                        </span>
                      </div>

                      {/* Recurrence Chips */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-muted-foreground capitalize">
                          {schedule.recurrence === 'custom'
                            ? 'Custom Days'
                            : schedule.recurrence}
                        </span>
                        {schedule.recurrence === 'custom' && schedule.daysOfWeek && (
                          <div className="flex items-center gap-1">
                            {DAYS_OF_WEEK.map((d) => {
                              const isDayActive = (schedule.daysOfWeek as string[])?.includes(d.key);
                              return (
                                <span
                                  key={d.key}
                                  className={`size-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                    isDayActive
                                      ? 'bg-[#54a8c7] text-white'
                                      : 'bg-white/5 text-white/30'
                                  }`}
                                >
                                  {d.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Power & Energy Specifications */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Max Rate
                        </span>
                        <span className="font-bold text-white text-sm">
                          {schedule.maxCurrentAmps}A{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({schedule.maxPowerKw} kW)
                          </span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          {schedule.scheduleType === 'departure_time' ? 'Target SoC' : 'Auth Card'}
                        </span>
                        <span className="font-bold text-white text-sm truncate block font-mono">
                          {schedule.scheduleType === 'departure_time'
                            ? `${schedule.targetSoc || 80}%`
                            : schedule.idTag || 'Auto'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExecuteNow(schedule.id, schedule.name)}
                        className="h-8 text-xs text-[#54a8c7] hover:bg-[#54a8c7]/10 hover:text-white px-2.5"
                      >
                        <Play className="size-3.5 mr-1.5 fill-current" /> Execute Now
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditModal(schedule)}
                          className="size-8 text-slate-400 hover:text-white hover:bg-white/10"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                          className="size-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / Edit Schedule Modal Dialog */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-xl bg-[#1e2228] border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <CalendarRange className="size-5 text-[#54a8c7]" />
                {editingSchedule ? 'Edit Charging Schedule' : 'Create Scheduled Charging Plan'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Configure smart charging periods, target power limits, and departure times.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitSchedule} className="space-y-5 py-2">
              {/* Quick Preset Buttons (Only when creating) */}
              {!editingSchedule && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-400" /> Quick Smart Presets
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('night')}
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-[#54a8c7]/15 hover:border-[#54a8c7]/40 text-left transition-colors"
                    >
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <Moon className="size-3.5 text-indigo-400" /> Night Off-Peak
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">23:00 - 07:00 • 16A (11kW)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('solar')}
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/15 hover:border-amber-500/40 text-left transition-colors"
                    >
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <Sun className="size-3.5 text-amber-400" /> Solar Noon
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">11:30 - 15:30 • 32A (22kW)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('commute')}
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 text-left transition-colors"
                    >
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <Car className="size-3.5 text-emerald-400" /> Morning Commute
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Ready by 07:30 • 85% SoC</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('office')}
                      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-purple-500/15 hover:border-purple-500/40 text-left transition-colors"
                    >
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-purple-400" /> Workplace Hours
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">09:00 - 17:00 • Mon-Fri</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Name */}
              <div className="space-y-1.5">
                <Label className="text-xs">Schedule Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Daily Night Charge"
                  required
                  className="bg-black/30 border-white/10 text-sm"
                />
              </div>

              {/* Target Charger & Connector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Charger</Label>
                  <Select value={formChargerId} onValueChange={setFormChargerId} required>
                    <SelectTrigger className="bg-black/30 border-white/10 text-xs">
                      <SelectValue placeholder="Select Charger" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargers.map((c) => (
                        <SelectItem key={c.charger_id} value={String(c.charger_id)}>
                          {c.name} (#{c.charger_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">EVSE Connector</Label>
                  <Select value={formConnectorId} onValueChange={setFormConnectorId}>
                    <SelectTrigger className="bg-black/30 border-white/10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Channel 1 (Primary)</SelectItem>
                      <SelectItem value="2">Channel 2 (Secondary)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* RFID Card / Authorization */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center justify-between">
                  <span>RFID Card Tag (For Remote Start)</span>
                  <span className="text-[10px] text-muted-foreground">Optional</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formIdTag}
                    onChange={(e) => setFormIdTag(e.target.value)}
                    placeholder="e.g. RFID_TAG_123"
                    className="bg-black/30 border-white/10 text-xs font-mono"
                  />
                  {rfidTags.length > 0 && (
                    <Select value={formIdTag} onValueChange={setFormIdTag}>
                      <SelectTrigger className="w-36 bg-black/30 border-white/10 text-xs">
                        <SelectValue placeholder="Pick Card" />
                      </SelectTrigger>
                      <SelectContent>
                        {rfidTags.map((r) => (
                          <SelectItem key={r.rfid_user_id} value={r.rfid_tag}>
                            {r.name || r.rfid_tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Mode & Timing */}
              <div className="space-y-3 p-3.5 rounded-xl bg-black/20 border border-white/10">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-white">Schedule Mode</Label>
                  <div className="flex rounded-lg bg-white/5 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setFormScheduleType('time_window')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        formScheduleType === 'time_window' || formScheduleType === 'solar_optimal'
                          ? 'bg-[#54a8c7] text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Time Window
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormScheduleType('departure_time')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        formScheduleType === 'departure_time'
                          ? 'bg-[#54a8c7] text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Departure Time
                    </button>
                  </div>
                </div>

                {formScheduleType === 'departure_time' ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Target Departure Time</Label>
                      <Input
                        type="time"
                        value={formDepartureTime}
                        onChange={(e) => setFormDepartureTime(e.target.value)}
                        className="bg-black/30 border-white/10 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Target SoC ({formTargetSoc}%)</Label>
                      <Slider
                        min={50}
                        max={100}
                        step={5}
                        value={[formTargetSoc]}
                        onValueChange={(val) => setFormTargetSoc(val[0])}
                        className="py-3"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Charging At</Label>
                      <Input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="bg-black/30 border-white/10 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stop Charging At</Label>
                      <Input
                        type="time"
                        value={formStopTime}
                        onChange={(e) => setFormStopTime(e.target.value)}
                        className="bg-black/30 border-white/10 text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Recurrence Selection */}
              <div className="space-y-2">
                <Label className="text-xs">Recurrence Frequency</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekdays', label: 'Weekdays' },
                    { id: 'weekends', label: 'Weekends' },
                    { id: 'custom', label: 'Custom' },
                  ].map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setFormRecurrence(rec.id)}
                      className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                        formRecurrence === rec.id
                          ? 'bg-[#54a8c7]/20 border-[#54a8c7] text-[#54a8c7]'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>

                {formRecurrence === 'custom' && (
                  <div className="flex items-center justify-between gap-1 pt-2">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = formDaysOfWeek.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.key)}
                          className={`size-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                            isSelected
                              ? 'bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] text-white shadow-md shadow-[#54a8c7]/20'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Charging Power Limits */}
              <div className="space-y-3 p-3.5 rounded-xl bg-black/20 border border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs font-semibold text-white">Current Limit (Amps)</Label>
                  <span className="font-bold text-[#54a8c7] font-mono text-sm">
                    {formMaxAmps} A <span className="text-xs font-normal text-slate-400">({formMaxPowerKw} kW)</span>
                  </span>
                </div>
                <Slider
                  min={6}
                  max={32}
                  step={1}
                  value={[formMaxAmps]}
                  onValueChange={(val) => {
                    const a = val[0];
                    setFormMaxAmps(a);
                    // Approximate 3-phase kW: a * 3 * 230 / 1000
                    setFormMaxPowerKw(Number(((a * 3 * 230) / 1000).toFixed(1)));
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>6A (4.1 kW)</span>
                  <span>16A (11 kW)</span>
                  <span>32A (22 kW)</span>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white"
                >
                  {submitting ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
