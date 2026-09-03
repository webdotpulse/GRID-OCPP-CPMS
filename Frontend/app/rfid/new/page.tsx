import { AppShell } from "@/components/layout/AppShell";
import { RfidForm } from "@/components/rfid/RfidForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewRfidPage() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
          <Link href="/rfid">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to RFID Tags
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Register RFID Tag</h1>
            <p className="text-muted-foreground">Authorize a new NFC/RFID card for charging access.</p>
          </div>
        </div>
        <RfidForm />
      </div>
    </AppShell>
  );
}
