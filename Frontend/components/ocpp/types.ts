export type OcppMessageType = "CALL" | "CALLRESULT" | "CALLERROR";
export type OcppDirection = "in" | "out";

export interface SchemaViolation {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface SchemaValidationResult {
  isValid: boolean;
  violations: SchemaViolation[];
}

export interface OcppFrame {
  id: string | number;
  chargerId: number | string;
  chargerName: string;
  timestamp: Date;
  direction: OcppDirection;
  messageType: OcppMessageType;
  action: string;
  messageId: string;
  rawMessage: any;
  payload: any;
  latencyMs?: number | null;
  status: "success" | "error" | "slow" | "pending";
  errorCode?: string | null;
  errorDescription?: string | null;
  validation: SchemaValidationResult;
}

export interface OcppInspectorFilter {
  search: string;
  action: string;
  messageType: string;
  direction: string;
  chargerName: string;
  onlyErrors: boolean;
  onlySlow: boolean;
}
