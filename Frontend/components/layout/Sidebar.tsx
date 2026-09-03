"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  MapPin,
  CreditCard,
  Settings,
  TerminalSquare,
  WalletCards,
  Zap,
  Users,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Globe,
  Activity,
  Monitor,
  Car,
  AlertCircle,
  Cpu,
  ShieldCheck,
  Radio,
  FileText,
  CalendarClock,
  CalendarRange,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  key: string;
  path: string;
  icon: any;
  adminOnly?: boolean;
  badge?: string | number;
}

interface NavSection {
  title?: string;
  titleKey?: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [liveViewStationId, setLiveViewStationId] = useState<string | null>(null);

  useEffect(() => {
    const checkUserFeatures = async () => {
      if (!user) return;
      try {
        if (user.role !== 'admin' && user.role !== 'superadmin') {
          const resStations = await api.get('/stations');
          const stations = resStations.data?.data || resStations.data || [];
          const stationWithPlan = stations.find((s: any) => s.isGroundPlanEnabled);
          if (stationWithPlan) {
            setLiveViewStationId(stationWithPlan.id.toString());
          }
        }
      } catch (error) {
        // Silently handle background feature detection
      }
    };
    checkUserFeatures();
  }, [user]);

  const navSections: NavSection[] = [
    {
      items: [
        { key: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard },
        ...(liveViewStationId && user?.role !== 'admin' && user?.role !== 'superadmin'
          ? [{ key: 'nav.liveView', path: `/stations/${liveViewStationId}/live`, icon: Monitor }]
          : []),
      ],
    },
    {
      title: 'Infrastructure',
      titleKey: 'nav.sections.infrastructure',
      items: [
        { key: 'nav.chargers', path: '/chargers', icon: Zap },
        { key: 'nav.locations', path: '/stations', icon: MapPin },
        { key: 'nav.chargeGroups', path: '/charge-groups', icon: Cpu },
      ],
    },
    {
      title: 'Fleet & Access',
      titleKey: 'nav.sections.fleetAndAccess',
      items: [
        { key: 'nav.rfidTags', path: '/rfid', icon: CreditCard },
        { key: 'nav.scheduledCharging', path: '/scheduled-charging', icon: CalendarRange },
        { key: 'nav.reservations', path: '/reservations', icon: CalendarClock },
        { key: 'nav.transactions', path: '/transactions', icon: ReceiptText },
        { key: 'nav.invoices', path: '/invoices', icon: FileText },
        { key: 'nav.tariffs', path: '/tariffs', icon: WalletCards },
      ],
    },
    {
      title: 'Operations',
      titleKey: 'nav.sections.operations',
      items: [
        { key: 'nav.customers', path: '/users', icon: Users, adminOnly: true },
        { key: 'nav.simulator', path: '/simulator', icon: Cpu, adminOnly: true },
        { key: 'nav.autoHealPlaybooks', path: '/auto-heal-playbooks', icon: Sparkles },
        { key: 'nav.hardwareAtRisk', path: '/hardware-at-risk', icon: AlertCircle },
        { key: 'nav.ocppConsole', path: '/ocpp', icon: TerminalSquare, adminOnly: true },
        { key: 'nav.documentation', path: '/documentation', icon: BookOpen },
        { key: 'nav.settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex flex-col h-screen transition-all duration-300 ease-in-out select-none",
        "bg-[#1e2228] text-[#f6f7f9] border-r border-white/10 shadow-xl",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className={cn("h-16 flex items-center border-b border-white/10 px-4", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed ? (
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-md shadow-[#54a8c7]/20 group-hover:scale-105 transition-transform duration-200">
              <Zap className="size-5 text-white fill-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-heading font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                OCPP <span className="text-[#54a8c7]">CPMS</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#aab0bc]">
                The Charge Grid
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] flex items-center justify-center shadow-md shadow-[#54a8c7]/20">
            <Zap className="size-5 text-white fill-white" />
          </Link>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "size-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors",
            isCollapsed && "hidden"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10">
        {navSections.map((section, sIdx) => {
          const visibleItems = section.items.filter(
            (item) => !item.adminOnly || (user?.role === 'admin' || user?.role === 'superadmin')
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title || sIdx} className="space-y-1">
              {!isCollapsed && section.title && (
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#60697b] mb-1.5">
                  {section.titleKey ? t(section.titleKey, section.title) : section.title}
                </p>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive =
                    item.path === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname?.startsWith(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-all duration-150",
                        isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "px-3",
                        isActive
                          ? "bg-[#54a8c7]/15 text-[#54a8c7] font-semibold"
                          : "text-[#aab0bc] hover:bg-white/5 hover:text-white"
                      )}
                      title={isCollapsed ? t(item.key, item.key) : undefined}
                    >
                      {/* Active Left Indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[#54a8c7]" />
                      )}

                      <Icon
                        className={cn(
                          "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                          isActive ? "text-[#54a8c7]" : "text-[#aab0bc] group-hover:text-white"
                        )}
                      />

                      {!isCollapsed && (
                        <span className="truncate flex-1">
                          {t(item.key, item.key.replace('nav.', ''))}
                        </span>
                      )}

                      {!isCollapsed && item.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#54a8c7]/20 text-[#54a8c7]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse button when collapsed */}
      {isCollapsed && (
        <div className="p-3 border-t border-white/10 flex justify-center">
          <button
            onClick={() => setIsCollapsed(false)}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Footer Profile & Version */}
      {!isCollapsed && (
        <div className="p-3.5 border-t border-white/10 bg-[#171a1f]/60 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="size-8 rounded-full bg-gradient-to-br from-[#54a8c7]/30 to-[#3f78e0]/30 border border-[#54a8c7]/40 flex items-center justify-center text-xs font-bold text-[#54a8c7]">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-white truncate">
                {user?.email || 'Administrator'}
              </span>
              <span className="text-[10px] text-[#aab0bc] capitalize flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {user?.role || 'Operator'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-1 text-[10px] text-[#60697b] font-medium pt-1 border-t border-white/5">
            <span>SandBox v3.4</span>
            <span className="text-emerald-400 font-semibold">OCPP 1.6J / 2.0.1</span>
          </div>
        </div>
      )}
    </aside>
  );
}
