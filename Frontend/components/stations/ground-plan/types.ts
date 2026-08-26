export type CableLoadLevel = "normal" | "warning" | "critical";

export interface PhaseTelemetry {
  chargerId: number;
  name: string;
  status: string;
  activePowerKw: number;
  currentL1: number;
  currentL2: number;
  currentL3: number;
  voltageL1: number;
  voltageL2: number;
  voltageL3: number;
  unbalanceAmps: number;
  unbalancePercentage: number;
  isUnbalanced: boolean;
}

export interface FeederCable {
  id: number;
  name: string;
  sourceNodeId?: number;
  targetNodeId?: number;
  cableType: string;
  lengthMeters: number;
  ratedCurrentAmps: number;
  activeCurrentL1: number;
  activeCurrentL2: number;
  activeCurrentL3: number;
  maxPhaseCurrent: number;
  loadPercentage: number;
  loadLevel: CableLoadLevel;
  points?: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface TopologyNode {
  id: number;
  name: string;
  type: "spot" | "transformer" | "distribution_board" | "rectangle" | "line" | "feeder" | string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fillColor?: string | null;
  lineColor?: string | null;
  lineWidth?: number | null;
  connectorId?: string | number | null;
  chargerId?: number | null;
  metadata?: {
    sourceNodeId?: number;
    targetNodeId?: number;
    maxCapacityKw?: number;
    maxCurrentAmps?: number;
    cableType?: string;
    lengthMeters?: number;
    gridConnectionVoltage?: number;
    ratingKva?: number;
    phaseConnection?: "3P+N" | "1P+N";
  } | null;
  telemetry?: PhaseTelemetry | null;
}

export interface StationTopologyData {
  stationId: number;
  stationName: string;
  maxPowerKw: number;
  activePowerKw: number;
  totalCurrentL1: number;
  totalCurrentL2: number;
  totalCurrentL3: number;
  stationUnbalanceAmps: number;
  isStationUnbalanced: boolean;
  nodes: TopologyNode[];
  feeders: FeederCable[];
}

export type ViewMode = "hybrid" | "topology" | "architectural";
export type WiringMode = "idle" | "select_source" | "select_target";
