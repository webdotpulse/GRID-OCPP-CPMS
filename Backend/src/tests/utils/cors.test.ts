import { jest, describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { getAllowedOrigins, isOriginAllowed } from "../../utils/cors.js";

describe("CORS & Origin Validation Helper", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should allow requests with no origin (mobile apps, curl, gateways)", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("")).toBe(true);
  });

  it("should allow all origins in non-production environments", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("https://random-unauthorized-domain.com")).toBe(true);

    process.env.NODE_ENV = "test";
    expect(isOriginAllowed("https://another-domain.org")).toBe(true);
  });

  it("should allow default local development origins", () => {
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed("http://localhost:3002")).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3002")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true);
  });

  it("should allow origins specified in FRONTEND_URL and ALLOWED_ORIGINS", () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://cpo.thechargegrid.com";
    process.env.ALLOWED_ORIGINS = "https://admin.thechargegrid.com, https://driver.thechargegrid.com/";

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://cpo.thechargegrid.com/")).toBe(true); // Trailing slash normalized
    expect(isOriginAllowed("https://admin.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://driver.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://malicious-site.com")).toBe(false);
  });

  it("should support wildcard origin '*'", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "*";

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://any-domain.com")).toBe(true);
  });

  it("should support wildcard domain patterns like '*.thechargegrid.com'", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://*.thechargegrid.com";

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://ocpp.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://sub.portal.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://otherdomain.com")).toBe(false);
  });

  it("should support subdomain matching when base domain is configured", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "thechargegrid.com";

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://attacker-thechargegrid.com")).toBe(false);
  });

  it("should support FRONTEND_DOMAIN and DOMAIN env variables", () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_DOMAIN = "cpo.thechargegrid.com";
    process.env.DOMAIN = "thechargegrid.com";

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("http://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://driver.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://otherdomain.com")).toBe(false);
  });

  it("should handle quoted and whitespace-separated origins gracefully", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = '"https://cpo.thechargegrid.com" \'https://admin.thechargegrid.com\'';

    expect(isOriginAllowed("https://cpo.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://admin.thechargegrid.com")).toBe(true);
    expect(isOriginAllowed("https://unknown.com")).toBe(false);
  });
});
