"use client";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OcpiTab } from "@/components/roaming/OcpiTab";
import { OicpTab } from "@/components/roaming/OicpTab";
import { SettlementTab } from "@/components/roaming/SettlementTab";
import { TestSuiteTab } from "@/components/roaming/TestSuiteTab";
import { AlertCircle, Globe, Shield, PlayCircle } from "lucide-react";

export default function RoamingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
          <div className="size-8 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Loading roaming settings...</span>
        </div>
      </AppShell>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
          <Shield className="size-12 text-destructive/60" />
          <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Administrator permissions are required to access OCPI & OICP roaming configurations.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-[#45c4a0]/15 text-[#45c4a0] flex items-center justify-center">
              <Globe className="size-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
              Roaming & Interoperability
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure OCPI 2.2.1 and Hubject OICP protocols for automated roaming e-clearing.
          </p>
        </div>

        <Tabs defaultValue="ocpi" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ocpi">OCPI 2.2.1</TabsTrigger>
            <TabsTrigger value="oicp">OICP (Hubject)</TabsTrigger>
            <TabsTrigger value="settlement">Settlement Visualizer</TabsTrigger>
            <TabsTrigger value="test-suite" className="flex items-center gap-1.5">
              <PlayCircle className="size-3.5" />
              Test CPO & eMSP Suite
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ocpi">
            <OcpiTab />
          </TabsContent>
          <TabsContent value="oicp">
            <OicpTab />
          </TabsContent>
          <TabsContent value="settlement">
            <SettlementTab />
          </TabsContent>
          <TabsContent value="test-suite">
            <TestSuiteTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
