"use client";

import { useEffect } from "react";

/**
 * BrowserErrorGuard catches and suppresses benign browser-internal, extension, or DevTools errors
 * (such as Chromium DevTools Soft Navigation performance script throwing `TypeError: Cannot read properties of undefined (reading 'startTime')` at `et.reportAllChanges`).
 */
export function BrowserErrorGuard() {
  useEffect(() => {
    const isStartTimeError = (msg: string, stack: string, source: string) => {
      return (
        (msg.includes("Cannot read properties of undefined") && msg.includes("startTime")) ||
        (msg.includes("reading 'startTime'")) ||
        stack.includes("reportAllChanges") ||
        (source.includes("VM") && stack.includes("startTime"))
      );
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      const stack = event.error?.stack || "";
      const source = event.filename || "";

      if (isStartTimeError(msg, stack, source)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || "");
      const stack = reason?.stack || "";
      const source = reason?.fileName || "";

      if (isStartTimeError(msg, stack, source)) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleGlobalError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);

    return () => {
      window.removeEventListener("error", handleGlobalError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
    };
  }, []);

  return null;
}
