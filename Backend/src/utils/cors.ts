import { logger } from "./logger.js";

/**
 * Normalizes an origin URL by stripping trailing slashes and converting to lowercase.
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Retrieves the consolidated list of allowed CORS origins from environment variables and defaults.
 */
export function getAllowedOrigins(): string[] {
  const defaults = [
    "http://localhost:3002",
    "http://localhost:3000",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3000",
  ];

  const configuredOrigins: string[] = [];

  if (process.env.FRONTEND_URL) {
    configuredOrigins.push(process.env.FRONTEND_URL);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const split = process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    configuredOrigins.push(...split);
  }

  const combined = [...defaults, ...configuredOrigins].map(normalizeOrigin);

  return Array.from(new Set(combined));
}

/**
 * Evaluates whether an incoming HTTP / WebSocket Origin header is permitted.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow requests without Origin header (e.g. mobile apps, curl, internal services, OCPP gateways)
  if (!origin) {
    return true;
  }

  // In non-production environments, allow any origin for development convenience
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  const allowedList = getAllowedOrigins();

  // Wildcard allows everything
  if (allowedList.includes("*")) {
    return true;
  }

  // Exact match
  if (allowedList.includes(normalized)) {
    return true;
  }

  // Wildcard pattern or root domain match
  for (const pattern of allowedList) {
    if (pattern.includes("*")) {
      const regexPattern = "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
      try {
        const regex = new RegExp(regexPattern, "i");
        if (regex.test(normalized)) {
          return true;
        }
      } catch {
        // Ignore invalid regex syntax in env config
      }
    }

    // If configured origin is a domain without protocol or with protocol, check matching host
    try {
      const patternUrl = pattern.startsWith("http") ? new URL(pattern) : null;
      const originUrl = new URL(normalized);

      if (patternUrl && patternUrl.host === originUrl.host) {
        return true;
      }

      // Check if origin is a subdomain of pattern
      const patternHost = patternUrl ? patternUrl.hostname : pattern;
      if (
        originUrl.hostname === patternHost ||
        originUrl.hostname.endsWith(`.${patternHost}`)
      ) {
        return true;
      }
    } catch {
      // Not a standard URL, continue
    }
  }

  return false;
}
