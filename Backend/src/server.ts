import "dotenv/config";
import { startServers } from "./app.js";
import { logger } from "./utils/logger.js";
import { MeterValueService } from "./services/MeterValueService.js";

// Start all servers
startServers();

// Start background workers
import { startWorkers } from "./workers/index.js";
startWorkers();
MeterValueService.startWorker();

import { EpexSpotService } from "./services/EpexSpotService.js";
EpexSpotService.startEpexWorker();

import { loadManagementService } from "./services/LoadManagementService.js";

// Start Smart Charging Engine background loop
loadManagementService.startSmartChargingEngine();

logger.info("Starting Open-Source OCPP CMS...");
