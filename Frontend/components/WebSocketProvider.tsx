"use client";

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { logger } from "@/lib/logger";
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { useAuth } from "@/hooks/useAuth";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const setSocket = useTelemetryStore((state) => state.setSocket);
  const setIsConnected = useTelemetryStore((state) => state.setIsConnected);
  const fetchChargers = useTelemetryStore((state) => state.fetchChargers);
  const fetchSessions = useTelemetryStore((state) => state.fetchSessions);

  useEffect(() => {
    // If auth state is still resolving, do nothing
    if (isLoading) {
      return;
    }

    // Only establish real-time socket connection for authenticated users
    if (!user) {
      setIsConnected(false);
      setSocket(null);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setIsConnected(false);
      setSocket(null);
      return;
    }

    // If NEXT_PUBLIC_API_URL is configured (e.g. for external backend),
    // we connect to that domain instead of relative path
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const isAbsoluteUrl = apiUrl.startsWith("http");

    // We use undefined if relative so it falls back to window.location.origin
    const socketUrl = isAbsoluteUrl ? new URL(apiUrl).origin : undefined;

    // Prefer WebSocket transport first to avoid unnecessary HTTP polling CORS preflights
    const newSocket: Socket = io(socketUrl as string | undefined, {
      path: "/api/realtime",
      auth: {
        token,
      },
      query: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
    });

    newSocket.on("connect", () => {
      logger.info("Realtime WebSocket connected successfully");
      setIsConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      logger.info(`Realtime WebSocket disconnected: ${reason}`);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      logger.warn("Realtime WebSocket connection warning:", error.message);
      setIsConnected(false);
    });

    newSocket.on("CHARGER_STATUS_UPDATE", () => {
      fetchChargers();
      fetchSessions();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user, isLoading, setSocket, setIsConnected, fetchChargers, fetchSessions]);

  return <>{children}</>;
}
