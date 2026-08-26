import { v4 as uuidv4 } from 'uuid';
import "dotenv/config";

export const config = {
  // Instance ID for horizontal scaling
  instanceId: process.env.INSTANCE_ID || uuidv4(),

  // Server Configuration
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // OCPP Configuration
  ocppPort: parseInt(process.env.OCPP_PORT || "9220", 10),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || "300", 10),
  offlineThreshold: parseInt(process.env.OFFLINE_THRESHOLD_SECONDS || "90", 10),
  websocketPingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL_SECONDS || "30", 10),
  ocppProtocolVersion: "1.6",

  // OCPP Logs WebSocket
  ocppLogsPort: parseInt(process.env.OCPP_LOG_WS_PORT || "3001", 10),

  // JWT Authentication
  jwtSecret: process.env.JWT_SECRET || "your-jwt-secret-key-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // Redis
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  // Dynamic Tariffs
  defaultDynamicProvider: process.env.DEFAULT_DYNAMIC_PROVIDER || "EnergyZero",
  defaultDynamicCountry: process.env.DEFAULT_DYNAMIC_COUNTRY || "BE",

  // Email Verification
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",

  // Mutual TLS (mTLS) Security Profile 3
  mtlsEnabled: process.env.MTLS_ENABLED === "true",
  tlsCertPath: process.env.TLS_CERT_PATH,
  tlsKeyPath: process.env.TLS_KEY_PATH,
  tlsCaPath: process.env.TLS_CA_PATH,
};

export const logLevels = ["error", "warn", "info", "debug"] as const;
