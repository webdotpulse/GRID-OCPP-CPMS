import "dotenv/config";
import { startWorkerServer } from "./app.js";
import { logger } from "./utils/logger.js";

logger.info("Starting Dedicated OCPP-CPMS Background Worker Pod...");
startWorkerServer();
