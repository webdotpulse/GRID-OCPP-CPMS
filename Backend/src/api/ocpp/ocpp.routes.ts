import { Router } from "express";
import {
  getConnectedChargers,
  remoteStart,
  remoteStop,
  getChargerConfiguration,
  deleteChargerConfigurations,
  setChargerConfiguration,
  changeAvailabilityController,
  resetChargerController,
  unlockConnectorController,
  dataTransferController,
  triggerMessageController,
  setChargingProfileController,
  clearChargingProfileController,
  testAuth,
  updateFirmwareController,
  getDiagnosticsController,
} from "./ocpp.controller.js";
import { auditLogMiddleware } from "../../middleware/audit.js";

const router = Router();

router.get("/connected", getConnectedChargers);
router.post("/remote-start", auditLogMiddleware("REMOTE_START", "Charger"), remoteStart);
router.post("/remote-stop", auditLogMiddleware("REMOTE_STOP", "Charger"), remoteStop);
router.post("/get-configuration", getChargerConfiguration);
router.delete("/configuration/:chargerId", auditLogMiddleware("DELETE_CONFIG", "Charger"), deleteChargerConfigurations);
router.post("/set-configuration", auditLogMiddleware("SET_CONFIG", "Charger"), setChargerConfiguration);
router.post("/change-availability", auditLogMiddleware("CHANGE_AVAILABILITY", "Charger"), changeAvailabilityController);
router.post("/reset", auditLogMiddleware("RESET_CHARGER", "Charger"), resetChargerController);
router.post("/unlock", auditLogMiddleware("UNLOCK_CONNECTOR", "Charger"), unlockConnectorController);
router.post("/data-transfer", auditLogMiddleware("DATA_TRANSFER", "Charger"), dataTransferController);
router.post("/trigger-message", auditLogMiddleware("TRIGGER_MESSAGE", "Charger"), triggerMessageController);
router.post("/update-firmware", auditLogMiddleware("UPDATE_FIRMWARE", "Charger"), updateFirmwareController);
router.post("/get-diagnostics", getDiagnosticsController);
router.post("/set-charging-profile", auditLogMiddleware("SET_CHARGING_PROFILE", "Charger"), setChargingProfileController);
router.post("/clear-charging-profile", auditLogMiddleware("CLEAR_CHARGING_PROFILE", "Charger"), clearChargingProfileController);
router.post("/test-auth", testAuth);

export default router;
