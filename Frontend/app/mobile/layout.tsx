"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap, History, Map as MapIcon, Settings, Languages, Sun, Moon, CalendarRange } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { MobileAppShell } from "@/components/layout/MobileAppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();

  React.useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("ServiceWorker registration failed:", err);
      });
    }
  }, []);

  const getPageTitle = () => {
    if (pathname?.startsWith("/mobile/dashboard")) return "Dashboard";
    if (pathname?.startsWith("/mobile/chargers")) return "Chargers";
    if (pathname?.startsWith("/mobile/schedule")) return "Schedule";
    if (pathname?.startsWith("/mobile/transactions")) return "Transactions";
    if (pathname?.startsWith("/mobile/map")) return "Map";
    if (pathname?.startsWith("/mobile/settings")) return "Settings";
    return "App";
  };

  const navItems = [
    { name: "Dashboard", href: "/mobile/dashboard", icon: Home },
    { name: "Chargers", href: "/mobile/chargers", icon: Zap },
    { name: "Schedule", href: "/mobile/schedule", icon: CalendarRange },
    { name: "Activity", href: "/mobile/transactions", icon: History },
    { name: "Settings", href: "/mobile/settings", icon: Settings },
  ];

  return (
    <MobileAppShell>
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/80 px-4 py-3 flex items-center justify-between shadow-xs">
        <h1 className="text-xl font-bold text-foreground tracking-tight">{getPageTitle()}</h1>
        <div className="flex items-center gap-1.5">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60"
                title="Language"
              >
                <Languages className="w-4 h-4" />
                <span className="sr-only">Language switcher</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl min-w-[130px] shadow-lg border-border">
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage("en")}
                className={`cursor-pointer ${i18n.language === "en" ? "font-bold text-primary" : ""}`}
              >
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage("nl")}
                className={`cursor-pointer ${i18n.language === "nl" ? "font-bold text-primary" : ""}`}
              >
                🇳🇱 Nederlands
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => i18n.changeLanguage("fr")}
                className={`cursor-pointer ${i18n.language === "fr" ? "font-bold text-primary" : ""}`}
              >
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dark / Light Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 relative"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                <span className="text-[10px] tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </MobileAppShell>
  );
}
