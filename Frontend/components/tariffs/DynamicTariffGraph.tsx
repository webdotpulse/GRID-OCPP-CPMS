"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface TariffGraphData {
  timestamp: string | Date;
  price: number; // Final price per kWh
}

interface DynamicTariffGraphProps {
  data: TariffGraphData[];
  country: "BE" | "NL";
  isLoading?: boolean;
}

export function DynamicTariffGraph({ data, country, isLoading }: DynamicTariffGraphProps) {
  const chartData = useMemo(() => {
    return data.map((d) => {
      const date = new Date(d.timestamp);
      return {
        ...d,
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        hour: date.getHours(),
        isNegative: d.price < 0,
      };
    });
  }, [data]);

  const currentHour = new Date().getHours();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Day-Ahead Prices ({country})</CardTitle>
          <CardDescription>Loading tariff data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse space-y-4 w-full">
             <div className="h-4 bg-muted rounded w-1/4"></div>
             <div className="h-[200px] bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
     return (
      <Card>
        <CardHeader>
          <CardTitle>Day-Ahead Prices ({country})</CardTitle>
          <CardDescription>No data available for today/tomorrow.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Check API integrations or wait for the daily price publication.
        </CardContent>
      </Card>
    );
  }

  const minPrice = Math.min(...chartData.map((d) => d.price));
  const hasNegative = minPrice < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Day-Ahead Dynamic Tariff ({country})</CardTitle>
        <CardDescription>Live preview of EPEX Spot based pricing for the next 24 hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full min-w-0">
          <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(val) => `€${val.toFixed(2)}`}
                domain={hasNegative ? ['auto', 'auto'] : [0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: any) => [`€${value.toFixed(4)}`, "Price per kWh"]}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold", marginBottom: "4px" }}
              />
              {/* Highlight zero line if there are negative prices */}
              {hasNegative && <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />}

              {/* Current hour vertical line */}
              <ReferenceLine
                 x={chartData.find(d => d.hour === currentHour)?.time}
                 stroke="hsl(var(--primary))"
                 strokeWidth={2}
                 strokeOpacity={0.5}
                 label={{ position: 'top', value: 'Current Hour', fill: "hsl(var(--primary))", fontSize: 12 }}
              />

              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          </SafeResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
