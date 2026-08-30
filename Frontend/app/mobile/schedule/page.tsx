'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  CalendarRange,
  Plus,
  RefreshCw,
  Clock,
  Zap,
  Play,
  Trash2,
  CheckCircle2,
  Moon,
  Sun,
  Car,
  Building2,
  Sparkles,
  Sliders,
  BatteryCharging,
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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface ScheduledCharging {
  id: number;
  chargerId: number;
  connectorId: number;
  idTag?: string | null;
  name: string;
  scheduleType: string;
  recurrence: string;
  daysOfWeek?: string[] | null;
  startTime?: string | null;
  stopTime?: string | null;
  departureTime?: string | null;
  maxCurrentAmps: number;
  maxPowerKw: number;
  targetSoc?: number | null;
  status: 'Active' | 'Paused' | 'Executing' | 'Completed' | 'Cancelled';
  charger?: {
    charger_id: number;
    name: string;
    status: string;
  };
}

const DAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

export default function MobileSchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledCharging[]>([]);
  const [chargers, setChargers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('🌙 Overnight Charge');
  const [formChargerId, setFormChargerId] = useState<string>('');
  const [formConnectorId, setFormConnectorId] = useState('1');
  const [formScheduleType, setFormScheduleType] = useState('time_window');
  const [formRecurrence, setFormRecurrence] = useState('daily');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [formStartTime, setFormStartTime] = useState('23:00');
  const [formStopTime, setFormStopTime] = useState('07:00');
  const [formDepartureTime, setFormDepartureTime] = useState('07:30');
  const [formMaxAmps, setFormMaxAmps] = useState(16);
  const [formTargetSoc, setFormTargetSoc] = useState(80);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/scheduled-charging');
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setSchedules(list);
    } catch (err: any) {
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChargers = useCallback(async () => {
    try {
      const res = await api.get('/chargers');
      const list = Array.isArray(res.data) ? res.data : res.data?.chargers || res.data?.data || [];
      setChargers(list);
      if (list.length > 0 && !formChargerId) {
        setFormChargerId(String(list[0].charger_id));
      }
    } catch (err) {
      // Ignored
    }
  }, [formChargerId]);

  useEffect(() => {
    fetchSchedules();
    fetchChargers();
  }, [fetchSchedules, fetchChargers]);

  const applyPreset = (preset: 'night' | 'solar' | 'commute') => {
    if (preset === 'night') {
      setFormName('🌙 Overnight Off-Peak');
      setFormScheduleType('time_window');
      setFormRecurrence('daily');
      setFormStartTime('23:00');
      setFormStopTime('07:00');
      setFormMaxAmps(16);
    } else if (preset === 'solar') {
      setFormName('⚡ Solar Noon Peak');
      setFormScheduleType('solar_optimal');
      setFormRecurrence('daily');
      setFormStartTime('11:30');
      setFormStopTime('15:30');
      setFormMaxAmps(32);
    } else if (preset === 'commute') {
      setFormName('🚗 Commute Ready');
      setFormScheduleType('departure_time');
      setFormRecurrence('weekdays');
      setFormDepartureTime('07:30');
      setFormTargetSoc(85);
      setFormMaxAmps(16);
    }
  };

  const toggleDayOfWeek = (key: string) => {
    if (formDaysOfWeek.includes(key)) {
      setFormDaysOfWeek(formDaysOfWeek.filter((d) => d !== key));
    } else {
      setFormDaysOfWeek([...formDaysOfWeek, key]);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formChargerId) {
      toast.error('Please select a charger');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formName || 'Scheduled Charge',
        chargerId: Number(formChargerId),
        connectorId: Number(formConnectorId || 1),
        scheduleType: formScheduleType,
        recurrence: formRecurrence,
        daysOfWeek: formRecurrence === 'custom' ? formDaysOfWeek : undefined,
        startTime: formScheduleType === 'departure_time' ? undefined : formStartTime,
        stopTime: formScheduleType === 'departure_time' ? undefined : formStopTime,
        departureTime: formScheduleType === 'departure_time' ? formDepartureTime : undefined,
        maxCurrentAmps: Number(formMaxAmps),
        maxPowerKw: Number(((formMaxAmps * 3 * 230) / 1000).toFixed(1)),
        targetSoc: formScheduleType === 'departure_time' ? Number(formTargetSoc) : undefined,
      };

      await api.post('/scheduled-charging', payload);
      toast.success('Charging schedule created!');
      setIsAddOpen(false);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await api.post(`/scheduled-charging/${id}/toggle`);
      toast.success(`Schedule status: ${res.data?.data?.status || 'updated'}`);
      fetchSchedules();
    } catch (err: any) {
      toast.error('Failed to toggle schedule');
    }
  };

  const handleExecuteNow = async (id: number, name: string) => {
    try {
      toast.info(`Starting "${name}" now...`);
      await api.post(`/scheduled-charging/${id}/execute-now`);
      toast.success(`Started charging!`);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start charge');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete schedule "${name}"?`)) return;
    try {
      await api.delete(`/scheduled-charging/${id}`);
      toast.success('Schedule deleted');
      fetchSchedules();
    } catch (err) {
      toast.error('Failed to delete schedule');
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#1e2228] to-[#252b33] p-4 rounded-2xl border border-white/10 text-white shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-md shadow-[#54a8c7]/20">
              <CalendarRange className="size-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Scheduled Charging</h2>
              <p className="text-[11px] text-slate-300">Off-peak rates & automated charging</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              applyPreset('night');
              setIsAddOpen(true);
            }}
            className="h-9 px-3 bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white text-xs font-semibold rounded-xl"
          >
            <Plus className="size-3.5 mr-1" /> Add
          </Button>
        </div>

        {/* Quick Presets Carousel */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
          <button
            onClick={() => {
              applyPreset('night');
              setIsAddOpen(true);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center transition-colors border border-white/5"
          >
            <Moon className="size-4 mx-auto text-indigo-400 mb-1" />
            <span className="text-[10px] font-bold block text-white">Night 23-07</span>
            <span className="text-[8px] text-slate-400">16A • Off-Peak</span>
          </button>

          <button
            onClick={() => {
              applyPreset('solar');
              setIsAddOpen(true);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center transition-colors border border-white/5"
          >
            <Sun className="size-4 mx-auto text-amber-400 mb-1" />
            <span className="text-[10px] font-bold block text-white">Solar Noon</span>
            <span className="text-[8px] text-slate-400">32A • 11:30-15:30</span>
          </button>

          <button
            onClick={() => {
              applyPreset('commute');
              setIsAddOpen(true);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center transition-colors border border-white/5"
          >
            <Car className="size-4 mx-auto text-emerald-400 mb-1" />
            <span className="text-[10px] font-bold block text-white">Commute</span>
            <span className="text-[8px] text-slate-400">07:30 Ready</span>
          </button>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Your Schedules ({schedules.length})
          </h3>
          <button
            onClick={fetchSchedules}
            disabled={loading}
            className="text-xs text-primary flex items-center gap-1 font-medium"
          >
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="bg-card p-6 rounded-2xl border border-border text-center space-y-3 shadow-xs">
            <Clock className="size-8 mx-auto text-muted-foreground opacity-40" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No active charging schedules</p>
              <p className="text-xs text-muted-foreground">
                Set up a schedule to automatically charge your EV during cheap overnight hours.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                applyPreset('night');
                setIsAddOpen(true);
              }}
              className="bg-primary text-primary-foreground rounded-xl text-xs"
            >
              <Plus className="size-3.5 mr-1" /> Create Schedule
            </Button>
          </div>
        ) : (
          schedules.map((schedule) => {
            const isExecuting = schedule.status === 'Executing';
            const isActive = schedule.status === 'Active';

            return (
              <div
                key={schedule.id}
                className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
                  isExecuting
                    ? 'bg-primary/5 border-primary shadow-sm'
                    : isActive
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-border/50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{schedule.name}</span>
                      {isExecuting && (
                        <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 animate-pulse">
                          CHARGING
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[9px] px-1.5 py-0">
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {schedule.charger?.name || `Charger #${schedule.chargerId}`}
                    </p>
                  </div>

                  <Switch
                    checked={schedule.status === 'Active' || schedule.status === 'Executing'}
                    onCheckedChange={() => handleToggle(schedule.id)}
                  />
                </div>

                {/* Time & Power Badges */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                    <Clock className="size-3.5 text-primary" />
                    <span>
                      {schedule.scheduleType === 'departure_time'
                        ? `Departure: ${schedule.departureTime}`
                        : `${schedule.startTime || '--:--'} ➔ ${schedule.stopTime || '--:--'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <span>{schedule.maxCurrentAmps}A</span>
                    <span>•</span>
                    <span className="capitalize">{schedule.recurrence}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExecuteNow(schedule.id, schedule.name)}
                    className="h-8 text-xs text-primary font-semibold hover:bg-primary/10 px-2 rounded-lg"
                  >
                    <Play className="size-3.5 mr-1 fill-current" /> Start Charge Now
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(schedule.id, schedule.name)}
                    className="size-8 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Schedule Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-card text-foreground rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarRange className="size-5 text-primary" />
              New Charging Schedule
            </DialogTitle>
            <DialogDescription className="text-xs">
              Automate your EV charging speed and time window.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSchedule} className="space-y-4 py-2">
            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('night')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  formStartTime === '23:00'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <Moon className="size-4 mx-auto mb-1" />
                <span className="text-[10px] block">Night Off-Peak</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('solar')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  formStartTime === '11:30'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <Sun className="size-4 mx-auto mb-1" />
                <span className="text-[10px] block">Solar Noon</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('commute')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  formScheduleType === 'departure_time'
                    ? 'bg-primary/15 border-primary text-primary font-bold'
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <Car className="size-4 mx-auto mb-1" />
                <span className="text-[10px] block">Commute Ready</span>
              </button>
            </div>

            {/* Schedule Name */}
            <div className="space-y-1">
              <Label className="text-xs">Schedule Title</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Daily Night Charge"
                required
                className="h-10 rounded-xl text-sm"
              />
            </div>

            {/* Target Charger */}
            <div className="space-y-1">
              <Label className="text-xs">Charger</Label>
              <Select value={formChargerId} onValueChange={setFormChargerId} required>
                <SelectTrigger className="h-10 rounded-xl text-xs">
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

            {/* Time Window */}
            {formScheduleType === 'departure_time' ? (
              <div className="space-y-1">
                <Label className="text-xs">Ready By (Departure Time)</Label>
                <Input
                  type="time"
                  value={formDepartureTime}
                  onChange={(e) => setFormDepartureTime(e.target.value)}
                  className="h-10 rounded-xl text-sm font-mono"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stop Time</Label>
                  <Input
                    type="time"
                    value={formStopTime}
                    onChange={(e) => setFormStopTime(e.target.value)}
                    className="h-10 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {/* Recurrence Days */}
            <div className="space-y-1.5">
              <Label className="text-xs">Repeat on Days</Label>
              <div className="flex justify-between gap-1">
                {DAYS.map((d) => {
                  const isSelected = formDaysOfWeek.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDayOfWeek(d.key)}
                      className={`size-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Limit */}
            <div className="space-y-2 p-3 rounded-xl bg-muted/40">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs font-semibold">Max Charging Rate</Label>
                <span className="font-bold text-primary font-mono">{formMaxAmps} A</span>
              </div>
              <Slider
                min={6}
                max={32}
                step={1}
                value={[formMaxAmps]}
                onValueChange={(val) => setFormMaxAmps(val[0])}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>Slow (6A)</span>
                <span>Standard (16A)</span>
                <span>Fast (32A)</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl text-sm"
              >
                {submitting ? 'Saving...' : 'Save Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
