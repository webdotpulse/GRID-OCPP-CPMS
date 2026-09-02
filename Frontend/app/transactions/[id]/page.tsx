"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ReceiptText, Calendar, Zap, Activity } from "lucide-react";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Separator } from "@/components/ui/separator";

export default function TransactionDetailPage() {
  const { id } = useParams();
  const [txn, setTxn] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const response = await api.get(`/transactions/${id}`);
        const data = response.data?.data ?? response.data;
        setTxn(data);
      } catch (error) {
        logger.error("Failed to fetch transaction details", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTransaction();
  }, [id]);

  if (isLoading) return <AppShell><div className="p-8">Loading transaction details...</div></AppShell>;
  if (!txn) return <AppShell><div className="p-8 text-red-500">Transaction not found</div></AppShell>;

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'completed') return <Badge variant="outline" className="text-green-500 bg-green-500/10">COMPLETED</Badge>;
    if (s === 'charging' || s === 'initiated') return <Badge variant="outline" className="text-blue-500 bg-blue-500/10 animate-pulse">CHARGING</Badge>;
    if (s === 'faulted') return <Badge variant="outline" className="text-red-500 bg-red-500/10">FAULTED</Badge>;
    return <Badge variant="outline" className="text-muted-foreground bg-muted">{status?.toUpperCase() || ''}</Badge>;
  };

  const getDurationString = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const mins = differenceInMinutes(endDate, startDate);
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    const secs = differenceInSeconds(endDate, startDate);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs % 60}s`;
  };

  return (
    <AppShell>
      <div className="mb-6 space-y-4">
        <Link href="/transactions">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Transactions
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <ReceiptText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-mono">#{txn.transactionId}</h1>
            </div>
            {getStatusBadge(txn.status)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Session Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-medium">{format(new Date(txn.startTime), 'MMM d, yyyy HH:mm:ss')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ended</p>
                <p className="font-medium">
                  {txn.endTime ? format(new Date(txn.endTime), 'MMM d, yyyy HH:mm:ss') : <span className="text-blue-500 animate-pulse">Ongoing...</span>}
                </p>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-mono">{getDurationString(txn.startTime, txn.endTime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Energy Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Consumed</p>
                <p className="font-mono text-xl text-primary font-bold">{(txn.energyConsumed / 1000).toFixed(3)} kWh</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Initial Meter</p>
                <p className="font-mono text-sm">{txn.initialMeterValue || 0} Wh</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Final Meter</p>
                <p className="font-mono text-sm">
                  {txn.finalMeterValue ? `${txn.finalMeterValue} Wh` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Auth Tag (RFID)</p>
                <p className="font-mono font-medium">
                  {txn.idTag || txn.rfidUser?.rfid_tag || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="font-mono font-bold text-lg text-primary">
                  {txn.totalCost !== undefined && txn.totalCost !== null ? `€${(txn.totalCost / 100).toFixed(2)}` : (txn.amountDue !== undefined && txn.amountDue !== null ? `€${(txn.amountDue / 100).toFixed(2)}` : '€0.00')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Local DB Record ID</p>
                <p className="font-mono text-sm">{txn.id}</p>
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Stop Reason</p>
                <p className="text-sm font-medium capitalize">
                  {txn.stopReason || (txn.status === 'completed' ? 'Local Stop' : (txn.status === 'charging' ? 'N/A' : txn.status))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Zap className="h-5 w-5" /> Hardware Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txn.charger ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Charger Name</p>
                <Link href={`/chargers/${txn.charger_id}`} className="font-medium text-primary hover:underline">
                  {txn.charger.name}
                </Link>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Channel Name</p>
                <p className="font-medium">{txn.connectorName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Model</p>
                <p className="font-medium">{txn.charger.model}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Manufacturer</p>
                <p className="font-medium">{txn.charger.manufacturer}</p>
              </div>
            </div>
          ) : (
             <p className="text-muted-foreground">Charger details unavailable for this transaction.</p>
          )}
        </CardContent>
      </Card>
      
    </AppShell>
  );
}
