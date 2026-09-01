"use client";


import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useTelemetryStore } from "@/store/useTelemetryStore";

const statusColors: Record<string, string> = {
  online: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  active: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  offline: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  faulted: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  charging: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
};

export function ChargerStatusGrid() {
  const chargers = useTelemetryStore((state) => state.chargers);
  const isChargersLoading = useTelemetryStore((state) => state.isChargersLoading);
  const fetchChargers = useTelemetryStore((state) => state.fetchChargers);

  useEffect(() => {
    fetchChargers();
  }, [fetchChargers]);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Charger Status Grid</CardTitle>
      </CardHeader>
      <CardContent>
        {isChargersLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
               <div key={i} className="h-24 bg-muted animate-pulse rounded-lg bg-card border p-4 text-center">
                 <div className="h-4 bg-muted-foreground/20 rounded w-16 mx-auto mb-2"></div>
                 <div className="h-4 bg-muted-foreground/20 rounded w-20 mx-auto"></div>
               </div>
            ))}
          </div>
        ) : chargers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
            No chargers enrolled in system.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {chargers.map((charger) => {
               // Determine actual display status (e.g. if online but charging, show charging)
               const displayStatus = charger.active_sessions > 0 ? "charging" : (charger.status?.toLowerCase() || 'offline');
               const isOffline = displayStatus === 'offline';
               
               return (
                <div 
                  key={charger.charger_id} 
                  className={`
                    border rounded-lg p-3 text-center transition-all flex flex-col items-center justify-center
                    ${isOffline ? 'opacity-60 bg-muted/50 grayscale-[50%]' : 'bg-card hover:bg-muted/50'}
                  `}
                >
                  <div className="font-semibold text-sm truncate w-full" title={charger.name}>
                    {charger.name}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`mt-2 font-mono text-[10px] ${statusColors[displayStatus] || statusColors.offline}`}
                  >
                    {displayStatus.toUpperCase()}
                  </Badge>
                  <div className="text-[10px] text-muted-foreground mt-2">
                    {charger.last_heartbeat && !isNaN(new Date(charger.last_heartbeat).getTime())
                      ? `${formatDistanceToNow(new Date(charger.last_heartbeat))} ago`
                      : 'Recently'}
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
