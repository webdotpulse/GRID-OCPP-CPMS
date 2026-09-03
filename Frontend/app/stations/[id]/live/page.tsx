"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { GroundPlanLiveView } from "@/components/stations/GroundPlanLiveView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StationLiveViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [station, setStation] = useState<any>(null);

  useEffect(() => {
    async function fetchStation() {
      try {
        const res = await api.get(`/stations/${id}`);
        setStation(res.data?.data || res.data);
      } catch (err) {
        console.error(err);
      }
    }
    if (id) fetchStation();
  }, [id]);

  if (!station) return <AppShell>Loading...</AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold tracking-tight">The Charge Grid: {station.station_name}</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Monitor className="h-3 w-3 mr-1" /> Live
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">Real-time parking ground plan & status monitoring.</p>
            </div>
          </div>

          <div className="flex space-x-2 text-xs">
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Charging</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-sky-500 mr-2"></span> Available</div>
            <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> Unavailable</div>
          </div>
        </div>

        <GroundPlanLiveView stationId={id} />
      </div>
    </AppShell>
  );
}
