"use client";

import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Moon,
  Sun,
  LogOut,
  User,
  HelpCircle,
  Languages,
  Settings,
  Search,
  Zap,
  Activity,
  ChevronRight,
  Shield,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTelemetryStore } from '@/store/useTelemetryStore';

export function Topbar() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const isConnected = useTelemetryStore((state) => state.isConnected);

  // Format breadcrumbs dynamically
  const pathSegments = (pathname || '').split('/').filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment, index) => {
    const url = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;
    const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    return { title, url, isLast };
  });

  return (
    <header className="h-16 glass-header border-b border-border/70 flex items-center justify-between px-6 sticky top-0 z-20 w-full shadow-2xs">
      {/* Left: Breadcrumbs & Status */}
      <div className="flex items-center gap-4 min-w-0">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors"
          >
            <span>CPMS</span>
          </Link>

          {breadcrumbItems.length > 0 ? (
            breadcrumbItems.map((item, idx) => (
              <div key={item.url} className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                {item.isLast ? (
                  <span className="font-semibold text-foreground truncate max-w-[200px] md:max-w-xs">
                    {item.title}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="text-muted-foreground hover:text-foreground truncate transition-colors"
                  >
                    {item.title}
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5 text-muted-foreground/50" />
              <span className="font-semibold text-foreground">Dashboard</span>
            </div>
          )}
        </nav>

        {/* Live WebSocket Status Chip */}
        <div className="hidden lg:flex items-center">
          <Badge
            variant={isConnected ? 'soft-success' : 'soft-warning'}
            className="gap-1.5 text-[11px] font-semibold py-0.5"
          >
            <span
              className={`size-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {isConnected ? t('topbar.liveSyncActive', 'Live Sync Active') : t('topbar.connecting', 'Connecting...')}
          </Badge>
        </div>
      </div>

      {/* Right: Quick Actions, Language, Theme, Profile */}
      <div className="flex items-center gap-2.5">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-xl text-muted-foreground hover:text-foreground"
              title={t('topbar.language', 'Language')}
            >
              <Languages className="size-4" />
              <span className="sr-only">{t('topbar.language', 'Language switcher')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl min-w-[140px]">
            <DropdownMenuItem
              onClick={() => i18n.changeLanguage('en')}
              className={i18n.language === 'en' ? 'font-bold text-primary' : ''}
            >
              🇬🇧 English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => i18n.changeLanguage('nl')}
              className={i18n.language === 'nl' ? 'font-bold text-primary' : ''}
            >
              🇳🇱 Nederlands
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => i18n.changeLanguage('fr')}
              className={i18n.language === 'fr' ? 'font-bold text-primary' : ''}
            >
              🇫🇷 Français
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dark / Light Theme Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          title={t('topbar.toggleTheme', 'Toggle Theme')}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('topbar.toggleTheme')}</span>
        </Button>

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2.5 rounded-full pl-2 pr-3 py-1.5 h-9 bg-card border-border/80 hover:border-primary/50 shadow-2xs transition-all"
            >
              <div className="size-6 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-[11px] font-bold text-white shadow-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-semibold max-w-[120px] truncate">
                {user?.email?.split('@')[0] || 'Admin'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-xl">
            <div className="px-2 py-2 flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">
                  {user?.email || 'Administrator'}
                </span>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {user?.role || 'Operator'}
                </span>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/settings" className="w-full cursor-pointer flex items-center gap-2 rounded-lg py-2">
                <Settings className="size-4 text-muted-foreground" />
                <span>{t('nav.settings', 'Settings')}</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/ocpp" className="w-full cursor-pointer flex items-center gap-2 rounded-lg py-2">
                <Activity className="size-4 text-muted-foreground" />
                <span>{t('topbar.diagnosticLogs', 'OCPP Diagnostic Logs')}</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg py-2 flex items-center gap-2"
            >
              <LogOut className="size-4" />
              <span>{t('topbar.logout', 'Sign Out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
