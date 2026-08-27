"use client";

import React, { useState, useEffect } from "react";
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, DragEndEvent } from "@dnd-kit/core";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, RotateCw, Plus, Cable, Zap, Layers, Building, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TopologyOverlay } from "./ground-plan/TopologyOverlay";
import { TopologyControls } from "./ground-plan/TopologyControls";
import { TopologyNode, FeederCable, ViewMode, WiringMode } from "./ground-plan/types";

interface ParkingSpot {
  id: number;
  stationId: number;
  name: string;
  type?: string;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  connectorId?: string;
  connector?: any;
  metadata?: any;
}

interface Connector {
  connector_id: number;
  connector_name: string;
}

interface Props {
  stationId: string;
  connectors: Connector[];
}

function DraggableSpot({
  spot,
  onUpdate,
  onDelete,
  connectors,
  isWiringActive,
  onWiringSelect,
}: {
  spot: ParkingSpot;
  onUpdate: (id: number, updates: Partial<ParkingSpot>) => void;
  onDelete: (id: number) => void;
  connectors: Connector[];
  isWiringActive?: boolean;
  onWiringSelect?: (spot: ParkingSpot) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `spot-${spot.id}`,
    data: spot,
    disabled: isWiringActive,
  });

  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${spot.rotation}deg)`
    : `rotate(${spot.rotation}deg)`;

  const isElectricalNode = spot.type === "transformer" || spot.type === "distribution_board";

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: spot.x,
        top: spot.y,
        width: spot.width,
        height: spot.type === "line" ? spot.lineWidth || 4 : spot.height,
        transform: transformStyle,
        zIndex: isElectricalNode ? 25 : 10,
        ...(spot.type === "rectangle"
          ? {
              backgroundColor: spot.fillColor || "rgba(255, 255, 255, 0.05)",
              borderColor: spot.lineColor || "#334155",
              borderWidth: `${spot.lineWidth || 2}px`,
              borderStyle: "solid",
            }
          : spot.type === "line"
          ? {
              backgroundColor: spot.lineColor || "#475569",
            }
          : {}),
      }}
      onClick={() => {
        if (isWiringActive && onWiringSelect) {
          onWiringSelect(spot);
        }
      }}
      className={`rounded-xl flex flex-col items-center justify-center p-2 shadow-lg transition-colors ${
        isWiringActive ? "cursor-crosshair ring-2 ring-emerald-400/80 animate-pulse" : "cursor-move"
      } ${
        !spot.type || spot.type === "spot"
          ? "border-2 border-[#54a8c7]/50 bg-[#1e2228]/90 text-white backdrop-blur-md"
          : spot.type === "transformer"
          ? "border-2 border-cyan-400/80 bg-[#14171c]/95 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          : spot.type === "distribution_board"
          ? "border-2 border-amber-400/80 bg-[#14171c]/95 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          : ""
      }`}
      {...listeners}
      {...attributes}
    >
      {/* Quick Action Overlay */}
      <div
        className="absolute -top-7 right-0 flex space-x-1 opacity-0 hover:opacity-100 transition-opacity bg-[#1e2228] p-1 rounded-md shadow-xl border border-white/10 z-30"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onUpdate(spot.id, { rotation: (spot.rotation + 45) % 360 });
          }}
          className="p-1 hover:bg-white/10 rounded text-slate-300 text-xs"
          title="Rotate 45°"
        >
          <RotateCw size={12} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onDelete(spot.id);
          }}
          className="p-1 hover:bg-red-500/20 text-red-400 rounded text-xs"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div
        className="w-full text-center h-full flex flex-col items-center justify-center pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Transformer Icon & Label */}
        {spot.type === "transformer" && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">⚡</span>
            <Input
              value={spot.name}
              onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
              className="h-5 text-[11px] text-center border-none bg-transparent font-bold text-cyan-300 p-0 focus-visible:ring-0 shadow-none"
              placeholder="Transformer Name"
            />
            <span className="text-[9px] text-slate-400 font-mono">250 kVA Grid Infeed</span>
          </div>
        )}

        {/* Distribution Board Icon & Label */}
        {spot.type === "distribution_board" && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">🗄️</span>
            <Input
              value={spot.name}
              onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
              className="h-5 text-[11px] text-center border-none bg-transparent font-bold text-amber-300 p-0 focus-visible:ring-0 shadow-none"
              placeholder="Panel Name"
            />
            <span className="text-[9px] text-slate-400 font-mono">Main Panel DB</span>
          </div>
        )}

        {/* Spot Type (Charger) */}
        {(!spot.type || spot.type === "spot") && (
          <>
            <Input
              value={spot.name}
              onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
              className="h-5 text-xs text-center border-none bg-transparent font-bold text-white p-0 focus-visible:ring-0 shadow-none"
              placeholder="Spot Name"
            />
            <div className="mt-1 w-full text-center">
              <Select
                value={spot.connectorId || "none"}
                onValueChange={(val) =>
                  onUpdate(spot.id, { connectorId: val === "none" ? undefined : val })
                }
              >
                <SelectTrigger className="h-6 text-[10px] bg-black/40 border-white/10 text-slate-200">
                  <SelectValue placeholder="Map EVSE" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e2228] border-white/10 text-white text-xs">
                  <SelectItem value="none">-- Unassigned --</SelectItem>
                  {connectors.map((c, idx) => {
                    const cid = c.connector_id ?? (c as any).id ?? (c as any).connectorId ?? idx;
                    const cname = c.connector_name || (c as any).name || `Connector ${cid}`;
                    return (
                      <SelectItem key={cid} value={cid.toString()}>
                        {cname}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Areas and Lines */}
        {spot.type === "rectangle" && (
          <Input
            value={spot.name}
            onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
            className="h-5 text-xs text-center border-none bg-transparent font-bold text-slate-300 p-0 focus-visible:ring-0 shadow-none"
            placeholder="Label (Optional)"
          />
        )}
      </div>
    </div>
  );
}

export function GroundPlanBuilder({ stationId, connectors }: Props) {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("hybrid");
  const [wiringMode, setWiringMode] = useState<WiringMode>("idle");
  const [wiringSourceId, setWiringSourceId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/stations/${stationId}/parking-spots`);
        setSpots(
          res.data.map((s: any) => ({
            ...s,
            connectorId: s.connector ? s.connector.connector_id.toString() : undefined,
          }))
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load ground plan");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [stationId]);

  const addSpot = () => {
    const newSpot: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: `Spot ${spots.filter((s) => !s.type || s.type === "spot").length + 1}`,
      type: "spot",
      x: 100 + (spots.length % 5) * 110,
      y: 100,
      width: 100,
      height: 140,
      rotation: 0,
    };
    setSpots([...spots, newSpot]);
    toast.success("Added Charger Parking Spot");
  };

  const addTransformer = () => {
    const newTr: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: `TR-${spots.filter((s) => s.type === "transformer").length + 1}`,
      type: "transformer",
      x: 60,
      y: 60,
      width: 120,
      height: 90,
      rotation: 0,
      metadata: {
        ratingKva: 250,
        maxCurrentAmps: 400,
        gridConnectionVoltage: 400,
      },
    };
    setSpots([...spots, newTr]);
    toast.success("Added Grid Infeed Transformer");
  };

  const addDistributionBoard = () => {
    const newDb: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: `DB-${spots.filter((s) => s.type === "distribution_board").length + 1}`,
      type: "distribution_board",
      x: 200,
      y: 60,
      width: 110,
      height: 80,
      rotation: 0,
      metadata: {
        maxCurrentAmps: 200,
      },
    };
    setSpots([...spots, newDb]);
    toast.success("Added Distribution Sub-Panel");
  };

  const addLine = () => {
    const newShape: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: "",
      type: "line",
      lineColor: "#475569",
      lineWidth: 4,
      x: 100,
      y: 300,
      width: 200,
      height: 4,
      rotation: 0,
    };
    setSpots([...spots, newShape]);
  };

  const addRectangle = () => {
    const newShape: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: "Charging Bay",
      type: "rectangle",
      fillColor: "rgba(255, 255, 255, 0.03)",
      lineColor: "#475569",
      lineWidth: 2,
      x: 80,
      y: 80,
      width: 280,
      height: 160,
      rotation: 0,
    };
    setSpots([...spots, newShape]);
  };

  const handleStartWiring = () => {
    if (wiringMode !== "idle") {
      setWiringMode("idle");
      setWiringSourceId(null);
      toast.info("Wiring mode cancelled");
    } else {
      setWiringMode("select_source");
      toast.info("Click the source Transformer (⚡) or Distribution Panel (🗄️)");
    }
  };

  const handleWiringSelect = (spot: ParkingSpot) => {
    if (wiringMode === "select_source") {
      setWiringSourceId(spot.id);
      setWiringMode("select_target");
      toast.info(`Selected source ${spot.name}. Now click target Charger or Sub-Panel.`);
    } else if (wiringMode === "select_target" && wiringSourceId) {
      if (wiringSourceId === spot.id) {
        toast.error("Source and target cannot be the same node");
        return;
      }

      // Create new feeder cable linking source to target
      const newFeeder: ParkingSpot = {
        id: Date.now(),
        stationId: parseInt(stationId, 10),
        name: `Feeder-${spots.filter((s) => s.type === "feeder").length + 1}`,
        type: "feeder",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        metadata: {
          sourceNodeId: wiringSourceId,
          targetNodeId: spot.id,
          maxCurrentAmps: 160,
          cableType: "4x50mm² Cu",
          lengthMeters: 25,
        },
      };

      setSpots([...spots, newFeeder]);
      setWiringMode("idle");
      setWiringSourceId(null);
      toast.success(`Connected Feeder Cable from node #${wiringSourceId} to ${spot.name}`);
    }
  };

  const updateSpot = (id: number, updates: Partial<ParkingSpot>) => {
    setSpots(spots.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSpot = (id: number) => {
    // Delete spot and any associated feeders
    setSpots(
      spots.filter(
        (s) =>
          s.id !== id &&
          (s.type !== "feeder" || (s.metadata?.sourceNodeId !== id && s.metadata?.targetNodeId !== id))
      )
    );
    toast.info("Element removed");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (active) {
      setSpots((prev) =>
        prev.map((spot) => {
          if (`spot-${spot.id}` === active.id) {
            const snapToGrid = (val: number) => Math.round(val / 10) * 10;
            return {
              ...spot,
              x: Math.max(0, snapToGrid(spot.x + delta.x)),
              y: Math.max(0, snapToGrid(spot.y + delta.y)),
            };
          }
          return spot;
        })
      );
    }
  };

  const savePlan = async () => {
    setIsSaving(true);
    try {
      await api.put(`/stations/${stationId}/parking-spots`, { spots });
      toast.success("Ground plan and electrical topology saved successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save ground plan");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading ground plan editor...</div>;

  const topologyNodes: TopologyNode[] = spots
    .filter((s) => s.type !== "feeder")
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || "spot",
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      metadata: s.metadata,
    }));

  const feederCables: FeederCable[] = spots
    .filter((s) => s.type === "feeder")
    .map((s) => ({
      id: s.id,
      name: s.name,
      sourceNodeId: s.metadata?.sourceNodeId,
      targetNodeId: s.metadata?.targetNodeId,
      cableType: s.metadata?.cableType || "4x50mm² Cu",
      lengthMeters: s.metadata?.lengthMeters || 25,
      ratedCurrentAmps: s.metadata?.maxCurrentAmps || 160,
      activeCurrentL1: 0,
      activeCurrentL2: 0,
      activeCurrentL3: 0,
      maxPhaseCurrent: 0,
      loadPercentage: 0,
      loadLevel: "normal",
    }));

  return (
    <div className="space-y-4">
      {/* Topology Toolbar */}
      <TopologyControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddTransformer={addTransformer}
        onAddDistributionBoard={addDistributionBoard}
        onStartWiring={handleStartWiring}
        wiringMode={wiringMode}
        isEditMode={true}
      />

      {/* Editor Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e2228]/70 p-3 rounded-xl border border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={addSpot} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Plus className="mr-1.5 size-3.5 text-[#54a8c7]" /> Add Charger Spot
          </Button>
          <Button variant="outline" size="sm" onClick={addRectangle} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Plus className="mr-1.5 size-3.5" /> Draw Bay
          </Button>
          <Button variant="outline" size="sm" onClick={addLine} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Plus className="mr-1.5 size-3.5" /> Draw Line
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={savePlan}
            disabled={isSaving}
            className="bg-[#54a8c7] hover:bg-[#4596b4] text-white shadow-md shadow-[#54a8c7]/20"
          >
            <Save className="mr-1.5 size-3.5" /> {isSaving ? "Saving..." : "Save Topology Plan"}
          </Button>
        </div>
      </div>

      {/* Interactive Ground Plan Canvas */}
      <div
        className="relative w-full h-[650px] bg-[#12151a] border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)",
          backgroundSize: "20px 20px, 100px 100px, 100px 100px",
        }}
      >
        {/* SVG Cable Lines Layer */}
        {viewMode !== "architectural" && (
          <TopologyOverlay
            nodes={topologyNodes}
            feeders={feederCables}
            viewMode={viewMode}
            isInteractive={false}
            width={1200}
            height={650}
          />
        )}

        {/* Draggable Layout Elements */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {spots
            .filter((s) => s.type !== "feeder")
            .map((spot) => (
              <DraggableSpot
                key={spot.id}
                spot={spot}
                onUpdate={updateSpot}
                onDelete={deleteSpot}
                connectors={connectors}
                isWiringActive={wiringMode !== "idle"}
                onWiringSelect={handleWiringSelect}
              />
            ))}
        </DndContext>
      </div>
    </div>
  );
}
