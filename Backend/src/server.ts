import "dotenv/config";
import { startServers } from "./app.js";
import { logger } from "./utils/logger.js";
import { MeterValueService } from "./services/MeterValueService.js";
import { startWorkers } from "./workers/index.js";
import { EpexSpotService } from "./services/EpexSpotService.js";
import { loadManagementService } from "./services/LoadManagementService.js";

logger.info("Starting Open-Source OCPP-CPMS (Monolith Mode)...");

// Start HTTP REST API, Socket.IO, Logs WebSocket, and OCPP WebSocket servers
startServers();

// Start background workers & Smart Charging loop
startWorkers();
MeterValueService.startWorker();
EpexSpotService.startEpexWorker();
loadManagementService.startSmartChargingEngine();
