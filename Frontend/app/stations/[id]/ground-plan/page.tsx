"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { GroundPlanBuilder } from "@/components/stations/GroundPlanBuilder";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function GroundPlanPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [station, setStation] = useState<any>(null);
  const [connectors, setConnectors] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [stationRes, chargersRes] = await Promise.all([
          api.get(`/stations/${id}`),
          api.get(`/stations/${id}/chargers`)
        ]);

        setStation(stationRes.data?.data || stationRes.data);

        // Extract all connectors from station's chargers
        const chargers = Array.isArray(chargersRes.data?.data) ? chargersRes.data.data : (Array.isArray(chargersRes.data) ? chargersRes.data : []);
        const allConnectors = chargers.flatMap((c: any) => {
          if (c.evses && Array.isArray(c.evses)) {
            return c.evses.flatMap((e: any) => e.connectors || []);
          }
          if (c.connectors && Array.isArray(c.connectors)) {
            return c.connectors;
          }
          return [];
        });
        setConnectors(allConnectors);

      } catch (err) {
        console.error(err);
      }
    }
    if (id) loadData();
  }, [id]);

  if (!station) return <AppShell><div className="p-8">Loading...</div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ground Plan: {station.station_name || station.name || `Station #${id}`}</h1>
            <p className="text-muted-foreground">Map chargers to physical parking spots.</p>
          </div>
        </div>

        <GroundPlanBuilder stationId={id} connectors={connectors} />
      </div>
    </AppShell>
  );
}
