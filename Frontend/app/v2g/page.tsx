"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from '@/components/layout/AppShell';
import { V2GSoCSlider } from '@/components/energy/V2GSoCSlider';
import { FleetBatteryCapacityWidget } from '@/components/energy/FleetBatteryCapacityWidget';
import { Radio } from 'lucide-react';

export default function V2GPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
              <Radio className="size-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              {t('v2g.title', 'Vehicle-to-Grid (V2G) Orchestration')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('v2g.subtitle', 'Bi-directional charging controls, minimum state-of-charge reserve thresholds, and grid arbitrage.')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FleetBatteryCapacityWidget />
          <V2GSoCSlider />
        </div>
      </div>
    </AppShell>
  );
}
