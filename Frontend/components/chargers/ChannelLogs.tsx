"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logger } from "@/lib/logger";
import { useTelemetryStore } from "@/store/useTelemetryStore";

interface ChannelLog {
  id: string;
  timestamp: Date;
  chargePointId: string;
  messageType: string;
  action: string;
  payload: any;
  direction?: string;
}

interface ChannelLogsProps {
  chargerId: number;
  connectorId: number;
}

export function ChannelLogs({ chargerId, connectorId }: ChannelLogsProps) {
  const [logs, setLogs] = useState<ChannelLog[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const messageActionMap = useRef<Record<string, string>>({});

  const toggleRow = (id: string) => {
    setExpandedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const enrichLog = useCallback((rawLog: any): ChannelLog | null => {
    let parsedMsg: any = null;
    let messageType = rawLog.direction === 'in' ? 'RX' : 'TX';
    let action = rawLog.action || '-';
    let payload = rawLog.message;

    try {
      if (typeof rawLog.message === 'string') {
        parsedMsg = JSON.parse(rawLog.message);
      } else {
        parsedMsg = rawLog.message;
      }
    } catch {
      // Not JSON
    }

    if (Array.isArray(parsedMsg)) {
      const typeId = parsedMsg[0];
      const messageId = parsedMsg[1];
      if (typeId === 2) {
        messageType = 'CALL';
        action = parsedMsg[2];
        payload = parsedMsg[3];
        if (messageId && action) {
          messageActionMap.current[messageId] = action;
        }
      } else if (typeId === 3) {
        messageType = 'CALLRESULT';
        if (messageId && messageActionMap.current[messageId]) {
          action = messageActionMap.current[messageId];
        } else if (action === '-') {
          action = 'Response';
        }
        payload = parsedMsg[2];
      } else if (typeId === 4) {
        messageType = 'CALLERROR';
        if (messageId && messageActionMap.current[messageId]) {
          action = messageActionMap.current[messageId];
        } else {
          action = parsedMsg[2] || 'Error';
        }
        payload = {
          errorCode: parsedMsg[2],
          errorDescription: parsedMsg[3],
          errorDetails: parsedMsg[4]
        };
      }
    } else if (parsedMsg && typeof parsedMsg === 'object') {
      if (action === '-' && rawLog.direction === 'in') {
        if (parsedMsg.chargePointVendor) action = 'BootNotification';
        else if (parsedMsg.meterStart !== undefined || (parsedMsg.idTag && parsedMsg.connectorId)) action = 'StartTransaction';
        else if (parsedMsg.meterStop !== undefined) action = 'StopTransaction';
        else if (parsedMsg.meterValue) action = 'MeterValues';
        else if (parsedMsg.status && parsedMsg.errorCode) action = 'StatusNotification';
        else if (parsedMsg.idTag) action = 'Authorize';
      }
      payload = parsedMsg;
    }

    let enhancedAction = action;
    if (action === 'BootNotification') enhancedAction = 'Booting';
    if (action === 'StatusNotification' && payload?.status === 'Preparing') enhancedAction = 'Preparing transaction';
    if (action === 'Authorize') enhancedAction = 'OCPP authorization';
    if (action === 'StartTransaction') enhancedAction = 'OCPP start transaction';
    if (action === 'StopTransaction') enhancedAction = 'Commit transaction';
    if (action === 'MeterValues') enhancedAction = 'OCPP meter values';

    if (action === 'MeterValues' && payload?.meterValue) {
      let energyValue = 0;
      let powerValue = 0;
      const meterValuesArray = Array.isArray(payload.meterValue) ? payload.meterValue : [];
      for (const mv of meterValuesArray) {
        if (mv.sampledValue && Array.isArray(mv.sampledValue)) {
          for (const sv of mv.sampledValue) {
            const measurand = sv.measurand || "Energy.Active.Import.Register";
            if (measurand === "Energy.Active.Import.Register" || measurand === "Energy") {
              energyValue = parseFloat(sv.value);
            } else if (measurand === "Power.Active.Import" || measurand === "Power") {
              powerValue = parseFloat(sv.value);
            }
          }
        } else if (mv.value !== undefined) {
           energyValue = parseFloat(mv.value);
        }
      }
      payload = { ...payload, summary: `Power: ${powerValue > 0 ? (powerValue/1000).toFixed(2) : '-'} kW, Energy: ${energyValue > 0 ? (energyValue/1000).toFixed(2) : '-'} kWh` };
    }

    // Filter by connectorId only if explicitly targeting another non-zero connector
    if (payload?.connectorId !== undefined && payload.connectorId !== 0 && payload.connectorId !== connectorId) {
       return null;
    }

    // Check evseId for OCPP 2.0.1
    if (payload?.evseId !== undefined && payload.evseId !== connectorId && payload?.evse?.id !== connectorId) {
         return null;
    }

    return {
      id: rawLog.id?.toString() || Math.random().toString(36).substring(7),
      timestamp: new Date(rawLog.timestamp),
      chargePointId: rawLog.charger?.name || rawLog.chargerId?.toString() || chargerId.toString(),
      messageType,
      action: enhancedAction,
      payload,
      direction: rawLog.direction
    };
  }, [chargerId, connectorId]);

  const realtimeSocket = useTelemetryStore((state) => state.socket);

  useEffect(() => {
    if (!realtimeSocket) return;

    const handleRealtimeLog = (data: any) => {
      const rawLog = data?.log || data;
      if (!rawLog || Number(rawLog.chargerId) !== Number(chargerId)) return;
      const newLog = enrichLog(rawLog);
      if (newLog) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === newLog.id)) return prev;
          return [newLog, ...prev].slice(0, 50);
        });
      }
    };

    realtimeSocket.on("OCPP_LOG", handleRealtimeLog);

    return () => {
      realtimeSocket.off("OCPP_LOG", handleRealtimeLog);
    };
  }, [realtimeSocket, chargerId, enrichLog]);

  useEffect(() => {
    let isMounted = true;
    const fetchHistoricalLogs = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/chargers/${chargerId}/logs`);
        const data = response.data || [];

        if (!Array.isArray(data)) {
          if (isMounted) setLogs([]);
          return;
        }

        const chronologicalData = [...data].reverse();
        for (const log of chronologicalData) {
          try {
            const parsedMsg = typeof log.message === 'string' ? JSON.parse(log.message) : log.message;
            if (Array.isArray(parsedMsg) && parsedMsg[0] === 2 && parsedMsg[1] && parsedMsg[2]) {
              messageActionMap.current[parsedMsg[1]] = parsedMsg[2];
            }
          } catch {}
        }

        const historicalLogs = data
          .map(enrichLog)
          .filter(Boolean) as ChannelLog[];
        if (isMounted) setLogs(historicalLogs.slice(0, 50));
      } catch (error) {
        logger.debug("Failed to fetch historical logs via REST", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistoricalLogs();

    // Set up WebSocket connection for live logs as secondary transport
    let wsUrl = process.env.NEXT_PUBLIC_OCPP_LOGS_WS_URL;
    if (!wsUrl && typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const isAbsolute = apiUrl.startsWith('http');
      const isHttps = isAbsolute ? apiUrl.startsWith('https:') : window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = isAbsolute ? new URL(apiUrl).host : window.location.host;
      wsUrl = `${wsProtocol}//${host}/api/ocpp-logs`;
    } else if (!wsUrl) {
      wsUrl = 'ws://localhost:3000/api/ocpp-logs';
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      const delimiter = wsUrl.includes('?') ? '&' : '?';
      wsUrl += `${delimiter}token=${encodeURIComponent(token)}`;
    }
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'log' && Number(data.log?.chargerId) === Number(chargerId)) {
             const newLog = enrichLog(data.log);
             if (newLog) {
               setLogs(prev => {
                 if (prev.some(l => l.id === newLog.id)) return prev;
                 return [newLog, ...prev].slice(0, 50);
               });
             }
          }
        } catch {}
      };

      ws.onerror = (err) => {
        logger.debug("Raw WS fallback info for ChannelLogs (Socket.IO active):", err);
      };
    } catch (err) {
      logger.debug("Failed to connect to OCPP logs WS, using Socket.IO", err);
    }

    return () => {
      isMounted = false;
      if (ws) ws.close();
    };
  }, [chargerId, enrichLog]);

  return (
    <div className="mt-4 border rounded-md border-zinc-800 overflow-hidden bg-zinc-950">
      <div className="bg-zinc-900 px-4 py-2 flex gap-4 text-sm border-b border-zinc-800 overflow-x-auto whitespace-nowrap text-zinc-300">
        <span>Channel {connectorId}&apos;s log:</span>
      </div>
      <Table>
        <TableHeader className="sticky top-0 bg-zinc-900 z-10">
          <TableRow className="border-zinc-800 hover:bg-zinc-900">
            <TableHead className="text-zinc-400">Timestamp</TableHead>
            <TableHead className="text-zinc-400">Charger ID</TableHead>
            <TableHead className="text-zinc-400">Type</TableHead>
            <TableHead className="text-zinc-400">Action</TableHead>
            <TableHead className="text-zinc-400 w-1/2">Payload Snippet</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-zinc-500">Loading channel logs...</TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                No logs available for this channel
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <React.Fragment key={log.id}>
                <TableRow
                  className="border-zinc-800/50 hover:bg-zinc-800/50 font-mono text-xs cursor-pointer"
                  onClick={() => toggleRow(log.id)}
                >
                  <TableCell className="text-zinc-400 whitespace-nowrap">
                    {format(log.timestamp, 'HH:mm:ss.SSS')}
                  </TableCell>
                  <TableCell className="text-blue-400">
                    {log.chargePointId}
                  </TableCell>
                  <TableCell>
                    <span className={
                      log.messageType === 'CALL' ? 'text-purple-400' :
                      log.messageType === 'CALLRESULT' ? 'text-green-400' :
                      log.messageType === 'CALLERROR' ? 'text-red-400' :
                      log.direction === 'in' ? 'text-blue-400' : 'text-orange-400'
                    }>
                      {log.messageType}
                    </span>
                  </TableCell>
                  <TableCell className="text-yellow-200">
                    {log.action || '-'}
                  </TableCell>
                  <TableCell className="text-zinc-500 truncate max-w-md">
                    {JSON.stringify(log.payload)}
                  </TableCell>
                </TableRow>
                {expandedRowIds.has(log.id) && (
                  <TableRow className="border-zinc-800/50 hover:bg-zinc-800/50">
                    <TableCell colSpan={5} className="p-0 border-b border-zinc-800/50">
                      <div className="bg-zinc-950/50 p-4 font-mono text-xs whitespace-pre-wrap break-words break-all text-zinc-400">
                        {JSON.stringify(log.payload, null, 2)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
