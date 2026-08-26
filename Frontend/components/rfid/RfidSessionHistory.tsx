"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface RfidSession {
  id: number;
  transactionId: number;
  charger: { name: string };
  connectorName: string;
  startTime: string;
  endTime?: string;
  energyConsumed: number;
  amountDue: number;
}

export function RfidSessionHistory({ rfidUserId }: { rfidUserId: number }) {
  const [sessions, setSessions] = useState<RfidSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get(`/transactions/user/${rfidUserId}`);
        setSessions(response.data?.data || response.data);
      } catch (error) {
        logger.error("Failed to fetch session history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [rfidUserId]);

  if (isLoading) {
    return <div className="text-center p-8 text-muted-foreground">Loading charging history...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
        This tag has not been used for any charging sessions yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Energy</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          const rawDate = session.startTime || (session as any).start_time || (session as any).timestamp || (session as any).createdAt;
          const parsedDate = rawDate ? new Date(rawDate) : new Date();
          const isValidDate = !isNaN(parsedDate.getTime());
          const dateStr = isValidDate ? parsedDate.toLocaleDateString() : 'Recent';
          const relStr = isValidDate ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'Just now';
          const energyKwh = session.energyConsumed ? (session.energyConsumed / 1000).toFixed(2) : ((session as any).totalKwh || 0).toFixed(2);
          const cost = session.amountDue !== undefined ? session.amountDue : ((session as any).totalCost || 0);

          return (
            <TableRow key={session.id || (session as any).transactionId}>
              <TableCell>
                <div className="font-medium text-sm">
                  {dateStr}
                </div>
                <div className="text-xs text-muted-foreground">
                  {relStr}
                </div>
              </TableCell>
              <TableCell>
                {session.charger?.name || (session as any).chargePointId || 'Fast Charger'} ({session.connectorName || 'Connector 1'})
              </TableCell>
              <TableCell className="text-right font-mono text-primary">
                {energyKwh} kWh
              </TableCell>
              <TableCell className="text-right font-medium">
                €{Number(cost).toFixed(2)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
