"use client";

import React, { useState } from "react";
import { TopologyNode, FeederCable, PhaseTelemetry, ViewMode } from "./types";
import { Zap, AlertTriangle, ShieldCheck, Activity, Gauge, Flame } from "lucide-react";
import { PhaseBalanceInspector } from "./PhaseBalanceInspector";

interface Props {
  nodes: TopologyNode[];
  feeders: FeederCable[];
  viewMode?: ViewMode;
  isInteractive?: boolean;
  onNodeClick?: (node: TopologyNode) => void;
  onCableClick?: (feeder: FeederCable) => void;
  width?: number;
  height?: number;
}

export function TopologyOverlay({
  nodes,
  feeders,
  viewMode = "hybrid",
  isInteractive = true,
  onNodeClick,
  onCableClick,
  width = 1200,
  height = 800,
}: Props) {
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [hoveredCable, setHoveredCable] = useState<FeederCable | null>(null);
  const [inspectorPosition, setInspectorPosition] = useState<{ x: number; y: number } | null>(null);

  if (viewMode === "architectural") {
    return null;
  }

  // Helper to get center coordinates of any node
  const getNodeCenter = (nodeId?: number) => {
    if (!nodeId) return null;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    };
  };

  const getCableStrokeColor = (level: "normal" | "warning" | "critical") => {
    switch (level) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "normal":
      default:
        return "#10b981";
    }
  };

  const getCableGlowFilter = (level: "normal" | "warning" | "critical") => {
    switch (level) {
      case "critical":
        return "url(#glow-critical)";
      case "warning":
        return "url(#glow-warning)";
      case "normal":
      default:
        return "url(#glow-normal)";
    }
  };

  return (
    <>
      {/* SVG Canvas Overlay */}
      <svg
        className="absolute inset-0 pointer-events-none w-full h-full z-20 overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          {/* Neon Glow Filters */}
          <filter id="glow-normal" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.7" />
          </filter>
          <filter id="glow-warning" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.8" />
          </filter>
          <filter id="glow-critical" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.9" />
          </filter>

          {/* Animation Styles */}
          <style>
            {`
              @keyframes flowAnimationNormal {
                from { stroke-dashoffset: 40; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes flowAnimationWarning {
                from { stroke-dashoffset: 40; }
                to { stroke-dashoffset: 0; }
              }
              @keyframes flowAnimationCritical {
                0% { stroke-dashoffset: 40; opacity: 1; }
                50% { opacity: 0.5; }
                100% { stroke-dashoffset: 0; opacity: 1; }
              }
              .flow-line-normal {
                stroke-dasharray: 6, 10;
                animation: flowAnimationNormal 1.4s linear infinite;
              }
              .flow-line-warning {
                stroke-dasharray: 6, 8;
                animation: flowAnimationWarning 0.8s linear infinite;
              }
              .flow-line-critical {
                stroke-dasharray: 8, 6;
                animation: flowAnimationCritical 0.4s linear infinite;
              }
            `}
          </style>
        </defs>

        {/* Render Feeder Cables */}
        {feeders.map((feeder) => {
          let p1 = getNodeCenter(feeder.sourceNodeId);
          let p2 = getNodeCenter(feeder.targetNodeId);

          if (!p1 || !p2) {
            if (feeder.points) {
              p1 = { x: feeder.points.x1, y: feeder.points.y1 };
              p2 = { x: feeder.points.x2, y: feeder.points.y2 };
            } else {
              return null;
            }
          }

          // Generate smooth cubic bezier curve
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const cx1 = p1.x + dx * 0.5;
          const cy1 = p1.y;
          const cx2 = p1.x + dx * 0.5;
          const cy2 = p2.y;
          const pathD = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const strokeColor = getCableStrokeColor(feeder.loadLevel);
          const hasFlow = feeder.maxPhaseCurrent > 0.5;

          return (
            <g key={`feeder-${feeder.id}`} className="transition-all duration-300">
              {/* Cable Outer Glow / Shadow */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={feeder.loadLevel === "critical" ? 7 : 5}
                strokeOpacity={feeder.loadLevel === "critical" ? 0.4 : 0.25}
                filter={getCableGlowFilter(feeder.loadLevel)}
              />

              {/* Cable Base Conduit */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeOpacity={0.8}
              />

              {/* Live Animated Current Pulse */}
              {hasFlow && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className={
                    feeder.loadLevel === "critical"
                      ? "flow-line-critical"
                      : feeder.loadLevel === "warning"
                      ? "flow-line-warning"
                      : "flow-line-normal"
                  }
                />
              )}

              {/* Interactive Hit Area */}
              {isInteractive && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={(e) => {
                    setHoveredCable(feeder);
                    setInspectorPosition({ x: midX, y: midY });
                  }}
                  onMouseLeave={() => {
                    setHoveredCable(null);
                    setInspectorPosition(null);
                  }}
                  onClick={() => onCableClick?.(feeder)}
                />
              )}

              {/* Midpoint Cable Load Pill */}
              <g
                transform={`translate(${midX}, ${midY})`}
                className="pointer-events-auto cursor-pointer select-none"
                onClick={() => onCableClick?.(feeder)}
                onMouseEnter={() => {
                  setHoveredCable(feeder);
                  setInspectorPosition({ x: midX, y: midY });
                }}
                onMouseLeave={() => {
                  setHoveredCable(null);
                  setInspectorPosition(null);
                }}
              >
                <rect
                  x="-36"
                  y="-11"
                  width="72"
                  height="22"
                  rx="11"
                  fill="#14171c"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  className="drop-shadow-md"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {feeder.maxPhaseCurrent.toFixed(1)}A ({feeder.loadPercentage}%)
                </text>
              </g>
            </g>
          );
        })}

        {/* Render Electrical Nodes / Overlay Icons */}
        {nodes.map((node) => {
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height / 2;

          if (node.type === "transformer") {
            return (
              <g
                key={`node-tr-${node.id}`}
                transform={`translate(${node.x}, ${node.y})`}
                className="pointer-events-auto cursor-pointer select-none"
                onMouseEnter={() => {
                  setHoveredNode(node);
                  setInspectorPosition({ x: cx, y: cy });
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setInspectorPosition(null);
                }}
                onClick={() => onNodeClick?.(node)}
              >
                <rect
                  width={node.width}
                  height={node.height}
                  rx="8"
                  fill="#1e2228"
                  stroke="#54a8c7"
                  strokeWidth="2.5"
                  filter="url(#glow-normal)"
                />
                <circle cx={node.width / 2} cy={node.height / 2 - 6} r="14" fill="#54a8c7" fillOpacity="0.2" />
                <text x={node.width / 2} y={node.height / 2 - 2} textAnchor="middle" fill="#54a8c7" fontSize="14">
                  ⚡
                </text>
                <text
                  x={node.width / 2}
                  y={node.height - 8}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {node.name || "Main Grid Infeed"}
                </text>
              </g>
            );
          }

          if (node.type === "distribution_board") {
            return (
              <g
                key={`node-db-${node.id}`}
                transform={`translate(${node.x}, ${node.y})`}
                className="pointer-events-auto cursor-pointer select-none"
                onMouseEnter={() => {
                  setHoveredNode(node);
                  setInspectorPosition({ x: cx, y: cy });
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setInspectorPosition(null);
                }}
                onClick={() => onNodeClick?.(node)}
              >
                <rect
                  width={node.width}
                  height={node.height}
                  rx="6"
                  fill="#1a1e24"
                  stroke="#fab758"
                  strokeWidth="2"
                />
                <text x={node.width / 2} y={node.height / 2 - 2} textAnchor="middle" fill="#fab758" fontSize="13">
                  🗄️
                </text>
                <text
                  x={node.width / 2}
                  y={node.height - 6}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  {node.name || "Sub-Panel DB"}
                </text>
              </g>
            );
          }

          return null;
        })}
      </svg>

      {/* Floating Phase Balance Inspector on Node Hover */}
      {hoveredNode && inspectorPosition && hoveredNode.telemetry && (
        <PhaseBalanceInspector
          telemetry={hoveredNode.telemetry}
          title={hoveredNode.name}
          subtitle={`Charger #${hoveredNode.chargerId || hoveredNode.id}`}
          floatingPosition={inspectorPosition}
          onClose={() => setHoveredNode(null)}
        />
      )}

      {/* Floating Inspector on Cable Hover */}
      {hoveredCable && inspectorPosition && (
        <PhaseBalanceInspector
          telemetry={{
            name: hoveredCable.name || `Feeder Cable (${hoveredCable.cableType})`,
            activePowerKw: Math.round(((hoveredCable.activeCurrentL1 + hoveredCable.activeCurrentL2 + hoveredCable.activeCurrentL3) * 230) / 1000 * 10) / 10,
            currentL1: hoveredCable.activeCurrentL1,
            currentL2: hoveredCable.activeCurrentL2,
            currentL3: hoveredCable.activeCurrentL3,
            voltageL1: 230,
            voltageL2: 230,
            voltageL3: 230,
            unbalanceAmps: Math.round((Math.max(hoveredCable.activeCurrentL1, hoveredCable.activeCurrentL2, hoveredCable.activeCurrentL3) - Math.min(hoveredCable.activeCurrentL1, hoveredCable.activeCurrentL2, hoveredCable.activeCurrentL3)) * 10) / 10,
            isUnbalanced: (Math.max(hoveredCable.activeCurrentL1, hoveredCable.activeCurrentL2, hoveredCable.activeCurrentL3) - Math.min(hoveredCable.activeCurrentL1, hoveredCable.activeCurrentL2, hoveredCable.activeCurrentL3)) > 16.0,
          }}
          title={hoveredCable.name || "Feeder Cable Spec"}
          subtitle={`${hoveredCable.cableType} • Rated ${hoveredCable.ratedCurrentAmps}A`}
          maxAmps={hoveredCable.ratedCurrentAmps}
          floatingPosition={inspectorPosition}
          onClose={() => setHoveredCable(null)}
        />
      )}
    </>
  );
}
