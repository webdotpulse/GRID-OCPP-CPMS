"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, StopCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ActiveSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/dashboard/live-sessions');
      const rawData = response.data?.data ?? response.data;
      const list = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : []);
      setSessions(list);
    } catch (error) {
      logger.error("Failed to fetch active sessions", error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const remoteStop = async (transactionId: string | number, chargerId: number) => {
    if (!confirm(`Are you sure you want to stop transaction ${transactionId}?`)) return;
    try {
      await api.post(`/ocpp/remote-stop`, { transactionId: Number(transactionId), chargerId });
      alert("Remote stop command sent.");
    } catch (error: any) {
      logger.error("Failed to stop transaction", error);
      alert(error.response?.data?.error || "Failed to send command.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="mb-6 space-y-4">
        <Link href="/transactions">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to All Transactions
          </Button>
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-500 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></span>
              Active Sessions
            </h1>
            <p className="text-muted-foreground">Currently ongoing charging transactions.</p>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Txn ID</TableHead>
              <TableHead>Charger / Channel</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Power</TableHead>
              <TableHead className="text-right">Energy</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading active sessions...</TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground border border-dashed m-4 rounded-xl">
                  No active sessions found.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.transactionId}>
                  <TableCell className="font-mono text-sm">#{session.transactionId}</TableCell>
                  <TableCell>{session.chargerName} <span className="text-muted-foreground text-xs ml-1">({session.connectorName})</span></TableCell>
                  <TableCell>
                    {session.startTime && !isNaN(new Date(session.startTime).getTime())
                      ? formatDistanceToNow(new Date(session.startTime), { addSuffix: true })
                      : 'Just now'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-500 text-lg">
                    {session.currentPower > 0 ? `${(session.currentPower / 1000).toFixed(2)} kW` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary text-lg">
                    {session.energyConsumed > 0 ? `${(session.energyConsumed / 1000).toFixed(2)} kWh` : 'Starting...'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => remoteStop(session.transactionId, session.chargerId)}
                      className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                    >
                      <StopCircle className="mr-2 h-4 w-4" /> Force Stop
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>
    </AppShell>
  );
}
