import "dotenv/config";
import { startServers } from "./app.js";
import { logger } from "./utils/logger.js";
import { startWorkers } from "./workers/workerManager.js";
import { MeterValueService } from "./services/MeterValueService.js";
<<<<<<< HEAD
import { startWorkers } from "./workers/index.js";
=======

// Start all servers
startServers();

// Start BullMQ background workers
startWorkers();
MeterValueService.startWorker();

>>>>>>> 482a712 (feat: implement asynchronous background worker architecture using BullMQ for billing, metering, and event management)
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
