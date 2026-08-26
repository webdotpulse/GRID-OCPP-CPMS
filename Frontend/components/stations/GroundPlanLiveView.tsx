"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { api } from "@/lib/api";
import { Zap, BatteryCharging, AlertTriangle, User, Power, ShieldCheck, Gauge, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { TopologyOverlay } from "./ground-plan/TopologyOverlay";
import { TopologyControls } from "./ground-plan/TopologyControls";
import { PhaseBalanceInspector } from "./ground-plan/PhaseBalanceInspector";
import { StationTopologyData, TopologyNode, FeederCable, ViewMode } from "./ground-plan/types";

interface Props {
  stationId: string;
}

export function GroundPlanLiveView({ stationId }: Props) {
  const [topologyData, setTopologyData] = useState<StationTopologyData | null>(null);
  const [spots, setSpots] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("hybrid");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const { sessions, chargers, socket, fetchSessions, fetchChargers } = useTelemetryStore();

  const loadTopology = useCallback(async () => {
    try {
      const [spotsRes, topologyRes] = await Promise.all([
        api.get(`/stations/${stationId}/parking-spots`),
        api.get(`/stations/${stationId}/topology`),
      ]);

      setSpots(spotsRes.data || []);
      setTopologyData(topologyRes.data?.data || null);
    } catch (err) {
      console.error("Failed to load ground plan live topology:", err);
    } finally {
      setIsLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchSessions();
    fetchChargers();
    loadTopology();

    // Polling fallback every 10 seconds for live telemetry refresh
    const interval = setInterval(loadTopology, 10000);
    return () => clearInterval(interval);
  }, [loadTopology, fetchSessions, fetchChargers]);

  // Listen to live Socket.IO events for instantaneous updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadTopology();
      fetchSessions();
      fetchChargers();
    };

    socket.on("CHARGER_STATUS_UPDATE", handleUpdate);
    socket.on("METER_VALUES", handleUpdate);

    return () => {
      socket.off("CHARGER_STATUS_UPDATE", handleUpdate);
      socket.off("METER_VALUES", handleUpdate);
    };
  }, [socket, loadTopology, fetchSessions, fetchChargers]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-[#1e2228]/50 rounded-2xl border border-white/10 animate-pulse">
        <Activity className="size-8 animate-spin mx-auto mb-3 text-[#54a8c7]" />
        Loading Live Electrical Topology & Cable Grid...
      </div>
    );
  }

  const nodes: TopologyNode[] = topologyData?.nodes || spots.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type || "spot",
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    rotation: s.rotation || 0,
    fillColor: s.fillColor,
    lineColor: s.lineColor,
    lineWidth: s.lineWidth,
    connectorId: s.connector?.connector_id,
    chargerId: s.connector?.evse?.charger_id,
    metadata: s.metadata,
  }));

  const feeders: FeederCable[] = topologyData?.feeders || [];

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      <TopologyControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        topologyData={topologyData}
        isEditMode={false}
      />

      {/* Main Ground Plan & Electrical Canvas */}
      <div
        className="relative w-full h-[750px] bg-[#12151a] border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
          backgroundSize: "20px 20px, 100px 100px, 100px 100px",
        }}
      >
        {/* SVG Electrical Feeder Cable Overlay */}
        <TopologyOverlay
          nodes={nodes}
          feeders={feeders}
          viewMode={viewMode}
          isInteractive={true}
          onNodeClick={(node) => setSelectedNode(node)}
          width={1200}
          height={750}
        />

        {/* Architectural Parking Spots Layer */}
        {viewMode !== "topology" &&
          spots.map((spot) => {
            // Ignore feeders and transformers in architectural parking spot renderer
            if (spot.type === "feeder" || spot.type === "transformer" || spot.type === "distribution_board") {
              return null;
            }

            if (spot.type === "rectangle" || spot.type === "line") {
              return (
                <motion.div
                  key={spot.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: "absolute",
                    left: spot.x,
                    top: spot.y,
                    width: spot.width,
                    height: spot.type === "line" ? spot.lineWidth || 4 : spot.height,
                    transform: `rotate(${spot.rotation}deg)`,
                    ...(spot.type === "rectangle"
                      ? {
                          backgroundColor: spot.fillColor || "rgba(255, 255, 255, 0.03)",
                          borderColor: spot.lineColor || "rgba(255, 255, 255, 0.15)",
                          borderWidth: `${spot.lineWidth || 1}px`,
                          borderStyle: "solid",
                        }
                      : {
                          backgroundColor: spot.lineColor || "rgba(255, 255, 255, 0.2)",
                        }),
                  }}
                  className="rounded flex flex-col items-center justify-center pointer-events-none"
                >
                  {spot.name && spot.type === "rectangle" && (
                    <span className="text-slate-300 font-bold text-center text-xs px-2 py-0.5 bg-black/50 rounded backdrop-blur-sm">
                      {spot.name}
                    </span>
                  )}
                </motion.div>
              );
            }

            // Find matching active session for the connected socket
            const activeSession = sessions.find(
              (s) =>
                spot.connector &&
                s.chargerName === spot.connector?.evse?.charger?.name &&
                s.connectorName === spot.connector?.connector_name
            );

            // Find charger status
            const chargerStatus = spot.connector
              ? chargers.find((c) => c.name === spot.connector?.evse?.charger?.name)
              : null;

            // Find telemetry from topologyData
            const nodeTelemetry = topologyData?.nodes?.find(
              (n) => n.id === spot.id || n.chargerId === spot.connector?.evse?.charger_id
            )?.telemetry;

            let state: "empty" | "idle" | "charging" | "faulted" = "empty";
            if (spot.connector) {
              if (chargerStatus?.status === "Faulted") state = "faulted";
              else if (activeSession || (nodeTelemetry && nodeTelemetry.activePowerKw > 0.1)) state = "charging";
              else state = "idle";
            }

            return (
              <motion.div
                key={spot.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "absolute",
                  left: spot.x,
                  top: spot.y,
                  width: spot.width,
                  height: spot.height,
                  transform: `rotate(${spot.rotation}deg)`,
                }}
                onClick={() => {
                  if (nodeTelemetry) {
                    setSelectedNode({
                      id: spot.id,
                      name: spot.name,
                      type: "spot",
                      x: spot.x,
                      y: spot.y,
                      width: spot.width,
                      height: spot.height,
                      rotation: spot.rotation,
                      telemetry: nodeTelemetry,
                    });
                  }
                }}
                className={`
                  rounded-xl border-2 backdrop-blur-md shadow-xl flex flex-col items-center justify-between p-2.5 transition-all duration-300 cursor-pointer
                  ${state === "empty" ? "border-white/10 bg-white/[0.02] border-dashed" : ""}
                  ${state === "idle" ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:border-cyan-400" : ""}
                  ${state === "charging" ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:border-emerald-400" : ""}
                  ${state === "faulted" ? "border-red-500/60 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse" : ""}
                `}
              >
                {/* Spot Label */}
                <div className="w-full flex items-center justify-between text-[11px] font-bold text-white">
                  <span className="truncate">{spot.name}</span>
                  {state === "charging" && (
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                </div>

                {/* State Body */}
                {state === "empty" && (
                  <div className="text-slate-500 text-[10px] text-center my-auto">
                    No EVSE Plug
                  </div>
                )}

                {state === "idle" && (
                  <div className="flex flex-col items-center my-auto text-cyan-400">
                    <Zap className="size-6 mb-1 opacity-90" />
                    <span className="text-[9px] uppercase font-bold tracking-wider">Available</span>
                    <span className="text-[10px] text-slate-300 truncate max-w-[90px]">
                      {spot.connector?.evse?.charger?.name}
                    </span>
                  </div>
                )}

                {state === "charging" && (
                  <div className="flex flex-col items-center my-auto text-emerald-400">
                    <BatteryCharging className="size-6 mb-1 animate-pulse" />
                    <span className="text-[9px] uppercase font-bold tracking-wider">Charging</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {(nodeTelemetry?.activePowerKw || activeSession?.currentPower || 11.0).toFixed(1)} kW
                    </span>
                  </div>
                )}

                {state === "faulted" && (
                  <div className="flex flex-col items-center my-auto text-red-400">
                    <AlertTriangle className="size-6 mb-1" />
                    <span className="text-[9px] uppercase font-bold tracking-wider">Faulted</span>
                  </div>
                )}

                {/* Phase Mini Indicator Bar */}
                {nodeTelemetry && nodeTelemetry.activePowerKw > 0 && (
                  <div className="w-full pt-1 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-slate-300">
                    <span className="text-cyan-300">{nodeTelemetry.currentL1.toFixed(0)}A</span>
                    <span className="text-emerald-300">{nodeTelemetry.currentL2.toFixed(0)}A</span>
                    <span className="text-amber-300">{nodeTelemetry.currentL3.toFixed(0)}A</span>
                  </div>
                )}
              </motion.div>
            );
          })}
      </div>

      {/* Static Selected Node Phase Balance Inspector Modal / Dock */}
      {selectedNode && selectedNode.telemetry && (
        <div className="p-4 rounded-xl bg-[#1e2228] border border-white/15 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <PhaseBalanceInspector
            telemetry={selectedNode.telemetry}
            title={selectedNode.name}
            subtitle={`Node ID #${selectedNode.id} • Charger #${selectedNode.chargerId || "N/A"}`}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}
