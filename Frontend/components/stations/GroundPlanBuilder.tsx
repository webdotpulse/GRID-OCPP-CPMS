"use client";

import React, { useState, useEffect } from "react";
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, DragEndEvent } from "@dnd-kit/core";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Save, RotateCw, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

interface Connector {
  connector_id: number;
  connector_name: string;
}

interface Props {
  stationId: string;
  connectors: Connector[];
}

// A simple draggable item
function DraggableSpot({
  spot,
  onUpdate,
  onDelete,
  connectors
}: {
  spot: ParkingSpot;
  onUpdate: (id: number, updates: Partial<ParkingSpot>) => void;
  onDelete: (id: number) => void;
  connectors: Connector[];
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `spot-${spot.id}`,
    data: spot,
  });

  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${spot.rotation}deg)`
    : `rotate(${spot.rotation}deg)`;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        left: spot.x,
        top: spot.y,
        width: spot.width,
        height: spot.type === "line" ? (spot.lineWidth || 4) : spot.height,
        transform: transformStyle,
        ...(spot.type === "rectangle" ? {
          backgroundColor: spot.fillColor || "transparent",
          borderColor: spot.lineColor || "#0f172a", // slate-900
          borderWidth: `${spot.lineWidth || 2}px`,
          borderStyle: "solid"
        } : spot.type === "line" ? {
          backgroundColor: spot.lineColor || "#0f172a",
        } : {})
      }}
      className={`rounded flex flex-col items-center justify-center p-2 cursor-move shadow-md ${
        !spot.type || spot.type === "spot" ? "border-2 border-primary/50 bg-primary/10" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="absolute -top-8 right-0 flex space-x-1 opacity-0 hover:opacity-100 transition-opacity bg-white p-1 rounded shadow-lg border border-slate-200 z-10" onPointerDown={e => e.stopPropagation()}>
         <button
           onPointerDown={(e) => { e.stopPropagation(); onUpdate(spot.id, { rotation: (spot.rotation + 45) % 360 }); }}
           className="p-1 bg-white hover:bg-slate-100 rounded text-slate-700 text-xs"
           title="Rotate"
         >
           <RotateCw size={14} />
         </button>
         <button
           onPointerDown={(e) => { e.stopPropagation(); onDelete(spot.id); }}
           className="p-1 bg-white hover:bg-red-50 text-red-600 rounded text-xs"
           title="Delete"
         >
           <Trash2 size={14} />
         </button>
      </div>

      <div className="w-full text-center h-full flex flex-col items-center justify-center" onPointerDown={e => e.stopPropagation()}>
         {(!spot.type || spot.type !== "line") && (
           <Input
             value={spot.name}
             onChange={e => onUpdate(spot.id, { name: e.target.value })}
             className="h-6 text-xs text-center border-none bg-transparent font-bold text-slate-900 p-0 focus-visible:ring-0 shadow-none"
             placeholder={spot.type === "rectangle" ? "Label (Optional)" : "Spot Name"}
           />
         )}

         {(!spot.type || spot.type === "spot") && (
           <div className="mt-2 w-full text-center">
             <Select
               value={spot.connectorId?.toString() || "unassigned"}
               onValueChange={(val) => onUpdate(spot.id, { connectorId: val === "unassigned" ? undefined : val })}
             >
               <SelectTrigger className="h-6 text-[10px] w-full p-1 bg-white/70 border-none text-slate-800">
                 <SelectValue placeholder="No connector" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                 {connectors.map(c => (
                   <SelectItem key={c.connector_id} value={c.connector_id.toString()} className="text-xs">
                     {c.connector_name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         )}

         {(spot.type === "rectangle" || spot.type === "line") && (
            <div className="mt-1 flex gap-1 justify-center flex-wrap opacity-0 hover:opacity-100 transition-opacity bg-white/90 p-1 rounded">
               <input
                 type="color"
                 value={spot.lineColor || "#0f172a"}
                 onChange={e => onUpdate(spot.id, { lineColor: e.target.value })}
                 className="w-4 h-4 cursor-pointer p-0 border-0"
                 title="Line Color"
               />
               {spot.type === "rectangle" && (
                 <input
                   type="color"
                   value={spot.fillColor || "#ffffff"}
                   onChange={e => onUpdate(spot.id, { fillColor: e.target.value })}
                   className="w-4 h-4 cursor-pointer p-0 border-0"
                   title="Fill Color"
                 />
               )}
               <Input
                 type="number"
                 min="1"
                 max="20"
                 value={spot.lineWidth || 2}
                 onChange={e => onUpdate(spot.id, { lineWidth: parseInt(e.target.value) || 2 })}
                 className="w-12 h-4 text-[10px] p-0 text-center"
                 title="Line Width"
               />
               <Input
                 type="number"
                 min="10"
                 value={spot.width}
                 onChange={e => onUpdate(spot.id, { width: parseInt(e.target.value) || 100 })}
                 className="w-12 h-4 text-[10px] p-0 text-center"
                 title="Width"
               />
               <Input
                 type="number"
                 min="2"
                 value={spot.height}
                 onChange={e => onUpdate(spot.id, { height: parseInt(e.target.value) || 100 })}
                 className="w-12 h-4 text-[10px] p-0 text-center"
                 title="Height"
               />
            </div>
         )}
      </div>
    </div>
  );
}

export function GroundPlanBuilder({ stationId, connectors }: Props) {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
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
        toast.error("Failed to load ground plan");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [stationId]);

  const addSpot = () => {
    const newSpot: ParkingSpot = {
      id: Date.now(), // Temporary ID
      stationId: parseInt(stationId, 10),
      name: `Spot ${spots.length + 1}`,
      type: "spot",
      x: 50,
      y: 50,
      width: 100,
      height: 140,
      rotation: 0,
    };
    setSpots([...spots, newSpot]);
  };

  const addLine = () => {
    const newShape: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: "",
      type: "line",
      lineColor: "#0f172a",
      lineWidth: 4,
      x: 50,
      y: 50,
      width: 150,
      height: 4, // thin by default
      rotation: 0,
    };
    setSpots([...spots, newShape]);
  };

  const addRectangle = () => {
    const newShape: ParkingSpot = {
      id: Date.now(),
      stationId: parseInt(stationId, 10),
      name: `Area`,
      type: "rectangle",
      fillColor: "#e2e8f0",
      lineColor: "#64748b",
      lineWidth: 2,
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: 0,
    };
    setSpots([...spots, newShape]);
  };

  const updateSpot = (id: number, updates: Partial<ParkingSpot>) => {
    setSpots(spots.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSpot = (id: number) => {
    setSpots(spots.filter(s => s.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (active) {
      setSpots((prev) =>
        prev.map((spot) => {
          if (`spot-${spot.id}` === active.id) {
            // Round coordinates to nearest 10 for grid snapping
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
      toast.success("Ground plan saved successfully");
    } catch (err) {
      toast.error("Failed to save ground plan");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Ground Plan Builder</h3>
        <div className="space-x-2 flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={addSpot}>
            <Plus className="mr-2 h-4 w-4" /> Add Spot
          </Button>
          <Button variant="outline" size="sm" onClick={addRectangle}>
            <Plus className="mr-2 h-4 w-4" /> Draw Area
          </Button>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" /> Draw Line
          </Button>
          <Button size="sm" onClick={savePlan} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Plan"}
          </Button>
        </div>
      </div>

      <div className="relative w-full h-[600px] bg-slate-50 border rounded-xl overflow-hidden shadow-inner" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 0)', backgroundSize: '10px 10px' }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {spots.map((spot) => (
            <DraggableSpot
               key={spot.id}
               spot={spot}
               onUpdate={updateSpot}
               onDelete={deleteSpot}
               connectors={connectors}
            />
          ))}
        </DndContext>
      </div>
    </div>
  );
}
