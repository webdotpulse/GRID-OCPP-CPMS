"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, ReceiptText, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { Input } from "@/components/ui/input";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/transactions', {
        params: { search: searchQuery || undefined, page, limit },
      });
      const payload = response.data;
      const pagination = (response as any).pagination || (payload as any)?.pagination;

      if (payload && Array.isArray(payload.transactions)) {
        const txns = payload.transactions.map((t: any) => ({
          ...t,
          type: t.rfidUserId ? 'rfid' : 'basic',
          idTag: t.rfidUser?.rfid_tag || t.idTag,
        }));
        txns.sort((a: any, b: any) => new Date(b.startTime || b.createdAt).getTime() - new Date(a.startTime || a.createdAt).getTime());
        setTransactions(txns);
      } else if (Array.isArray(payload)) {
        setTransactions(payload);
      } else {
        setTransactions([]);
      }

      if (pagination) {
        setTotalPages(pagination.totalPages || 1);
        setTotalCount(pagination.total ?? 0);
      } else {
        const count = Array.isArray(payload?.transactions) ? payload.transactions.length : (Array.isArray(payload) ? payload.length : 0);
        setTotalCount(count);
        setTotalPages(Math.ceil(count / limit) || 1);
      }
    } catch (error) {
      logger.error("Failed to fetch transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s === 'completed') return <Badge variant="outline" className="text-green-500 bg-green-500/10">COMPLETED</Badge>;
    if (s === 'charging' || s === 'initiated') return <Badge variant="outline" className="text-blue-500 bg-blue-500/10 animate-pulse">CHARGING</Badge>;
    if (s === 'faulted') return <Badge variant="outline" className="text-red-500 bg-red-500/10">FAULTED</Badge>;
    return <Badge variant="outline" className="text-muted-foreground bg-muted">{status?.toUpperCase() || ''}</Badge>;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aVal: any = a[key];
    let bVal: any = b[key];

    if (key === 'startTime') {
      aVal = new Date(a.startTime || a.createdAt).getTime();
      bVal = new Date(b.startTime || b.createdAt).getTime();
    } else if (key === 'charger') {
      aVal = a.charger?.name || `Charger ID: ${a.charger_id}`;
      bVal = b.charger?.name || `Charger ID: ${b.charger_id}`;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Transactions</h1>
          <p className="text-muted-foreground">Historical charging sessions across all stations.</p>
        </div>
        <Link href="/transactions/active">
          <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
            View Active Sessions
          </Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search transactions by ID or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transactionId')}>
                <div className="flex items-center gap-1">Txn ID <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('startTime')}>
                <div className="flex items-center gap-1">Start Time <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('charger')}>
                <div className="flex items-center gap-1">Charger / Channel <ArrowUpDown className="h-3 w-3" /></div>
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
            {isLoading && transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Loading transactions...</TableCell>
              </TableRow>
            ) : sortedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No transactions recorded.</TableCell>
              </TableRow>
            ) : (
              sortedTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-muted-foreground" />
                      #{txn.transactionId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">
                      {format(new Date(txn.startTime), 'MMM d, yyyy HH:mm')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(txn.startTime), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {txn.charger?.name || `Charger ID: ${txn.charger_id}`} 
                    <span className="text-muted-foreground text-xs ml-1">({txn.connectorName})</span>
                  </TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{transactions.length}</span> of{" "}
          <span className="font-medium text-foreground">{totalCount}</span> transactions
          {totalPages > 1 && (
            <span className="ml-1">
              (Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="h-8 px-3"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-xs font-medium px-2 py-1 bg-muted rounded border min-w-[3rem] text-center">
            {page} / {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="h-8 px-3"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
