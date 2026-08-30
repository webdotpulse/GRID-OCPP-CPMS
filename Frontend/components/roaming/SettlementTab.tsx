"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, TrendingUp, TrendingDown, MapPin } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// Dynamically import react-leaflet components to avoid SSR 'window is not defined' error
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function SettlementTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get("/roaming/stats");
      const statsData = response.data?.data !== undefined ? response.data.data : response.data;
      setStats(statsData);
    } catch (error: any) {
      toast.error("Failed to load roaming stats: " + (error?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (format: "csv" | "json") => {
    try {
      const response = await api.get(`/roaming/report?format=${format}`, { responseType: format === 'csv' ? 'blob' : 'json' });

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data as any]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'monthly_clearinghouse_report.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } else {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data?.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "monthly_clearinghouse_report.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      }
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch (error: any) {
      toast.error("Failed to download report");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading settlement data...</div>;
  }

  const revenueData = stats?.revenueByPartner || [];
  const heatmapData = stats?.heatmapData || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Settlement Visualizer</h2>
          <p className="text-muted-foreground">Analyze roaming margins and download clearinghouse reports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleDownloadReport('json')}>
            <Download className="mr-2 h-4 w-4" /> Export JSON
          </Button>
          <Button onClick={() => handleDownloadReport('csv')}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by MSP</CardTitle>
            <CardDescription>Breakdown of roaming revenue per partner.</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {revenueData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${Number(value).toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roaming Heatmap</CardTitle>
            <CardDescription>Stations attracting the most roaming sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData.length > 0 ? (
              <div className="h-[300px] rounded-md overflow-hidden z-0 relative border">
                <MapContainer center={[heatmapData[0].latitude, heatmapData[0].longitude]} zoom={5} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {heatmapData.map((station: any) => (
                    <CircleMarker
                      key={station.stationId}
                      center={[station.latitude, station.longitude]}
                      pathOptions={{
                        color: station.revenue > 100 ? '#ef4444' : '#3b82f6',
                        fillColor: station.revenue > 100 ? '#ef4444' : '#3b82f6',
                        fillOpacity: 0.7
                      }}
                      radius={Math.max(10, Math.min(30, station.sessionCount * 2))}
                    >
                      <Popup>
                        <div className="font-medium">{station.name}</div>
                        <div className="text-sm text-muted-foreground">{station.sessionCount} sessions</div>
                        <div className="text-sm font-semibold">€{station.revenue.toFixed(2)} revenue</div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center border rounded-md text-muted-foreground">
                No geographic data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Margins</CardTitle>
          <CardDescription>Summary of roaming performance by MSP</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueData.map((partner: any, idx: number) => {
                    const totalRevenue = revenueData.reduce((sum: number, p: any) => sum + p.value, 0);
                    const share = totalRevenue > 0 ? (partner.value / totalRevenue) * 100 : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          {partner.name}
                        </TableCell>
                        <TableCell className="text-right font-mono">€{partner.value.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{share.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No partner data to display</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
