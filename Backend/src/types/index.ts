// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Charger Status Types
export type ChargerStatus = "active" | "offline" | "disabled";
export type ConnectorStatus = "Available" | "Occupied" | "Reserved" | "Unavailable" | "Faulted";

// OCPP Message Types
export type OcppDirection = "in" | "out";

export interface OcppMessage {
  timestamp: Date;
  direction: OcppDirection;
  chargerId: number;
  transactionId?: string | number;
  message: string;
}

// WebSocket Client Types
export interface ChargerConnection {
  chargerId: number;
  ws: any; // WebSocket connection
  chargerName: string;
  protocol: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  transactions: Map<string | number, ActiveTransaction>;
}

export interface ActiveTransaction {
  transactionId: string | number;
  connectorName: string;
  idTag?: string;
  startTime: Date;
  initialMeterValue: number;
}

// API Request Types
export interface CreateChargerDto {
  chargeGroupId?: number | null;
  quirkProfileId?: number | null;
  model: string;
  name: string;
  manufacturer: string;
  serial_number: string;
  manufacturing_date: Date;
  power_capacity: number;
  firmware_version: string;
  service_contacts: string;
  charging_station_id: number;
  owner_id: number;
  ownerType?: string;
  ownerCompanyId?: number | null;
  subscriptionPayerType?: string | null;
  subscriptionPayerUserId?: number | null;
  subscriptionPayerCompanyId?: number | null;
  transactionReceiverType?: string | null;
  transactionReceiverUserId?: number | null;
  transactionReceiverCompanyId?: number | null;
  isPublic?: boolean;
  isCombined?: boolean;
  pairedChargerId?: number | null;
  pairedRole?: string | null;
  isStraightThroughProxy?: boolean;
  isPredictiveBalancingEnabled?: boolean;
  localSolarKwp?: number | null;
  tariffId?: number;
}

export interface UpdateChargerDto {
  chargeGroupId?: number | null;
  quirkProfileId?: number | null;
  model?: string;
  name?: string;
  manufacturer?: string;
  serial_number?: string;
  manufacturing_date?: Date;
  power_capacity?: number;
  status?: ChargerStatus;
  firmware_version?: string;
  service_contacts?: string;
  owner_id?: number;
  ownerType?: string;
  ownerCompanyId?: number | null;
  subscriptionPayerType?: string | null;
  subscriptionPayerUserId?: number | null;
  subscriptionPayerCompanyId?: number | null;
  transactionReceiverType?: string | null;
  transactionReceiverUserId?: number | null;
  transactionReceiverCompanyId?: number | null;
  tariffId?: number;
  requireAuth?: boolean;
  isPublic?: boolean;
  thirdPartyBackendUrl?: string | null;
  isStraightThroughProxy?: boolean;
  isCombined?: boolean;
  pairedChargerId?: number | null;
  pairedRole?: string | null;
  isPredictiveBalancingEnabled?: boolean;
  localSolarKwp?: number | null;
  protocol?: string;
}

export interface CombineChargersDto {
  primaryChargerId: number;
  secondaryChargerId: number;
}

export interface UncombineChargersDto {
  chargerId: number;
}

export interface CreateStationDto {
  station_name: string;
  street_name: string;
  city: string;
  state?: string;
  postal_code: string;
  country?: string;
  latitude: number;
  longitude: number;
  on_site_person_name?: string;
  on_site_contact_details?: string;
  emergency_contact?: string;
  status?: string;
  maxPower?: number | null;
  maxAmperage?: number | null;
  maxPhaseCurrent?: number | null;
  maxPhaseUnbalance?: number | null;
  owner_id: number;
}

export interface CreateConnectorDto {
  connector_name?: string;
  status: string;
  current_type: string;
  max_current?: number;
  max_power?: number;
  mac_address?: string;
  charger_id: number;
}

export interface CreateRfidUserDto {
  rfid_tag: string;
  external_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  type?: string;
  cardScope?: string;
  active?: boolean;
  owner_id: number;
  ownerType?: string;
  ownerCompanyId?: number | null;
  holderType?: string | null;
  holderUserId?: number | null;
  holderCompanyId?: number | null;
  transactionPayerType?: string | null;
  transactionPayerUserId?: number | null;
  transactionPayerCompanyId?: number | null;
}

export interface UpdateRfidUserDto {
  rfid_tag?: string;
  external_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  type?: string;
  cardScope?: string;
  active?: boolean;
  owner_id?: number;
  ownerType?: string;
  ownerCompanyId?: number | null;
  holderType?: string | null;
  holderUserId?: number | null;
  holderCompanyId?: number | null;
  transactionPayerType?: string | null;
  transactionPayerUserId?: number | null;
  transactionPayerCompanyId?: number | null;
}

export interface RemoteStartRequest {
  chargerId: number;
  connectorId: number;
  idTag: string;
}

export interface RemoteStopRequest {
  chargerId: number;
  transactionId: string | number;
}

// Smart Charging Requests
export interface SetChargingProfileRequest {
  chargerId: number;
  connectorId: number;
  csChargingProfiles: {
    chargingProfileId: number;
    transactionId?: string | number;
    stackLevel: number;
    chargingProfilePurpose: "ChargePointMaxProfile" | "TxDefaultProfile" | "TxProfile";
    chargingProfileKind: "Absolute" | "Recurring" | "Relative";
    recurrencyKind?: "Daily" | "Weekly";
    validFrom?: string; // ISO 8601 Date
    validTo?: string; // ISO 8601 Date
    chargingSchedule: {
      duration?: number;
      startSchedule?: string; // ISO 8601 Date
      chargingRateUnit: "W" | "A";
      chargingSchedulePeriod: Array<{
        startPeriod: number;
        limit: number;
        numberPhases?: number;
      }>;
      minChargingRate?: number;
    };
  };
}

export interface ClearChargingProfileRequest {
  chargerId: number;
  id?: number;
  connectorId?: number;
  chargingProfilePurpose?: "ChargePointMaxProfile" | "TxDefaultProfile" | "TxProfile";
  stackLevel?: number;
}

// Tariff DTOs
export interface CreateTariffDto {
  tariff_name: string;
  charge: number;
  electricity_rate: number;
  tariffType?: string;
  country?: string;
  dynamicProvider?: string;
  markupPerKwh?: number;
  taxPercentage?: number;
  fixedFeePerMonth?: number;
  time_fee?: number;
  idle_fee?: number;
}

export interface UpdateTariffDto {
  tariff_name?: string;
  charge?: number;
  electricity_rate?: number;
  tariffType?: string;
  country?: string;
  dynamicProvider?: string;
  markupPerKwh?: number;
  taxPercentage?: number;
  fixedFeePerMonth?: number;
  time_fee?: number;
  idle_fee?: number;
}
