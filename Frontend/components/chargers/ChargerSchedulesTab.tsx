'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

interface ChargerSchedulesTabProps {
  chargerId: number;
  chargerName: string;
  isOnline: boolean;
}

export function ChargerSchedulesTab({ chargerId, chargerName, isOnline }: ChargerSchedulesTabProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/scheduled-charging', { params: { chargerId } });
      const dataList = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setSchedules(dataList);
    } catch (err: any) {
      toast.error('Failed to load charger schedules');
    } finally {
      setLoading(false);
    }
  }, [chargerId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

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
      toast.info(`Executing schedule "${name}"...`);
      await api.post(`/scheduled-charging/${id}/execute-now`);
      toast.success(`Schedule "${name}" started successfully`);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start scheduled charge');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this scheduled charging plan?')) return;
    try {
      await api.delete(`/scheduled-charging/${id}`);
      toast.success('Schedule deleted');
      fetchSchedules();
    } catch (err) {
      toast.error('Failed to delete schedule');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarRange className="size-5 text-[#54a8c7]" />
              Scheduled Charging Plans
            </CardTitle>
            <CardDescription>
              Configured automated charging schedules and off-peak windows for {chargerName}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSchedules} disabled={loading}>
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Link href="/scheduled-charging">
              <Button size="sm" className="bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white">
                <Plus className="size-3.5 mr-1.5" /> Manage All Schedules
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="p-8 text-center space-y-3 bg-muted/20 rounded-xl border border-dashed">
              <Clock className="size-8 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">No scheduled charging plans for this charger</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Set up recurring off-peak night charging or solar noon schedules to optimize electricity costs.
              </p>
              <Link href="/scheduled-charging">
                <Button size="sm" variant="outline">
                  <Plus className="size-3.5 mr-1.5" /> Create Schedule
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-xl border transition-all ${
                    s.status === 'Executing'
                      ? 'bg-[#54a8c7]/10 border-[#54a8c7]/40 shadow-sm'
                      : s.status === 'Active'
                      ? 'bg-card border-border'
                      : 'bg-muted/20 border-border/50 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{s.name}</span>
                        {s.status === 'Executing' && (
                          <Badge className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 text-[10px] animate-pulse">
                            CHARGING
                          </Badge>
                        )}
                        {s.status === 'Active' && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                            ACTIVE
                          </Badge>
                        )}
                        {s.status === 'Paused' && (
                          <Badge variant="soft-secondary" className="text-[10px]">
                            PAUSED
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Clock className="size-3 text-[#54a8c7]" />
                        <span>
                          {s.scheduleType === 'departure_time'
                            ? `Departure: ${s.departureTime}`
                            : `${s.startTime || '--:--'} ➔ ${s.stopTime || '--:--'}`}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{s.recurrence}</span>
                      </div>
                    </div>
                    <Switch
                      checked={s.status === 'Active' || s.status === 'Executing'}
                      onCheckedChange={() => handleToggle(s.id)}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {s.maxCurrentAmps}A ({s.maxPowerKw} kW)
                      </Badge>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        Ch {s.connectorId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExecuteNow(s.id, s.name)}
                        className="h-7 text-xs text-[#54a8c7]"
                      >
                        <Play className="size-3 mr-1 fill-current" /> Start Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(s.id)}
                        className="size-7 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
