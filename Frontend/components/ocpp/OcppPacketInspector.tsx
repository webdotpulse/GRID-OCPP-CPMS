"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import {
  Terminal,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Download,
  Search,
  Filter,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Pause,
  Play,
  FileCode,
  ShieldCheck,
  Zap,
  Code2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonTreeView } from "./JsonTreeView";
import { OcppSchemaValidator } from "./OcppSchemaValidator";
import { OcppFrame, OcppMessageType, OcppDirection, OcppInspectorFilter } from "./types";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

export function OcppPacketInspector() {
  const [frames, setFrames] = useState<OcppFrame[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("tree");

  // Filters
  const [filters, setFilters] = useState<OcppInspectorFilter>({
    search: "",
    action: "all",
    messageType: "all",
    direction: "all",
    chargerName: "",
    onlyErrors: false,
    onlySlow: false,
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const callTimestampMap = useRef<Record<string, number>>({});
  const messageActionMap = useRef<Record<string, string>>({});
  const listEndRef = useRef<HTMLDivElement>(null);

  // Enrich raw WebSocket log into structured OcppFrame
  const enrichRawLog = useCallback((rawLog: any): OcppFrame => {
    let parsedMsg: any = null;
    let messageType: OcppMessageType = rawLog.direction === "in" ? "CALL" : "CALLRESULT";
    let action = "Unknown";
    let messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let payload = rawLog.message;
    let errorCode: string | null = null;
    let errorDescription: string | null = null;

    try {
      if (typeof rawLog.message === "string") {
        parsedMsg = JSON.parse(rawLog.message);
      } else {
        parsedMsg = rawLog.message;
      }
    } catch {
      parsedMsg = rawLog.message;
    }

    if (Array.isArray(parsedMsg)) {
      const typeId = parsedMsg[0];
      messageId = String(parsedMsg[1]);

      if (typeId === 2) {
        messageType = "CALL";
        action = String(parsedMsg[2]);
        payload = parsedMsg[3] || {};
        if (messageId && action) {
          messageActionMap.current[messageId] = action;
          callTimestampMap.current[messageId] = new Date(rawLog.timestamp).getTime();
        }
      } else if (typeId === 3) {
        messageType = "CALLRESULT";
        payload = parsedMsg[2] || {};
        action = messageActionMap.current[messageId] || "Response";
      } else if (typeId === 4) {
        messageType = "CALLERROR";
        errorCode = String(parsedMsg[2]);
        errorDescription = String(parsedMsg[3]);
        payload = parsedMsg[4] || { errorCode, errorDescription };
        action = messageActionMap.current[messageId] || "Error";
      }
    } else if (parsedMsg && typeof parsedMsg === "object") {
      payload = parsedMsg;
      if (rawLog.direction === "in") {
        messageType = "CALL";
        if (parsedMsg.chargePointVendor) action = "BootNotification";
        else if (parsedMsg.meterStart !== undefined) action = "StartTransaction";
        else if (parsedMsg.meterStop !== undefined) action = "StopTransaction";
        else if (parsedMsg.meterValue) action = "MeterValues";
        else if (parsedMsg.status && parsedMsg.errorCode) action = "StatusNotification";
        else if (parsedMsg.idTag) action = "Authorize";
        else action = "Request";
      } else {
        messageType = "CALLRESULT";
        action = "Response";
      }
    }

    // Latency calculation
    let latencyMs: number | null = null;
    if (messageType === "CALLRESULT" || messageType === "CALLERROR") {
      const callTime = callTimestampMap.current[messageId];
      if (callTime) {
        latencyMs = Math.max(0, new Date(rawLog.timestamp).getTime() - callTime);
      }
    }

    // Schema Validation
    const validation = OcppSchemaValidator.validate(action, messageType, payload);

    let status: "success" | "error" | "slow" | "pending" = "success";
    if (messageType === "CALLERROR" || !validation.isValid) {
      status = "error";
    } else if (latencyMs && latencyMs > 3000) {
      status = "slow";
    }

    return {
      id: rawLog.id || `${Date.now()}-${Math.random()}`,
      chargerId: rawLog.chargerId || rawLog.charger?.charger_id || 0,
      chargerName: rawLog.charger?.name || `Charger #${rawLog.chargerId || "Unknown"}`,
      timestamp: new Date(rawLog.timestamp),
      direction: (rawLog.direction === "in" ? "in" : "out") as OcppDirection,
      messageType,
      action,
      messageId,
      rawMessage: parsedMsg,
      payload,
      latencyMs,
      status,
      errorCode,
      errorDescription,
      validation,
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    setIsLoading(true);
    let wsUrl = process.env.NEXT_PUBLIC_OCPP_LOGS_WS_URL;

    if (!wsUrl && typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const wsProtocol = isHttps ? "wss://" : "ws://";
      const host = window.location.host;
      wsUrl = `${wsProtocol}${host}/api/ocpp-logs`;
    } else if (!wsUrl) {
      wsUrl = "ws://localhost:3000/api/ocpp-logs";
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      const delimiter = wsUrl.includes("?") ? "&" : "?";
      wsUrl = `${wsUrl}${delimiter}token=${encodeURIComponent(token)}`;
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      logger.info("Connected to OCPP logs WebSocket");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "history") {
          const chronologicalLogs = Array.isArray(data.logs) ? data.logs : [];
          const enriched = chronologicalLogs.map(enrichRawLog);
          setFrames(enriched.reverse());
          if (enriched.length > 0 && !selectedFrameId) {
            setSelectedFrameId(enriched[0].id);
          }
          setIsLoading(false);
        } else if (data.type === "log") {
          const newFrame = enrichRawLog(data.log);
          setFrames((prev) => {
            if (isPaused) return prev;
            const updated = [newFrame, ...prev].slice(0, 1000);
            return updated;
          });
          setIsLoading(false);
        }
      } catch (err) {
        logger.error("Error parsing WS packet", err);
      }
    };

    socket.onerror = (error) => {
      logger.error("WebSocket error:", error);
      setIsLoading(false);
    };

    socket.onclose = () => {
      logger.info("WebSocket connection closed");
    };

    setWs(socket);
    return socket;
  }, [enrichRawLog, isPaused, selectedFrameId]);

  useEffect(() => {
    const socket = connectWebSocket();
    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [connectWebSocket]);

  // Filter frames
  const filteredFrames = frames.filter((frame) => {
    if (filters.action !== "all" && frame.action !== filters.action) return false;
    if (filters.messageType !== "all" && frame.messageType !== filters.messageType) return false;
    if (filters.direction !== "all" && frame.direction !== filters.direction) return false;
    if (filters.onlyErrors && frame.status !== "error" && frame.validation.isValid) return false;
    if (filters.onlySlow && (!frame.latencyMs || frame.latencyMs <= 3000)) return false;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchAction = frame.action.toLowerCase().includes(searchLower);
      const matchCharger = frame.chargerName.toLowerCase().includes(searchLower);
      const matchMsgId = frame.messageId.toLowerCase().includes(searchLower);
      const matchPayload = JSON.stringify(frame.payload).toLowerCase().includes(searchLower);
      if (!matchAction && !matchCharger && !matchMsgId && !matchPayload) return false;
    }

    return true;
  });

  const selectedFrame = frames.find((f) => f.id === selectedFrameId) || filteredFrames[0] || null;

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredFrames, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ocpp-diagnostic-capture-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success(`Exported ${filteredFrames.length} OCPP packet traces (.json)`);
  };

  const handleCopyJsonRpc = () => {
    if (!selectedFrame) return;
    const jsonRpc = selectedFrame.rawMessage
      ? JSON.stringify(selectedFrame.rawMessage, null, 2)
      : JSON.stringify(
          [
            selectedFrame.messageType === "CALL" ? 2 : selectedFrame.messageType === "CALLRESULT" ? 3 : 4,
            selectedFrame.messageId,
            selectedFrame.action,
            selectedFrame.payload,
          ],
          null,
          2
        );
    navigator.clipboard.writeText(jsonRpc);
    toast.success("Copied JSON-RPC frame to clipboard");
  };

  const handleCopyCurl = () => {
    if (!selectedFrame) return;
    const curl = `curl -X POST "http://localhost:3000/api/ocpp/test" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(selectedFrame.payload)}'`;
    navigator.clipboard.writeText(curl);
    toast.success("Copied cURL snippet to clipboard");
  };

  const clearFrames = () => {
    setFrames([]);
    setSelectedFrameId(null);
    toast.info("Packet buffer cleared");
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#1e2228]/90 border border-white/10 p-3.5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              placeholder="Search Action, MsgId, Charger or payload..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-8 text-xs rounded-lg"
            />
          </div>

          {/* Action Filter */}
          <Select
            value={filters.action}
            onValueChange={(val) => setFilters({ ...filters, action: val })}
          >
            <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10 text-white rounded-lg">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e2228] border-white/10 text-white text-xs">
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="BootNotification">BootNotification</SelectItem>
              <SelectItem value="Authorize">Authorize</SelectItem>
              <SelectItem value="StartTransaction">StartTransaction</SelectItem>
              <SelectItem value="StopTransaction">StopTransaction</SelectItem>
              <SelectItem value="MeterValues">MeterValues</SelectItem>
              <SelectItem value="StatusNotification">StatusNotification</SelectItem>
              <SelectItem value="Heartbeat">Heartbeat</SelectItem>
              <SelectItem value="SetChargingProfile">SetChargingProfile</SelectItem>
              <SelectItem value="DataTransfer">DataTransfer</SelectItem>
            </SelectContent>
          </Select>

          {/* Message Type Filter */}
          <Select
            value={filters.messageType}
            onValueChange={(val) => setFilters({ ...filters, messageType: val })}
          >
            <SelectTrigger className="w-32 h-8 text-xs bg-white/5 border-white/10 text-white rounded-lg">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e2228] border-white/10 text-white text-xs">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="CALL">CALL (Req)</SelectItem>
              <SelectItem value="CALLRESULT">CALLRESULT (Res)</SelectItem>
              <SelectItem value="CALLERROR">CALLERROR (Err)</SelectItem>
            </SelectContent>
          </Select>

          {/* Error Only Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ ...filters, onlyErrors: !filters.onlyErrors })}
            className={`h-8 px-2.5 text-xs rounded-lg font-semibold border ${
              filters.onlyErrors
                ? "bg-red-500/20 border-red-500/40 text-red-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <AlertCircle className="size-3 mr-1" />
            Errors Only
          </Button>

          {/* Slow Latency Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ ...filters, onlySlow: !filters.onlySlow })}
            className={`h-8 px-2.5 text-xs rounded-lg font-semibold border ${
              filters.onlySlow
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="size-3 mr-1" />
            Slow (&gt;3s)
          </Button>
        </div>

        {/* Capture Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className={`h-8 text-xs rounded-lg ${
              isPaused ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-white/5 border-white/10 text-white"
            }`}
          >
            {isPaused ? <Play className="size-3.5 mr-1" /> : <Pause className="size-3.5 mr-1" />}
            {isPaused ? "Resume Live" : "Pause Stream"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearFrames}
            className="h-8 text-xs bg-white/5 border-white/10 text-slate-300 hover:text-red-400 rounded-lg"
          >
            <Trash2 className="size-3.5 mr-1" /> Clear
          </Button>

          <Button
            size="sm"
            onClick={handleExportJson}
            className="h-8 text-xs bg-gradient-to-r from-[#54a8c7] to-[#3f78e0] text-white rounded-lg shadow-md"
          >
            <Download className="size-3.5 mr-1" /> Export Capture (.json)
          </Button>
        </div>
      </div>

      {/* Main Wireshark Two-Pane Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[720px]">
        {/* Left Pane: Packet Stream List (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col bg-[#14171c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Packet Table Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white/5 border-b border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
            <div className="col-span-2">Time / Latency</div>
            <div className="col-span-3">Charger</div>
            <div className="col-span-2 text-center">Type</div>
            <div className="col-span-3">Action</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {/* Packet Scrollable Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {isLoading && frames.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[#54a8c7]" />
                Listening for WebSocket OCPP packets...
              </div>
            ) : filteredFrames.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No OCPP packets match current filter criteria.
              </div>
            ) : (
              filteredFrames.map((frame) => {
                const isSelected = selectedFrame?.id === frame.id;
                const isCall = frame.messageType === "CALL";
                const isError = frame.messageType === "CALLERROR" || !frame.validation.isValid;
                const isSlow = frame.latencyMs && frame.latencyMs > 3000;

                return (
                  <div
                    key={frame.id}
                    onClick={() => setSelectedFrameId(frame.id)}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 text-xs font-mono items-center cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#54a8c7]/20 border-l-4 border-l-[#54a8c7] text-white"
                        : "hover:bg-white/[0.03] text-slate-300"
                    } ${isError ? "bg-red-500/5 hover:bg-red-500/10" : ""}`}
                  >
                    {/* Timestamp & Latency */}
                    <div className="col-span-2 flex flex-col">
                      <span className="text-[11px] text-slate-400">
                        {format(frame.timestamp, "HH:mm:ss.SSS")}
                      </span>
                      {frame.latencyMs !== null && frame.latencyMs !== undefined && (
                        <span
                          className={`text-[9px] font-bold ${
                            isSlow ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          +{frame.latencyMs}ms
                        </span>
                      )}
                    </div>

                    {/* Charger Identity */}
                    <div className="col-span-3 truncate text-[11px] font-semibold text-slate-200">
                      {frame.chargerName}
                    </div>

                    {/* Direction & Message Type */}
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      {frame.direction === "in" ? (
                        <span className="text-cyan-400 text-[10px]" title="Charger ➔ Central System">
                          <ArrowDownLeft className="size-3.5 inline" />
                        </span>
                      ) : (
                        <span className="text-purple-400 text-[10px]" title="Central System ➔ Charger">
                          <ArrowUpRight className="size-3.5 inline" />
                        </span>
                      )}

                      <Badge
                        className={`text-[9px] px-1 py-0 font-bold ${
                          frame.messageType === "CALL"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : frame.messageType === "CALLRESULT"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        }`}
                      >
                        {frame.messageType}
                      </Badge>
                    </div>

                    {/* Action */}
                    <div className="col-span-3 truncate font-bold text-white text-[11px]">
                      {frame.action}
                    </div>

                    {/* Status Badge */}
                    <div className="col-span-2 text-right">
                      {isError ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] py-0">
                          Error
                        </Badge>
                      ) : isSlow ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] py-0">
                          Slow
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] py-0">
                          OK
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listEndRef} />
          </div>

          {/* Stream Footer Bar */}
          <div className="p-2.5 bg-white/5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {filteredFrames.length} packets displayed ({frames.length} in buffer)
              </span>
            </div>
            <span>WebSocket Port: 9220 (RFC 6455)</span>
          </div>
        </div>

        {/* Right Pane: Deep Packet Inspector (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col bg-[#14171c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {selectedFrame ? (
            <div className="flex flex-col h-full">
              {/* Selected Frame Header Info */}
              <div className="p-3.5 bg-white/5 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#54a8c7]/20 text-[#54a8c7] border-[#54a8c7]/30 text-xs">
                      {selectedFrame.action}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-white">
                      MsgId: {selectedFrame.messageId}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyJsonRpc}
                      className="h-7 text-xs text-slate-300 hover:text-white"
                      title="Copy JSON-RPC Frame"
                    >
                      <Copy className="size-3 mr-1" /> Frame
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCurl}
                      className="h-7 text-xs text-slate-300 hover:text-white"
                      title="Copy cURL snippet"
                    >
                      <Code2 className="size-3 mr-1" /> cURL
                    </Button>
                  </div>
                </div>

                {/* Packet Meta Details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                  <div>
                    Source: <span className="text-white">{selectedFrame.chargerName}</span>
                  </div>
                  <div>
                    Direction:{" "}
                    <span className="text-white">
                      {selectedFrame.direction === "in" ? "Charger ➔ CSMS" : "CSMS ➔ Charger"}
                    </span>
                  </div>
                  <div>
                    Timestamp:{" "}
                    <span className="text-white">
                      {format(selectedFrame.timestamp, "yyyy-MM-dd HH:mm:ss.SSS")}
                    </span>
                  </div>
                  <div>
                    Roundtrip Latency:{" "}
                    <span
                      className={
                        selectedFrame.latencyMs && selectedFrame.latencyMs > 3000
                          ? "text-amber-400 font-bold"
                          : "text-emerald-400 font-bold"
                      }
                    >
                      {selectedFrame.latencyMs ? `${selectedFrame.latencyMs} ms` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inspector Tabs */}
              <Tabs defaultValue="tree" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="px-3 pt-2 bg-white/5 border-b border-white/10">
                  <TabsList className="bg-black/30 border border-white/10 h-8">
                    <TabsTrigger value="tree" className="text-xs h-6 px-3">
                      <FileCode className="size-3.5 mr-1" /> Decoded Tree
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs h-6 px-3">
                      <ShieldCheck className="size-3.5 mr-1" /> Schema (
                      {selectedFrame.validation.violations.length})
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs h-6 px-3">
                      <Code2 className="size-3.5 mr-1" /> Raw JSON-RPC
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab 1: Collapsible Decoded Tree */}
                <TabsContent value="tree" className="flex-1 p-4 overflow-y-auto m-0">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10">
                    <JsonTreeView
                      data={selectedFrame.payload}
                      violations={selectedFrame.validation.violations}
                      initialExpanded={true}
                    />
                  </div>
                </TabsContent>

                {/* Tab 2: Schema Validation Report */}
                <TabsContent value="schema" className="flex-1 p-4 overflow-y-auto m-0 space-y-3">
                  {selectedFrame.validation.violations.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                      <ShieldCheck className="size-8 mx-auto mb-2 text-emerald-400" />
                      <p className="font-bold">100% Schema Compliant</p>
                      <p className="text-slate-400 mt-1">
                        All mandatory fields, enums, and data types conform to OCPP 1.6 / 2.0.1 specification.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-300">
                        {selectedFrame.validation.violations.length} Compliance Findings Detected:
                      </p>
                      {selectedFrame.validation.violations.map((v, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                            v.severity === "error"
                              ? "bg-red-500/10 border-red-500/30 text-red-300"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          }`}
                        >
                          <AlertCircle className="size-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold font-mono block text-white">{v.field}</span>
                            <span className="text-slate-300">{v.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tab 3: Raw Frame */}
                <TabsContent value="raw" className="flex-1 p-4 overflow-y-auto m-0">
                  <pre className="p-3 bg-black/60 rounded-xl border border-white/10 text-xs font-mono text-cyan-300 overflow-x-auto select-text">
                    {selectedFrame.rawMessage
                      ? JSON.stringify(selectedFrame.rawMessage, null, 2)
                      : JSON.stringify(
                          [
                            selectedFrame.messageType === "CALL"
                              ? 2
                              : selectedFrame.messageType === "CALLRESULT"
                              ? 3
                              : 4,
                            selectedFrame.messageId,
                            selectedFrame.action,
                            selectedFrame.payload,
                          ],
                          null,
                          2
                        )}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 text-xs">
              <Terminal className="size-10 mb-2 opacity-40 text-[#54a8c7]" />
              <p className="font-bold text-slate-400">No Packet Selected</p>
              <p>Click on any OCPP frame in the stream to inspect decoded payload & schema.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
