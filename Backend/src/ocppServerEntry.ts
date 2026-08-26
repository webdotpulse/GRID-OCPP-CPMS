import "dotenv/config";
import { startOcppServer } from "./app.js";
import { logger } from "./utils/logger.js";

logger.info("Starting Dedicated OCPP-CPMS WebSocket Ingestion Pod...");
startOcppServer();
