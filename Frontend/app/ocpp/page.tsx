"use client";

import { AppShell } from "@/components/layout/AppShell";
import { OcppLogViewer } from "@/components/ocpp/OcppLogViewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TerminalSquare, Zap, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OcppManagementPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <TerminalSquare className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                OCPP Protocol Console
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time WebSocket RPC telemetry, raw packet inspection, and protocol diagnostics.
            </p>
          </div>
          <Link href="/chargers">
            <Button variant="outline" className="rounded-xl">
              <Zap className="size-4 mr-1.5 text-[#54a8c7]" /> Go to Charger Fleet
            </Button>
          </Link>
        </div>

        {/* Developer Info Card */}
        <div className="rounded-2xl bg-[#54a8c7]/10 border border-[#54a8c7]/25 p-4 flex items-start gap-3 text-sm text-foreground">
          <div className="size-8 rounded-xl bg-[#54a8c7]/20 text-[#54a8c7] flex items-center justify-center shrink-0 mt-0.5">
            <Activity className="size-4 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">Real-time WebSocket Message Stream</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Provides direct visibility into the OCPP 1.6-J & 2.0.1 JSON messages traveling over WebSocket. 
              Use the Charger Detail pages to send specific RemoteStart, RemoteStop, and TriggerMessage commands.
            </p>
          </div>
        </div>

        <OcppLogViewer />
      </div>
    </AppShell>
  );
}
