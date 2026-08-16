"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Terminal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function OcppLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [ws, setWs] = useState<WebSocket | null>(null);
  const messageActionMap = useRef<Record<string, string>>({});

  const enrichLog = useCallback((rawLog: any) => {
    let parsedMsg: any = null;
    let messageType = rawLog.direction === 'in' ? 'RX' : 'TX';
    let action = '-';
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
        } else {
          action = 'Response';
        }
        payload = parsedMsg[2];
      } else if (typeId === 4) {
        messageType = 'CALLERROR';
        if (messageId && messageActionMap.current[messageId]) {
          action = messageActionMap.current[messageId];
        } else {
          action = 'Error';
        }
        payload = parsedMsg.slice(2);
      }
    } else if (parsedMsg && typeof parsedMsg === 'object') {
      // Handle bare payload objects mapped historically or sent directly
      if (rawLog.direction === 'in') {
        messageType = 'CALL';
        action = 'Request';
        if (parsedMsg.chargePointVendor) action = 'BootNotification';
        else if (parsedMsg.meterStart !== undefined || (parsedMsg.idTag && parsedMsg.connectorId)) action = 'StartTransaction';
        else if (parsedMsg.meterStop !== undefined) action = 'StopTransaction';
        else if (parsedMsg.meterValue) action = 'MeterValues';
        else if (parsedMsg.status && parsedMsg.errorCode) action = 'StatusNotification';
        else if (parsedMsg.idTag) action = 'Authorize';
      } else {
        messageType = 'CALLRESULT';
        action = 'Response';
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

    return {
      ...rawLog,
      timestamp: new Date(rawLog.timestamp),
      chargePointId: rawLog.charger?.name || rawLog.chargerId?.toString() || 'Unknown',
      messageType,
      action: enhancedAction,
      payload,
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    setIsLoading(true);
    let wsUrl = process.env.NEXT_PUBLIC_OCPP_LOGS_WS_URL;

    if (!wsUrl && typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss://' : 'ws://';
      // Route through the Next.js API proxy or directly to the backend
      const host = window.location.host;
      wsUrl = `${wsProtocol}${host}/api/ocpp-logs`;
    } else if (!wsUrl) {
      wsUrl = 'ws://localhost:3000/api/ocpp-logs';
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      const delimiter = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${delimiter}token=${encodeURIComponent(token)}`;
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      logger.info('Connected to OCPP logs WebSocket');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          // Pre-populate message action map chronologically (data.logs is oldest to newest or vice-versa, depending on backend)
          // The backend currently sends in chronological order. We should process it as such.
          const chronologicalData = Array.isArray(data.logs) ? data.logs : [];
          for (const log of chronologicalData) {
            try {
              const parsedMsg = typeof log.message === 'string' ? JSON.parse(log.message) : log.message;
              if (Array.isArray(parsedMsg) && parsedMsg[0] === 2 && parsedMsg[1] && parsedMsg[2]) {
                messageActionMap.current[parsedMsg[1]] = parsedMsg[2];
              }
            } catch {
              // Ignore parse errors
            }
          }

          // Reverse history so newest logs appear at the top
          setLogs([...data.logs].reverse().map(enrichLog));
          setIsLoading(false);
        } else if (data.type === 'log') {
          setLogs(prev => [enrichLog(data.log), ...prev].slice(0, 500)); 
          setIsLoading(false);
        }
      } catch (err) {
        logger.error('Error parsing WS message', err);
      }
    };

    socket.onerror = (error) => {
      logger.error('WebSocket error:', error);
      setIsLoading(false);
    };

    socket.onclose = () => {
      logger.info('WebSocket connection closed');
    };

    setWs(socket);
    return socket;
  }, [enrichLog]);

  useEffect(() => {
    const socket = connectWebSocket();
    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [connectWebSocket]);

  const handleRefresh = () => {
    if (ws) ws.close();
    setLogs([]);
    connectWebSocket();
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.messageType !== filter) return false;
    if (search && !log.action?.toLowerCase().includes(search.toLowerCase()) && !log.chargePointId?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).slice(0, 100); // Limit to latest 100 for performance

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" /> Live OCPP Logs
            </CardTitle>
            <CardDescription>Real-time communication trace between Central System and Charge Points.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
        
        <div className="flex gap-4 pt-4">
          <Input 
            placeholder="Search Action or Charger ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Message Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="CALL">CALL (req)</SelectItem>
              <SelectItem value="CALLRESULT">CALLRESULT (res)</SelectItem>
              <SelectItem value="CALLERROR">CALLERROR (err)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border h-[500px] overflow-auto relative bg-zinc-950">
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
                  <TableCell colSpan={5} className="h-24 text-center text-zinc-500">Loading system logs...</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                    No logs found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any, i: number) => (
                  <TableRow key={log.id || i} className="border-zinc-800/50 hover:bg-zinc-800/50 font-mono text-xs">
                    <TableCell className="text-zinc-400 whitespace-nowrap">
                      {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                    </TableCell>
                    <TableCell className="text-blue-400">
                      {log.chargePointId}
                    </TableCell>
                    <TableCell>
                      <span className={
                        log.messageType === 'CALL' ? 'text-purple-400' :
                        log.messageType === 'CALLRESULT' ? 'text-green-400' :
                        'text-red-400'
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
