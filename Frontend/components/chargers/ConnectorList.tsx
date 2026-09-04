"use client";
import React from "react";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, Search, Edit, Trash2, Settings2 } from "lucide-react";
import { ChannelLogs } from "./ChannelLogs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { InvestigateDialog } from "./InvestigateDialog";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface Connector {
  connector_id: number;
  connector_name: string;
  status: string;
  current_type: string;
  max_power: number;
  max_current?: number;
  charger_id?: number;
}

interface ConnectorListProps {
  hideLogs?: boolean;
  connectors: Connector[];
  readOnly?: boolean;
}

function getStatusIcon(status: string) {
  const s = status?.toLowerCase() || '';
  if (s === 'available') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === 'charging') return <Zap className="h-4 w-4 text-blue-500 animate-pulse" />;
  if (s === 'faulted') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  return <XCircle className="h-4 w-4 text-muted-foreground" />;
}

function getStatusColor(status: string) {
  const s = status?.toLowerCase() || '';
  if (s === 'available') return 'bg-green-500/10 text-green-500 border-green-500/20';
  if (s === 'charging') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  if (s === 'faulted') return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (s === 'reserved') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  if (s === 'unavailable') return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  return 'bg-muted text-muted-foreground';
}

export function ConnectorList({ connectors: initialConnectors, readOnly = false, hideLogs = false }: ConnectorListProps) {
  const [connectors, setConnectors] = useState(initialConnectors);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [investigateDialogState, setInvestigateDialogState] = useState<{ open: boolean; chargerId: number; connectorId: number }>({ open: false, chargerId: 0, connectorId: 0 });
  const { user } = useAuth();
  const [activeTxns, setActiveTxns] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [speedLimits, setSpeedLimits] = useState<Record<number, number>>({});
  const [isSettingProfile, setIsSettingProfile] = useState<Record<number, boolean>>({});

  React.useEffect(() => {
    setConnectors(initialConnectors);
  }, [initialConnectors]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this channel?")) return;
    try {
      const { api } = await import('@/lib/api');
      await api.delete(`/connectors/${id}`);
      setConnectors(connectors.filter(c => c.connector_id !== id));
    } catch {
      alert("Error deleting channel.");
    }
  };

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const chargerId = connectors?.[0]?.charger_id;
    if (!chargerId) return;

    const fetchActiveTxns = async () => {
      try {
        const { api } = await import('@/lib/api');
        const response = await api.get(`/transactions/charger/${chargerId}`);
        const payload = response.data;
        let allTxns: any[] = [];
        if (payload && payload.data) {
          const basicTxns = Array.isArray(payload.data.transactions) ? payload.data.transactions : [];
          const rfidTxns = Array.isArray(payload.data.rfidSessions) ? payload.data.rfidSessions : [];
          const basicTxnIds = new Set(basicTxns.map((t: any) => t.transactionId));
          const uniqueRfidTxns = rfidTxns.filter((s: any) => !basicTxnIds.has(s.transactionId));
          allTxns = [...basicTxns, ...uniqueRfidTxns];
        } else if (payload && (payload.transactions || payload.rfidSessions)) {
          const basicTxns = Array.isArray(payload.transactions) ? payload.transactions : [];
          const rfidTxns = Array.isArray(payload.rfidSessions) ? payload.rfidSessions : [];
          const basicTxnIds = new Set(basicTxns.map((t: any) => t.transactionId));
          const uniqueRfidTxns = rfidTxns.filter((s: any) => !basicTxnIds.has(s.transactionId));
          allTxns = [...basicTxns, ...uniqueRfidTxns];
        }

        setActiveTxns(allTxns.filter(t => t.status === 'charging' || t.status === 'Preparing' || t.endTime === null));
      } catch {
        // silently fail
      }
    };

    fetchActiveTxns();
    const interval = setInterval(fetchActiveTxns, 3000);
    return () => clearInterval(interval);
  }, [connectors]);

  const formatDuration = (start: string | Date) => {
    if (!start) return '00:00:00';
    const diff = now - new Date(start).getTime();
    if (diff < 0) return '00:00:00';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!connectors || connectors.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg flex flex-col items-center gap-2">
        <Clock className="h-8 w-8 text-muted-foreground/50" />
        <p>No channels configured for this charger.</p>
        <p className="text-xs">Channels will be auto-created when the charger connects.</p>
      </div>
    );
  }

  const availableCount = connectors.filter(c => c.status?.toLowerCase() === 'available').length;
  const chargingCount = connectors.filter(c => c.status?.toLowerCase() === 'charging').length;
  const faultedCount = connectors.filter(c => c.status?.toLowerCase() === 'faulted').length;

  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleSetSpeedLimit = async (chargerId: number, connectorId: number, limit: number, activeTxn: any) => {
    try {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: true }));
      const { api } = await import('@/lib/api');

      const payload = {
        chargerId,
        connectorId,
        csChargingProfiles: {
          chargingProfileId: Math.floor(Math.random() * 1000000),
          stackLevel: 10,
          chargingProfilePurpose: activeTxn ? "TxProfile" : "TxDefaultProfile",
          chargingProfileKind: "Relative",
          chargingSchedule: {
            chargingRateUnit: "A",
            chargingSchedulePeriod: [
              {
                startPeriod: 0,
                limit: limit
              }
            ]
          }
        }
      };

      await api.post('/ocpp/set-charging-profile', payload);
      toast.success(`Speed limit set to ${limit}A for channel ${connectorId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to set charging profile");
    } finally {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: false }));
    }
  };

  const handleClearSpeedLimit = async (chargerId: number, connectorId: number) => {
    try {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: true }));
      const { api } = await import('@/lib/api');

      await api.post('/ocpp/clear-charging-profile', {
        chargerId,
        connectorId
      });

      setSpeedLimits(prev => {
        const next = { ...prev };
        delete next[connectorId];
        return next;
      });
      toast.success(`Speed limit cleared for channel ${connectorId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to clear charging profile");
    } finally {
      setIsSettingProfile(prev => ({ ...prev, [connectorId]: false }));
    }
  };

  const findActiveTxn = (conn: Connector) => {
    return activeTxns.find(t => {
      if (!t) return false;
      if (t.connectorName === String(conn.connector_id) || t.connectorName === conn.connector_name) {
        return true;
      }
      const tName = (t.connectorName || "").trim().toLowerCase();
      const cName = (conn.connector_name || "").trim().toLowerCase();
      if (tName && cName && tName === cName) {
        return true;
      }
      const tNum = tName.match(/\d+/)?.[0];
      const cNum = cName.match(/\d+/)?.[0];
      if (tNum && cNum && tNum === cNum) {
        return true;
      }
      return false;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          {availableCount} Available
        </Badge>
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          {chargingCount} Charging
        </Badge>
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          {faultedCount} Faulted
        </Badge>
        <Badge variant="outline">
          {connectors.length} Total
        </Badge>
      </div>

      {investigateDialogState.open && (
        <InvestigateDialog
          open={investigateDialogState.open}
          onOpenChange={(open) => setInvestigateDialogState(prev => ({ ...prev, open }))}
          chargerId={investigateDialogState.chargerId}
          connectorId={investigateDialogState.connectorId}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Max Power</TableHead>
            <TableHead>Power</TableHead>
            <TableHead>Energy</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            {!readOnly && (user?.role === "admin" || user?.role === "superadmin") && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {connectors.map((conn) => {
            const activeTxn = findActiveTxn(conn);
            const isCharging = conn.status?.toLowerCase() === 'charging' || !!activeTxn;
            return (
            <React.Fragment key={conn.connector_id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(conn.connector_id)}
              >
                <TableCell>
                  {expandedId === conn.connector_id ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(conn.status)}
                    <span>{conn.connector_name || `Channel ${conn.connector_id}`}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{conn.current_type || 'N/A'}</Badge>
                </TableCell>
                <TableCell>{conn.max_power ? `${conn.max_power} kW` : 'N/A'}</TableCell>
                {(() => {
                  if (isCharging && activeTxn) {
                    const power = activeTxn.currentPower ? (activeTxn.currentPower / 1000).toFixed(2) + ' kW' : '0.00 kW';
                    const energy = activeTxn.energyConsumed ? (activeTxn.energyConsumed / 1000).toFixed(2) + ' kWh' : '0.00 kWh';
                    const duration = formatDuration(activeTxn.startTime || activeTxn.createdAt);
                    return (
                      <>
                        <TableCell className="font-mono text-primary">{power}</TableCell>
                        <TableCell className="font-mono text-primary">{energy}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{duration}</TableCell>
                      </>
                    );
                  }

                  return (
                    <>
                      <TableCell className="text-muted-foreground">N/A</TableCell>
                      <TableCell className="text-muted-foreground">N/A</TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                    </>
                  );
                })()}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(conn.status)}>
                      {conn.status}
                    </Badge>
                    {isCharging && activeTxn && (!activeTxn.currentPower || activeTxn.currentPower === 0) && (user?.role === "admin" || user?.role === "superadmin") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetChargerId = activeTxn?.charger_id || conn.charger_id;
                          if (targetChargerId) setInvestigateDialogState({ open: true, chargerId: targetChargerId, connectorId: conn.connector_id });
                        }}
                      >
                        <Search className="mr-1 h-3 w-3" />
                        Investigate
                      </Button>
                    )}
                  </div>
                </TableCell>
                {!readOnly && (user?.role === "admin" || user?.role === "superadmin") && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/connectors/${conn.connector_id}/edit`} onClick={(e) => e.stopPropagation()}>
                         <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={(e) => handleDelete(conn.connector_id, e)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
              {expandedId === conn.connector_id && (
                <TableRow>
                  <TableCell colSpan={!readOnly && (user?.role === "admin" || user?.role === "superadmin") ? 9 : 8} className="p-0 border-b-0 bg-muted/10">
                    <div className="p-4 space-y-4">
                      {!hideLogs && <ChannelLogs
                        chargerId={activeTxn?.charger_id || conn.charger_id || 0}
                        connectorId={conn.connector_id}
                      />}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          )})}
        </TableBody>
      </Table>
    </div>
  );
}
