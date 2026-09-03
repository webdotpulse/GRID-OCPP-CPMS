"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function UnrecognizedChargersPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnections = async () => {
    try {
      const response = await api.get('/chargers/unrecognized');
      setConnections(response.data?.data || response.data || []);
    } catch (error) {
      logger.error("Failed to fetch unrecognized connections", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all unrecognized connections?')) return;
    try {
      await api.delete('/chargers/unrecognized');
      fetchConnections();
    } catch (error) {
      logger.error("Failed to clear unrecognized connections", error);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto p-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unrecognized Connections</h1>
          <p className="text-muted-foreground">View and register unknown or rejected OCPP connections.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleClearAll} disabled={connections.length === 0}>
            Clear All
          </Button>
          <Link href="/chargers">
            <Button variant="outline">
              Back to Chargers
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Charge Point ID</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Last Attempt Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Loading connections...</TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No unrecognized connections found.</TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      {conn.chargePointId}
                    </div>
                  </TableCell>
                  <TableCell>{conn.reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {conn.timestamp
                      ? `${formatDistanceToNow(new Date(conn.timestamp))} ago`
                      : 'Unknown'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/chargers/new?name=${encodeURIComponent(conn.chargePointId)}`}>
                       <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Register</Button>
                    </Link>
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
