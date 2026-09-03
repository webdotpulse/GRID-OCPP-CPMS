import { AppShell } from "@/components/layout/AppShell";
import { StationForm } from "@/components/stations/StationForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export default function NewStationPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Link href="/stations">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Locations
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Location</h1>
            <p className="text-muted-foreground">Register a new physical location for your EV chargers.</p>
          </div>
        </div>
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Loading location form...</div>}>
          <StationForm />
        </Suspense>
      </div>
    </AppShell>
  );
}
