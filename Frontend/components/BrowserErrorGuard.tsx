"use client";

import { useEffect } from "react";

/**
 * BrowserErrorGuard catches and suppresses benign browser-internal, extension, or DevTools errors:
 * 1. Chromium DevTools Soft Navigation / performance script throwing `TypeError: Cannot read properties of undefined (reading 'startTime')` at `et.reportAllChanges`.
 * 2. Recharts layout calculation warnings (`The width(-1) and height(-1) of chart should be greater than 0...`).
 */
export function BrowserErrorGuard() {
  useEffect(() => {
    const isIgnoredError = (msg: string, stack: string, source: string) => {
      return (
        (msg.includes("Cannot read properties of undefined") && msg.includes("startTime")) ||
        msg.includes("reading 'startTime'") ||
        stack.includes("reportAllChanges") ||
        (source.includes("VM") && (stack.includes("startTime") || msg.includes("startTime"))) ||
        (msg.includes("width(") && msg.includes("height(") && msg.includes("should be greater than 0"))
      );
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      const stack = event.error?.stack || "";
      const source = event.filename || "";

      if (isIgnoredError(msg, stack, source)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || "");
      const stack = reason?.stack || "";
      const source = reason?.fileName || "";

      if (isIgnoredError(msg, stack, source)) {
        event.preventDefault();
      }
    };

    const originalWarn = console.warn;
    const originalError = console.error;

    console.warn = (...args: any[]) => {
      const str = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      if (
        str.includes("should be greater than 0") &&
        (str.includes("width(") || str.includes("height("))
      ) {
        return; // Suppress Recharts measurement race-condition warning
      }
      originalWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      const str = args
        .map((a) => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === "object") {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" ");

      if (
        (str.includes("Cannot read properties of undefined") && str.includes("startTime")) ||
        str.includes("reading 'startTime'") ||
        str.includes("reportAllChanges")
      ) {
        return; // Suppress Chromium DevTools soft navigation error
      }
      originalError.apply(console, args);
    };

    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      const msg = String(message || "");
      const stack = error?.stack || "";
      const src = String(source || "");
      if (isIgnoredError(msg, stack, src)) {
        return true;
      }
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    window.addEventListener("error", handleGlobalError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);

    return () => {
      window.removeEventListener("error", handleGlobalError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
      window.onerror = originalOnError;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return null;
}
