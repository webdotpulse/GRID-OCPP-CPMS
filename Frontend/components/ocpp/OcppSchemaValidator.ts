import { SchemaValidationResult, SchemaViolation } from "./types";

export class OcppSchemaValidator {
  /**
   * Validates an OCPP message payload against OCPP 1.6-J and 2.0.1 protocol schemas
   */
  public static validate(
    action: string,
    messageType: "CALL" | "CALLRESULT" | "CALLERROR",
    payload: any
  ): SchemaValidationResult {
    const violations: SchemaViolation[] = [];

    if (messageType === "CALLERROR") {
      if (!Array.isArray(payload) && typeof payload !== "object") {
        violations.push({
          field: "errorPayload",
          message: "CALLERROR payload must contain an ErrorCode and Description.",
          severity: "error",
        });
      }
      return { isValid: violations.length === 0, violations };
    }

    if (!payload || typeof payload !== "object") {
      violations.push({
        field: "root",
        message: "OCPP payload must be a JSON object.",
        severity: "error",
      });
      return { isValid: false, violations };
    }

    // Standard OCPP 1.6-J Request Validation
    if (messageType === "CALL") {
      switch (action) {
        case "BootNotification":
          // 1.6 checks
          if (!payload.chargePointVendor && !payload.chargingStation?.vendorName) {
            violations.push({
              field: "chargePointVendor",
              message: "Missing mandatory field 'chargePointVendor' (OCPP 1.6) or 'chargingStation.vendorName' (2.0.1).",
              severity: "error",
            });
          }
          if (!payload.chargePointModel && !payload.chargingStation?.model) {
            violations.push({
              field: "chargePointModel",
              message: "Missing mandatory field 'chargePointModel' (OCPP 1.6) or 'chargingStation.model' (2.0.1).",
              severity: "error",
            });
          }
          break;

        case "Authorize":
          if (!payload.idTag && !payload.idToken) {
            violations.push({
              field: "idTag",
              message: "Missing mandatory RFID/contract identifier 'idTag' (or 'idToken').",
              severity: "error",
            });
          }
          if (payload.idTag && typeof payload.idTag !== "string") {
            violations.push({
              field: "idTag",
              message: "Field 'idTag' must be a string.",
              severity: "error",
            });
          }
          break;

        case "StartTransaction":
          if (payload.connectorId === undefined || typeof payload.connectorId !== "number") {
            violations.push({
              field: "connectorId",
              message: "Missing or invalid numeric 'connectorId'.",
              severity: "error",
            });
          }
          if (!payload.idTag && !payload.idToken) {
            violations.push({
              field: "idTag",
              message: "Missing mandatory authorization identifier 'idTag'.",
              severity: "error",
            });
          }
          if (payload.meterStart === undefined || typeof payload.meterStart !== "number") {
            violations.push({
              field: "meterStart",
              message: "Missing mandatory 'meterStart' Wh reading.",
              severity: "error",
            });
          }
          if (!payload.timestamp) {
            violations.push({
              field: "timestamp",
              message: "Missing mandatory ISO 8601 'timestamp'.",
              severity: "warning",
            });
          }
          break;

        case "StopTransaction":
          if (payload.meterStop === undefined || typeof payload.meterStop !== "number") {
            violations.push({
              field: "meterStop",
              message: "Missing mandatory 'meterStop' Wh reading.",
              severity: "error",
            });
          }
          if (!payload.timestamp) {
            violations.push({
              field: "timestamp",
              message: "Missing mandatory ISO 8601 'timestamp'.",
              severity: "warning",
            });
          }
          if (payload.transactionId === undefined) {
            violations.push({
              field: "transactionId",
              message: "Missing mandatory 'transactionId'.",
              severity: "error",
            });
          }
          break;

        case "StatusNotification":
          if (payload.connectorId === undefined || typeof payload.connectorId !== "number") {
            violations.push({
              field: "connectorId",
              message: "Missing mandatory numeric 'connectorId'.",
              severity: "error",
            });
          }
          if (!payload.errorCode) {
            violations.push({
              field: "errorCode",
              message: "Missing mandatory 'errorCode' (e.g. 'NoError').",
              severity: "error",
            });
          }
          if (!payload.status) {
            violations.push({
              field: "status",
              message: "Missing mandatory EVSE 'status' enum.",
              severity: "error",
            });
          } else {
            const validStatuses = [
              "Available", "Preparing", "Charging", "SuspendedEVSE",
              "SuspendedEV", "Finishing", "Reserved", "Unavailable", "Faulted"
            ];
            if (!validStatuses.includes(payload.status)) {
              violations.push({
                field: "status",
                message: `Unknown connector status '${payload.status}'. Expected standard OCPP 1.6 status enum.`,
                severity: "warning",
              });
            }
          }
          break;

        case "MeterValues":
          if (payload.connectorId === undefined || typeof payload.connectorId !== "number") {
            violations.push({
              field: "connectorId",
              message: "Missing mandatory numeric 'connectorId'.",
              severity: "error",
            });
          }
          if (!payload.meterValue || !Array.isArray(payload.meterValue)) {
            violations.push({
              field: "meterValue",
              message: "Field 'meterValue' must be an array of sampled telemetry objects.",
              severity: "error",
            });
          }
          break;

        case "Reset":
          if (!payload.type || !["Soft", "Hard"].includes(payload.type)) {
            violations.push({
              field: "type",
              message: "Reset type must be either 'Soft' or 'Hard'.",
              severity: "error",
            });
          }
          break;

        case "UnlockConnector":
          if (payload.connectorId === undefined || typeof payload.connectorId !== "number") {
            violations.push({
              field: "connectorId",
              message: "Missing mandatory 'connectorId' to unlock.",
              severity: "error",
            });
          }
          break;

        case "SetChargingProfile":
          if (payload.connectorId === undefined) {
            violations.push({
              field: "connectorId",
              message: "Missing mandatory 'connectorId' for charging profile.",
              severity: "error",
            });
          }
          if (!payload.csChargingProfiles) {
            violations.push({
              field: "csChargingProfiles",
              message: "Missing mandatory 'csChargingProfiles' structure.",
              severity: "error",
            });
          }
          break;
      }
    }

    // Standard OCPP 1.6-J Response Validation
    if (messageType === "CALLRESULT") {
      switch (action) {
        case "BootNotification":
        case "BootNotificationResponse":
          if (!payload.status) {
            violations.push({
              field: "status",
              message: "Missing mandatory registration 'status' (Accepted, Pending, Rejected).",
              severity: "error",
            });
          }
          if (!payload.interval || typeof payload.interval !== "number") {
            violations.push({
              field: "interval",
              message: "Missing mandatory heartbeat 'interval' in seconds.",
              severity: "error",
            });
          }
          if (!payload.currentTime) {
            violations.push({
              field: "currentTime",
              message: "Missing mandatory 'currentTime' timestamp.",
              severity: "warning",
            });
          }
          break;

        case "Authorize":
        case "AuthorizeResponse":
          if (!payload.idTagInfo?.status) {
            violations.push({
              field: "idTagInfo.status",
              message: "Missing mandatory 'idTagInfo.status' (Accepted, Blocked, Expired, Invalid).",
              severity: "error",
            });
          }
          break;

        case "StartTransaction":
        case "StartTransactionResponse":
          if (payload.transactionId === undefined) {
            violations.push({
              field: "transactionId",
              message: "Missing mandatory assigned 'transactionId'.",
              severity: "error",
            });
          }
          if (!payload.idTagInfo?.status) {
            violations.push({
              field: "idTagInfo.status",
              message: "Missing mandatory 'idTagInfo.status'.",
              severity: "error",
            });
          }
          break;
      }
    }

    return {
      isValid: violations.filter((v) => v.severity === "error").length === 0,
      violations,
    };
  }
}
