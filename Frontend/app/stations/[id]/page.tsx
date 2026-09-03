"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Edit, MapPin, Phone, User, ExternalLink, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StationDetail {
  id: number;
  station_name: string;
  street_name: string;
  city: string;
  state: string;
  postal_code: string;
  status: string;
  latitude: number;
  longitude: number;
  on_site_person_name: string;
  on_site_contact_details: string;
  emergency_contact: string;
  maxPower?: number | null;
  maxAmperage?: number | null;
  maxPhaseCurrent?: number | null;
  maxPhaseUnbalance?: number | null;
  createdAt: string;
  chargers: Array<{
    charger_id: number;
    name: string;
    model: string;
    status: string;
  }>;
}

export default function StationDetailPage() {
  const { id } = useParams();
  const [station, setStation] = useState<StationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStationAndChargers = async () => {
      try {
        const [stationRes, chargersRes] = await Promise.all([
          api.get(`/stations/${id}`),
          api.get(`/stations/${id}/chargers`)
        ]);
        
        const stationData = stationRes.data?.data || stationRes.data;
        const chargersData = Array.isArray(chargersRes.data?.data)
          ? chargersRes.data.data
          : (Array.isArray(chargersRes.data) ? chargersRes.data : []);

        setStation({
          ...stationData,
          chargers: chargersData || stationData?.chargers || []
        });
      } catch (error) {
        logger.error("Failed to fetch station details", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchStationAndChargers();
  }, [id]);

  if (isLoading) return <AppShell><div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300"><div className="p-8">Loading station details...</div></div></AppShell>;
  if (!station) return <AppShell><div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300"><div className="p-8 text-red-500">Station not found</div></div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 flex items-center justify-between">
        <div className="space-y-4">
          <Link href="/stations">
            <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Locations
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{station.station_name}</h1>
            <Badge variant="outline" className={station.status === 'active' ? 'bg-green-500/10 text-green-500' : ''}>
              {station.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        <Link href={`/stations/${id}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Edit Location
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{station.street_name}</p>
                <p className="text-muted-foreground">{station.city}, {station.state} {station.postal_code}</p>
                <div className="mt-2 text-sm text-muted-foreground flex gap-4">
                  <span>Lat: {station.latitude}</span>
                  <span>Lng: {station.longitude}</span>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View Map <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Site Manager</p>
                <p className="text-muted-foreground text-sm">{station.on_site_person_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Contact Details</p>
                <p className="text-muted-foreground text-sm">{station.on_site_contact_details}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t">
              <Phone className="h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-sm text-destructive">Emergency Contact</p>
                <p className="text-muted-foreground text-sm">{station.emergency_contact}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Load Management & Site Grid Limits */}
      <Card className="rounded-2xl border-border/70 shadow-xs mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#54a8c7]/10 text-[#54a8c7] flex items-center justify-center">
              <Zap className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Dynamic Load Management & Site Grid Limits</CardTitle>
              <CardDescription className="text-xs">
                Automated site power and phase limits enforced across all chargers installed at this location.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border/60">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Power Limit (kW)</span>
              <span className="text-sm font-bold text-foreground">
                {station.maxPower !== null && station.maxPower !== undefined ? `${station.maxPower} kW` : "Unlimited (Site Max)"}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dynamic throttling ceiling</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Max Current (A)</span>
              <span className="text-sm font-bold text-foreground">
                {station.maxAmperage ? `${station.maxAmperage} A` : (station.maxPower ? `${Math.round(((station.maxPower * 1000) / (3 * 230)) * 10) / 10} A (calculated)` : "Unlimited")}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total site draw limit</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Per-Phase Limit</span>
              <span className="text-sm font-bold text-foreground">
                {station.maxPhaseCurrent ?? 80.0} A
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">L1 / L2 / L3 upper fuse</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Max Phase Unbalance</span>
              <span className="text-sm font-bold text-foreground">
                ±{station.maxPhaseUnbalance ?? 16.0} A
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Neutral conductor safety</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chargers at this Location</CardTitle>
          <CardDescription>{station.chargers?.length || 0} chargers installed.</CardDescription>
        </CardHeader>
        <CardContent>
          {station.chargers?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">
              No chargers assigned to this station yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charger Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {station.chargers?.map((charger) => (
                  <TableRow key={charger.charger_id}>
                    <TableCell className="font-medium">
                      <Link href={`/chargers/${charger.charger_id}`} className="hover:underline text-primary">
                        {charger.name}
                      </Link>
                    </TableCell>
                    <TableCell>{charger.model}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{charger.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/chargers/${charger.charger_id}`}>
                        <Button variant="ghost" size="sm">Manage</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </AppShell>
  );
}
