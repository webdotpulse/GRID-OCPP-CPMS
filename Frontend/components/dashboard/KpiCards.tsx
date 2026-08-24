"use client";

import { logger } from "@/lib/logger";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Activity, Banknote, BatteryCharging, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface OverviewMetrics {
  totalChargers: number;
  activeSessions: number;
  energyToday: number;
  revenueToday: number;
}

export function KpiCards() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await api.get('/dashboard/overview');
        setMetrics(response.data);
      } catch (error) {
        logger.error('Failed to fetch overview metrics', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      title: t('dashboard.totalChargers', 'Total Chargers'),
      value: metrics?.totalChargers ?? 0,
      icon: Zap,
      iconBg: 'bg-[#54a8c7]/15 text-[#54a8c7] dark:bg-[#54a8c7]/20',
      borderAccent: 'card-border-top-primary',
      description: t('dashboard.totalChargersDesc', 'Registered fleet units'),
      pill: 'Online Ready',
      pillVariant: 'soft-primary' as const,
    },
    {
      title: t('dashboard.activeSessions', 'Active Sessions'),
      value: metrics?.activeSessions ?? 0,
      icon: Activity,
      iconBg: 'bg-[#45c4a0]/15 text-[#45c4a0] dark:bg-[#45c4a0]/20',
      borderAccent: 'card-border-top-success',
      description: t('dashboard.activeSessionsDesc', 'Live charging in progress'),
      pill: 'Live',
      pillVariant: 'soft-success' as const,
    },
    {
      title: t('dashboard.energyToday', 'Energy Today'),
      value: `${((metrics?.energyToday || 0) / 1000).toFixed(2)} kWh`,
      icon: BatteryCharging,
      iconBg: 'bg-[#3f78e0]/15 text-[#3f78e0] dark:bg-[#3f78e0]/20',
      borderAccent: '',
      description: t('dashboard.energyTodayDesc', 'Delivered since midnight'),
      pill: '+12.4%',
      pillVariant: 'soft-primary' as const,
    },
    {
      title: t('dashboard.revenueToday', 'Revenue Today'),
      value: `€${metrics?.revenueToday?.toFixed(2) || '0.00'}`,
      icon: Banknote,
      iconBg: 'bg-[#fab758]/15 text-[#fab758] dark:bg-[#fab758]/20',
      borderAccent: '',
      description: t('dashboard.revenueTodayDesc', 'Billed tariff revenue'),
      pill: 'EUR',
      pillVariant: 'soft-warning' as const,
    },
  ];

  if (isLoading && !metrics) {
    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 bg-muted rounded-xl"></div>
                <div className="h-5 w-16 bg-muted rounded-full"></div>
              </div>
              <div className="h-8 w-24 bg-muted rounded-lg mb-2"></div>
              <div className="h-4 w-32 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            hoverLift
            className={`relative overflow-hidden ${card.borderAccent}`}
          >
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <div className={`size-11 rounded-2xl flex items-center justify-center shadow-xs ${card.iconBg}`}>
                  <Icon className="size-5.5" />
                </div>
                <Badge variant={card.pillVariant} className="text-[11px] font-semibold py-0.5 px-2.5">
                  {card.pill}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {card.title}
                </p>
                <div className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  {card.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
