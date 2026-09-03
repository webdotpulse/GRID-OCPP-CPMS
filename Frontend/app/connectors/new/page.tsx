"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ConnectorForm } from "@/components/connectors/ConnectorForm";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Note: Using 'a' tag instead of Link with next/navigation because 'router.back()' is preferred 
// if user arrived from a specific charger page, but fallbackLink provides a safe default.
export default function NewConnectorPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Button 
             variant="ghost" 
             size="sm" 
             className="-ml-4 text-muted-foreground"
             onClick={() => window.history.back()}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add physical Channel</h1>
            <p className="text-muted-foreground">Register an individual charge point channel to a piece of hardware.</p>
          </div>
        </div>
        <ConnectorForm />
      </div>
    </AppShell>
  );
}
