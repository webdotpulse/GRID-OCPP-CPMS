"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { StationForm } from "@/components/stations/StationForm";
import { api } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EditStationPage() {
  const { id } = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStation = async () => {
      try {
        const response = await api.get(`/stations/${id}`);
        const station = response.data?.data || response.data;
        if (station) {
          setInitialData({
            ...station,
            latitude: Number(station.latitude),
            longitude: Number(station.longitude),
          });
        }
      } catch (error) {
        logger.error("Failed to fetch station", error);
        alert("Failed to load station.");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchStation();
  }, [id]);

  return (
    <AppShell>
      <div className="mb-6 space-y-4">
        <Link href={`/stations/${id}`}>
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Station
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Charging Station</h1>
          <p className="text-muted-foreground">Update details for this location.</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading...</div>
      ) : initialData ? (
        <StationForm initialData={initialData} />
      ) : (
        <div className="text-red-500">Failed to load station data.</div>
      )}
    </AppShell>
  );
}
