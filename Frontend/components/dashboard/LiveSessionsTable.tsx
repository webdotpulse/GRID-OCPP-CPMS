"use client";

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { Zap, Activity, ArrowRight, BatteryCharging, Radio } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function LiveSessionsTable() {
  const { t } = useTranslation();
  const sessions = useTelemetryStore((state) => state.sessions);
  const isSessionsLoading = useTelemetryStore((state) => state.isSessionsLoading);
  const fetchSessions = useTelemetryStore((state) => state.fetchSessions);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
              <Radio className="size-4 animate-pulse" />
            </div>
            <CardTitle>{t('dashboard.liveSessions', 'Live Charging Sessions')}</CardTitle>
          </div>
          <CardDescription>
            {t('dashboard.liveSessionsDesc', 'Real-time power delivery & active transaction telemetry')}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="soft-success" className="gap-1.5 px-3 py-1 text-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {sessions.length} {t('dashboard.activeSessions', 'Active Sessions')}
          </Badge>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              {t('common.details', 'View All')} <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isSessionsLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
            <div className="size-8 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium">{t('common.loading', 'Loading...')}</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-2">
            <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
              <Zap className="size-6" />
            </div>
            <p className="font-semibold text-sm text-foreground">{t('dashboard.noActiveSessions', 'No Active Sessions')}</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t('dashboard.systemOverviewDesc', 'All charge points are currently idle or awaiting EV connection.')}
            </p>
          </div>
        ) : (
          <div className="p-4 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn ID</TableHead>
                  <TableHead>Charge Point</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Live Power</TableHead>
                  <TableHead className="text-right">Energy Delivered</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.transactionId} className="group hover:bg-[#54a8c7]/5">
                    <TableCell className="font-mono font-bold text-xs text-foreground">
                      #{session.transactionId}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/chargers/${session.chargerId}`}
                        className="font-semibold text-foreground hover:text-[#54a8c7] flex items-center gap-1.5 transition-colors"
                      >
                        <Zap className="size-3.5 text-[#54a8c7]" />
                        {session.chargerName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-medium bg-muted/50 border-border/80">
                        {session.connectorName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-[#3f78e0]">
                      {session.currentPower > 0 ? `${(session.currentPower / 1000).toFixed(2)} kW` : '0.00 kW'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-[#54a8c7]">
                      {session.energyConsumed > 0 ? `${(session.energyConsumed / 1000).toFixed(2)} kWh` : 'Initialising...'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="soft-success" className="text-[10px] font-bold uppercase tracking-wider py-0.5">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                        Charging
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
