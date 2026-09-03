"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ChargerForm } from "@/components/chargers/ChargerForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export default function NewChargerPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Link href="/chargers">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Chargers
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add New Charger</h1>
            <p className="text-muted-foreground">Register an OCPP-compliant charging point to the network.</p>
          </div>
        </div>
        <Suspense fallback={<div>Loading form...</div>}>
          <ChargerForm />
        </Suspense>
      </div>
    </AppShell>
  );
}
