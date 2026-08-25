"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap, Map as MapIcon, Settings, Bell } from "lucide-react";
import { MobileAppShell } from "@/components/layout/MobileAppShell";
import { useAuth } from "@/hooks/useAuth";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const getPageTitle = () => {
    if (pathname?.startsWith("/mobile/dashboard")) return "Dashboard";
    if (pathname?.startsWith("/mobile/chargers")) return "Chargers";
    if (pathname?.startsWith("/mobile/map")) return "Map";
    if (pathname?.startsWith("/mobile/settings")) return "Settings";
    return "App";
  };

  const navItems = [
    { name: "Dashboard", href: "/mobile/dashboard", icon: Home },
    { name: "Chargers", href: "/mobile/chargers", icon: Zap },
    { name: "Map", href: "/mobile/map", icon: MapIcon },
    { name: "Settings", href: "/mobile/settings", icon: Settings },
  ];

  return (
    <MobileAppShell>
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
        <button className="p-2 relative rounded-full hover:bg-gray-100 transition-colors">
          <Bell className="w-6 h-6 text-gray-600" />
          {/* Example notification badge
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          */}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? "fill-blue-100/50" : ""}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </MobileAppShell>
  );
}
