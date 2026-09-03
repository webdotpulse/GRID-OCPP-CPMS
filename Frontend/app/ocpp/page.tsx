"use client";

import { AppShell } from "@/components/layout/AppShell";
import { OcppPacketInspector } from "@/components/ocpp/OcppPacketInspector";
import { TerminalSquare, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OcppManagementPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[#54a8c7] to-[#3f78e0] text-white flex items-center justify-center shadow-md shadow-[#54a8c7]/20">
                <TerminalSquare className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                OCPP Packet Inspector
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Wireshark-inspired deep packet inspection, round-trip latency tracking, schema validation, and raw JSON-RPC frame analysis.
            </p>
          </div>
          <Link href="/chargers">
            <Button variant="outline" className="rounded-xl border-border/70 hover:bg-muted text-foreground">
              <Zap className="size-4 mr-1.5 text-[#54a8c7]" /> Go to Charger Fleet
            </Button>
          </Link>
        </div>

        {/* Packet Inspector Component */}
        <OcppPacketInspector />
      </div>
    </AppShell>
  );
}
