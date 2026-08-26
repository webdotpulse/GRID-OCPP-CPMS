import "dotenv/config";
import { startApiServer } from "./app.js";
import { logger } from "./utils/logger.js";

logger.info("Starting Dedicated OCPP-CPMS REST API & Socket.IO Pod...");
startApiServer();
