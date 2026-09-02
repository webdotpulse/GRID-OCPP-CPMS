"use client";

import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, ReceiptText, ArrowUpDown, ChevronLeft, ChevronRight, Search, Activity, Zap } from "lucide-react";
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
        txns.sort((a: any, b: any) => {
          const timeA = a && (a.startTime || a.createdAt) ? new Date(a.startTime || a.createdAt).getTime() : 0;
          const timeB = b && (b.startTime || b.createdAt) ? new Date(b.startTime || b.createdAt).getTime() : 0;
          return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
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
    if (s === 'completed') {
      return <Badge variant="soft-success" className="text-[10px] font-bold uppercase tracking-wider py-0.5">COMPLETED</Badge>;
    }
    if (s === 'charging' || s === 'initiated') {
      return (
        <Badge variant="soft-primary" className="text-[10px] font-bold uppercase tracking-wider py-0.5 gap-1">
          <span className="size-1.5 rounded-full bg-[#54a8c7] animate-pulse" />
          CHARGING
        </Badge>
      );
    }
    if (s === 'faulted') {
      return <Badge variant="soft-danger" className="text-[10px] font-bold uppercase tracking-wider py-0.5">FAULTED</Badge>;
    }
    return <Badge variant="soft-secondary" className="text-[10px] font-bold uppercase tracking-wider py-0.5">{status?.toUpperCase() || 'UNKNOWN'}</Badge>;
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

    let aVal: any = a ? a[key] : undefined;
    let bVal: any = b ? b[key] : undefined;

    if (key === 'startTime') {
      aVal = a && (a.startTime || a.createdAt) ? new Date(a.startTime || a.createdAt).getTime() : 0;
      bVal = b && (b.startTime || b.createdAt) ? new Date(b.startTime || b.createdAt).getTime() : 0;
      aVal = isNaN(aVal) ? 0 : aVal;
      bVal = isNaN(bVal) ? 0 : bVal;
    } else if (key === 'charger') {
      aVal = a?.charger?.name || `Charger ID: ${a?.charger_id || ''}`;
      bVal = b?.charger?.name || `Charger ID: ${b?.charger_id || ''}`;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#54a8c7]/15 text-[#54a8c7] flex items-center justify-center">
                <ReceiptText className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-foreground">
                Charging Transactions
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Audit log of historical EV charging sessions, energy metering, and billing status.
            </p>
          </div>
          <Link href="/transactions/active">
            <Button variant="outline" className="rounded-xl border-[#54a8c7]/40 text-[#54a8c7] hover:bg-[#54a8c7]/10">
              <Activity className="size-4 mr-1.5" /> View Active Live Sessions
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction ID, RFID tag, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9.5 bg-muted/40 border-border/60"
            />
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {totalCount} Total Sessions
          </Badge>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transactionId')}>
                  <div className="flex items-center gap-1.5">Txn ID <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('startTime')}>
                  <div className="flex items-center gap-1.5">Start Time <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('charger')}>
                  <div className="flex items-center gap-1.5">Charger / Channel <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('idTag')}>
                  <div className="flex items-center gap-1.5">RFID Tag <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('energyConsumed')}>
                  <div className="flex items-center justify-end gap-1.5">Energy <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">Status <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-6 border-2 border-[#54a8c7] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Loading transaction records...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ReceiptText className="size-8 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground text-sm">No Transactions Found</p>
                      <p className="text-xs text-muted-foreground">No charging sessions match your query.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransactions.map((tx) => (
                  <TableRow key={tx.transaction_id || tx.transactionId || tx.id} className="hover:bg-[#54a8c7]/5 transition-colors">
                    <TableCell className="font-mono font-bold text-xs text-foreground">
                      <Link 
                        href={`/transactions/${tx.transactionId || tx.id || tx.transaction_id}`}
                        className="hover:text-[#54a8c7] hover:underline transition-colors"
                      >
                        #{tx.transactionId || tx.id || tx.transaction_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {tx.startTime 
                        ? format(new Date(tx.startTime), 'dd MMM yyyy, HH:mm') 
                        : (tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yyyy, HH:mm') : '—')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-[#54a8c7]" />
                        <span className="font-semibold text-sm text-foreground">
                          {tx.charger?.name || `Charger #${tx.charger_id}`}
                        </span>
                        {tx.connector?.connector_name && (
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {tx.connector.connector_name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.idTag ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {tx.idTag}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Direct / App</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-[#54a8c7]">
                      {tx.energyConsumed != null 
                        ? `${(Number(tx.energyConsumed) / 1000).toFixed(2)} kWh` 
                        : (tx.meter_stop ? `${((tx.meter_stop - (tx.meter_start || 0)) / 1000).toFixed(2)} kWh` : '0.00 kWh')}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(tx.status || 'completed')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/transactions/${tx.transactionId || tx.id || tx.transaction_id}`}>
                        <Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-foreground">
                          <Eye className="size-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{transactions.length}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> sessions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8.5 px-3 rounded-xl"
            >
              <ChevronLeft className="size-4 mr-1" /> Previous
            </Button>
            <div className="text-xs font-semibold px-3 py-1.5 bg-card rounded-xl border border-border/80 min-w-[3.5rem] text-center shadow-2xs">
              {page} / {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="h-8.5 px-3 rounded-xl"
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
