"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Loader2, Info } from "lucide-react";
import { format } from "date-fns";

interface PredictiveLoadMapProps {
  chargerId: number;
}

export function PredictiveLoadMap({ chargerId }: PredictiveLoadMapProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await api.get(`/chargers/${chargerId}/predictive-schedule`);
        if (response.data) {
           const scheduleData = Array.isArray(response.data) ? response.data : (response.data?.schedule || response.data?.data || []);
           setData(Array.isArray(scheduleData) ? scheduleData : []);
        }
      } catch (error) {
        console.error("Failed to fetch predictive schedule", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [chargerId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Load & Solar Forecast</CardTitle>
          <CardDescription>24-hour predicted optimal charging curve</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Load & Solar Forecast</CardTitle>
          <CardDescription>24-hour predicted optimal charging curve</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <Info className="h-10 w-10 mb-4" />
          <p>No predictive schedule available for this charger.</p>
          <p className="text-sm">Ensure "Predictive Load Balancing" is enabled in hardware settings.</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-md p-3 text-sm">
          <p className="font-medium mb-2">{format(new Date(label), "MMM dd, HH:mm")}</p>
          {payload.map((p: any, i: number) => (
             <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                <span className="text-muted-foreground">{p.name}:</span>
                <span className="font-medium">{p.value.toFixed(2)} {p.name.includes("Price") ? "€/MWh" : p.name.includes("Solar") ? "kW" : "A"}</span>
             </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Predictive Load & Solar Forecast</CardTitle>
        <CardDescription>24-hour predicted optimal charging curve based on local solar generation and day-ahead EPEX spot prices</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Do not use strict fixed height to avoid overlap with Recharts. Let it flex. */}
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

              {/* XAxis must use the raw timestamp for Recharts, format it internally */}
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                }}
              />

              <YAxis yAxisId="amps" orientation="left" stroke="#3b82f6" label={{ value: 'Planned Limit (A)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
              <YAxis yAxisId="solar" orientation="right" stroke="#eab308" label={{ value: 'Solar (kW)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }} />
              <YAxis yAxisId="price" orientation="right" stroke="#ef4444" hide={true} />

              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />

              <Bar yAxisId="amps" dataKey="predictedAmps" name="Planned Amps" fill="#3b82f6" opacity={0.8} />
              <Line yAxisId="solar" type="monotone" dataKey="solarForecast" name="Solar Forecast" stroke="#eab308" strokeWidth={3} dot={false} />
              <Line yAxisId="price" type="stepAfter" dataKey="epexPrice" name="EPEX Price" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
