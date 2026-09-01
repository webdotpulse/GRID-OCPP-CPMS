"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye, ReceiptText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface ChargerTransactionsTableProps {
  chargerId: number;
}

export function ChargerTransactionsTable({ chargerId }: ChargerTransactionsTableProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/transactions/charger/${chargerId}`);
      const payload = response.data;

      let allTxns: any[] = [];
      if (payload && payload.data) {
        // Handle payload like { data: { transactions, rfidSessions } }
        const basicTxns = Array.isArray(payload.data.transactions) ? payload.data.transactions.map((t: any) => ({ ...t, type: 'basic' })) : [];
        const rfidTxns = Array.isArray(payload.data.rfidSessions) ? payload.data.rfidSessions.map((s: any) => ({ ...s, type: 'rfid', idTag: s.rfidUser?.rfid_tag || s.idTag })) : [];

        // Deduplicate
        const basicTxnIds = new Set(basicTxns.map((t: any) => t.transactionId));
        const uniqueRfidTxns = rfidTxns.filter((s: any) => !basicTxnIds.has(s.transactionId));

        allTxns = [...basicTxns, ...uniqueRfidTxns];
      } else if (payload && (payload.transactions || payload.rfidSessions)) {
        // Fallback structure
        const basicTxns = Array.isArray(payload.transactions) ? payload.transactions.map((t: any) => ({ ...t, type: 'basic' })) : [];
        const rfidTxns = Array.isArray(payload.rfidSessions) ? payload.rfidSessions.map((s: any) => ({ ...s, type: 'rfid', idTag: s.rfidUser?.rfid_tag || s.idTag })) : [];

        const basicTxnIds = new Set(basicTxns.map((t: any) => t.transactionId));
        const uniqueRfidTxns = rfidTxns.filter((s: any) => !basicTxnIds.has(s.transactionId));

        allTxns = [...basicTxns, ...uniqueRfidTxns];
      }

      allTxns.sort((a, b) => {
        const timeA = a && (a.startTime || a.createdAt) ? new Date(a.startTime || a.createdAt).getTime() : 0;
        const timeB = b && (b.startTime || b.createdAt) ? new Date(b.startTime || b.createdAt).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setTransactions(allTxns);
    } catch (error) {
      logger.error("Failed to fetch charger transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [chargerId]);

  useEffect(() => {
    if (chargerId) {
      fetchTransactions();
    }
  }, [chargerId, fetchTransactions]);

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'completed') return <Badge variant="outline" className="text-green-500 bg-green-500/10">COMPLETED</Badge>;
    if (s === 'active' || s === 'charging') return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">CHARGING</Badge>;
    if (s === 'suspended') return <Badge variant="outline" className="text-amber-500 bg-amber-500/10">SUSPENDED</Badge>;
    if (s === 'faulted') return <Badge variant="destructive">FAULTED</Badge>;
    return <Badge variant="secondary">{status || 'UNKNOWN'}</Badge>;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredTransactions = transactions.filter(txn => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(txn.transactionId || "").toLowerCase().includes(q) ||
      txn.status?.toLowerCase().includes(q) ||
      txn.idTag?.toLowerCase().includes(q) ||
      txn.connectorName?.toLowerCase().includes(q)
    );
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a ? a[key] : undefined;
    let bVal: any = b ? b[key] : undefined;

    if (key === 'startTime') {
      aVal = a && (a.startTime || a.createdAt) ? new Date(a.startTime || a.createdAt).getTime() : 0;
      bVal = b && (b.startTime || b.createdAt) ? new Date(b.startTime || b.createdAt).getTime() : 0;
      aVal = isNaN(aVal) ? 0 : aVal;
      bVal = isNaN(bVal) ? 0 : bVal;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Approximate height of a row
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search by ID, Status, Channel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={fetchTransactions} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      <div ref={parentRef} className="rounded-md border bg-card h-[600px] overflow-auto relative">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transactionId')}>
                <div className="flex items-center gap-1">Txn ID <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('startTime')}>
                <div className="flex items-center gap-1">Start Time <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('connectorName')}>
                <div className="flex items-center gap-1">Channel <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('idTag')}>
                <div className="flex items-center gap-1">RFID Tag <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('energyConsumed')}>
                <div className="flex items-center justify-end gap-1">Energy <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Loading transactions...</TableCell>
              </TableRow>
            ) : sortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {searchQuery ? "No transactions match your search." : "No transactions recorded for this charger."}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                  <TableRow>
                    <TableCell colSpan={8} style={{ height: `${virtualItems[0].start}px`, padding: 0 }} />
                  </TableRow>
                )}
                {virtualItems.map((virtualRow) => {
                  const txn = sortedTransactions[virtualRow.index];
                  return (
                    <TableRow key={txn.id} data-index={virtualRow.index} ref={rowVirtualizer.measureElement}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <ReceiptText className="h-4 w-4 text-muted-foreground" />
                          #{txn.transactionId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {format(new Date(txn.startTime || txn.createdAt), 'MMM d, yyyy HH:mm')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(txn.startTime || txn.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>{txn.connectorName}</TableCell>
                      <TableCell className="font-mono text-xs">{txn.idTag || 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {(txn.energyConsumed / 1000).toFixed(2)} kWh
                      </TableCell>
                      <TableCell>{getStatusBadge(txn.status)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {txn.totalCost !== undefined && txn.totalCost !== null ? `€${(txn.totalCost / 100).toFixed(2)}` : (txn.amountDue !== undefined && txn.amountDue !== null ? `€${(txn.amountDue / 100).toFixed(2)}` : '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/transactions/${txn.id}`}>
                           <Button variant="ghost" size="sm">
                             <Eye className="mr-2 h-4 w-4" /> View
                           </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {virtualItems.length > 0 && virtualItems[virtualItems.length - 1].end < rowVirtualizer.getTotalSize() && (
                  <TableRow>
                    <TableCell colSpan={8} style={{ height: `${rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px`, padding: 0 }} />
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
