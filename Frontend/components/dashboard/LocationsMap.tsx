"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import 'leaflet/dist/leaflet.css';

// Dynamically import Leaflet components to avoid SSR window issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

export function LocationsMap() {
  const [stations, setStations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [icon, setIcon] = useState<any>(null);
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    setMounted(true);

    // Import L only on client
    import('leaflet').then((L) => {
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
      });
      setIcon(DefaultIcon);
    });

    const fetchStations = async () => {
      try {
        const response = await api.get('/stations');
        if (response.data) {
          setStations(response.data.filter((s: any) => typeof s.latitude === 'number' && typeof s.longitude === 'number'));
        }
      } catch (error) {
        logger.error('Failed to fetch stations for map', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStations();
  }, []);

  if (!mounted) return null;

  // Default center (e.g. Europe)
  const defaultCenter: [number, number] = [50.8503, 4.3517]; // Brussels

  let mapCenter = defaultCenter;
  let mapZoom = 8;

  if (stations.length > 0) {
    const lats = stations.map(s => s.latitude);
    const lngs = stations.map(s => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    mapCenter = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];

    if (stations.length === 1) {
       mapZoom = 13;
    }
  }

  const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-[#3f78e0]/15 text-[#3f78e0] flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
            <CardTitle>Station Locations</CardTitle>
          </div>
          <Badge variant="soft-primary" className="text-xs font-semibold">
            {stations.length} Active {stations.length === 1 ? 'Station' : 'Stations'}
          </Badge>
        </div>
        <CardDescription>Geographic overview of your deployed charging network</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[340px] p-0 relative overflow-hidden rounded-b-2xl z-0">
        {isLoading || !icon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 gap-2">
            <div className="size-8 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-muted-foreground">Loading interactive map...</span>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={false}
            style={{
              height: '100%',
              minHeight: '340px',
              width: '100%',
              zIndex: 0,
              filter: isDark ? 'invert(1) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {stations.map((station) => (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={icon}
              >
                <Popup>
                  <div className="text-sm p-1 font-sans">
                    <h3 className="font-bold text-foreground">{station.station_name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {station.street_name}, {station.city}
                    </p>
                    <Link
                      href={`/stations/${station.id}`}
                      className="inline-flex items-center gap-1 text-xs text-[#54a8c7] font-semibold hover:underline"
                    >
                      View Station Details →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
}
