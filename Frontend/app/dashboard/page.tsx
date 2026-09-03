"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from '@/components/layout/AppShell';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { LiveSessionsTable } from '@/components/dashboard/LiveSessionsTable';
import { ConnectorDistribution } from '@/components/dashboard/ConnectorDistribution';
import { LocationsMap } from '@/components/dashboard/LocationsMap';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, ArrowUpRight, Activity, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isMobile) {
      router.push('/mobile/dashboard');
    }
  }, [mounted, isMobile, router]);

  if (!mounted || isMobile) {
    return null;
  }

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('dashboard.goodMorning', 'Good morning')
      : hour < 18
      ? t('dashboard.goodAfternoon', 'Good afternoon')
      : t('dashboard.goodEvening', 'Good evening');

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* SandBox Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e2228] via-[#262b32] to-[#1e2228] text-white p-6 sm:p-8 shadow-xl border border-white/10">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 size-64 rounded-full bg-[#54a8c7]/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-10 size-48 rounded-full bg-[#3f78e0]/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="soft-primary" className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 text-xs font-semibold py-0.5 px-3">
                  <Sparkles className="size-3 mr-1" /> {t('dashboard.enterpriseBadge', 'Enterprise CPMS')}
                </Badge>
                <span className="text-xs text-white/60">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-white">
                {greeting}, <span className="text-[#54a8c7]">{user?.email?.split('@')[0] || 'Operator'}</span>
              </h1>
              <p className="text-sm text-white/70 max-w-xl">
                {t('dashboard.heroSubtitle', 'Real-time overview of your EV charging network, active sessions, grid telemetry, and dynamic load balancing.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/chargers">
                <Button variant="outline" className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-none hover:text-white">
                  <Zap className="size-4 text-[#54a8c7]" />
                  {t('dashboard.chargerFleet', 'Charger Fleet')}
                </Button>
              </Link>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <Link href="/chargers/new">
                  <Button className="rounded-xl bg-[#54a8c7] hover:bg-[#54a8c7]/90 text-white shadow-md shadow-[#54a8c7]/30">
                    <Plus className="size-4 mr-1" /> {t('dashboard.addCharger', 'Add Charger')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <KpiCards />

        {/* Middle Section: Map & Connector Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <LocationsMap />
          </div>
          <div className="lg:col-span-2">
            <ConnectorDistribution />
          </div>
        </div>

        {/* Live Charging Sessions Table */}
        <div>
          <LiveSessionsTable />
        </div>
      </div>
    </AppShell>
  );
}
