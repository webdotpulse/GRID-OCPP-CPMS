"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Wrench, Activity, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";

export default function HardwareAtRiskPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const response = await api.get("/diagnostics");
        let eventsData: any[] = [];
        if (Array.isArray(response.data)) {
          eventsData = response.data;
        } else if (response.data && Array.isArray(response.data.events)) {
          eventsData = response.data.events;
        } else if (response.data && Array.isArray(response.data.data)) {
          eventsData = response.data.data;
        }
        setEvents(eventsData);
      } catch (error) {
        console.error("Failed to fetch diagnostics", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-1/4 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  const chargersAtRisk = new Set(events.filter(e => e.type !== "AutoHealAttempt" && !e.resolved).map(e => e.chargerId));
  const requiresMaintenance = events.filter(e => chargersAtRisk.has(e.chargerId) && e.type !== "AutoHealAttempt");
  const autoHealAttempts = events.filter(e => e.type === "AutoHealAttempt");

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#e2626b]/15 text-[#e2626b] flex items-center justify-center">
                <ShieldAlert className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                {t('hardwareAtRisk.title', 'Hardware Health & Predictive Maintenance')}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('hardwareAtRisk.subtitle', 'Automated fault detection, self-healing reboot logs, and technician work orders.')}
            </p>
          </div>
          <Link href="/auto-heal-playbooks">
            <Button className="bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white text-xs gap-1.5 shadow-md shadow-[#54a8c7]/20 font-semibold">
              <Sparkles className="size-4" />
              Vendor Auto-Heal Playbooks
            </Button>
          </Link>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Healthy Operations */}
          <Card hoverLift className="card-border-top-success">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4.5" /> {t('hardwareAtRisk.fleetHealth', 'Fleet Health')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-heading font-extrabold text-foreground">
                {chargersAtRisk.size === 0
                  ? t('hardwareAtRisk.fullyOperational', '100% Operational')
                  : `${chargersAtRisk.size} ${t('hardwareAtRisk.unitsAtRisk', 'Units At Risk')}`}
              </div>
              <p className="text-xs text-muted-foreground">
                Continuous automated heartbeat & error code monitoring.
              </p>
            </CardContent>
          </Card>

          {/* Auto Heal Invocations */}
          <Card hoverLift className="card-border-top-primary">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#54a8c7]">
                <Sparkles className="size-4.5" /> {t('hardwareAtRisk.autoHealInterventions', 'Auto-Heal Interventions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-heading font-extrabold text-foreground">
                {autoHealAttempts.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic SoftReset & UnlockConnector attempts.
              </p>
            </CardContent>
          </Card>

          {/* Maintenance Work Orders */}
          <Card hoverLift>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#fab758]">
                <Wrench className="size-4.5" /> {t('hardwareAtRisk.physicalService', 'Physical Service')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-heading font-extrabold text-foreground">
                {requiresMaintenance.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active alerts requiring on-site technician dispatch.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Events Log Card */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('hardwareAtRisk.recentDiagnostics', 'Recent Diagnostics & Auto-Healing Stream')}</CardTitle>
                <CardDescription>{t('hardwareAtRisk.recentDiagnosticsDesc', 'Live diagnostic alerts and automated remediation logs')}</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {events.length} {t('hardwareAtRisk.recordedEvents', 'Recorded Events')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-2">
                <CheckCircle2 className="size-10 text-emerald-500/50" />
                <p className="font-bold text-sm text-foreground">{t('hardwareAtRisk.noEvents', 'All Hardware Operational')}</p>
                <p className="text-xs text-muted-foreground">{t('hardwareAtRisk.noEventsDesc', 'No hardware risk events or anomalies detected.')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 p-4 pt-0">
                {events.slice(0, 20).map((ev, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4 hover:bg-muted/20 rounded-xl px-3 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-xl flex items-center justify-center ${
                        ev.type === 'AutoHealAttempt' ? 'bg-[#54a8c7]/15 text-[#54a8c7]' : 'bg-[#e2626b]/15 text-[#e2626b]'
                      }`}>
                        {ev.type === 'AutoHealAttempt' ? <Sparkles className="size-4" /> : <AlertCircle className="size-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {ev.type === 'AutoHealAttempt' ? 'Auto-Heal Remote Reset' : (ev.description || 'Hardware Fault')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Charger ID: <span className="font-mono font-semibold text-foreground">#{ev.chargerId}</span> • {ev.timestamp ? format(new Date(ev.timestamp), 'dd MMM yyyy, HH:mm:ss') : 'Just now'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Badge variant={ev.resolved ? 'soft-success' : 'soft-danger'} className="text-[10px] font-bold uppercase">
                        {ev.resolved ? 'Resolved' : 'Active Alert'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
