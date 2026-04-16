import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import type { Activity, Alert } from "./types";

export interface ConnectionStatus {
  frontend: "connected";
  backend: "connected" | "disconnected";
  websocket: "connected" | "disconnected";
  agentOnline: number;
  agentTotal: number;
  backendChecking: boolean;
}

interface SocketContextType {
  unreadAlerts: number;
  setUnreadAlerts: React.Dispatch<React.SetStateAction<number>>;
  unreadMessages: number;
  setUnreadMessages: React.Dispatch<React.SetStateAction<number>>;
  latestActivities: Activity[];
  latestAlerts: Alert[];
  setLatestAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  connectionStatus: ConnectionStatus;
  /** Subscribe to a specific WebSocket message type. Returns an unsubscribe fn. */
  subscribeToMessage: (type: string, handler: (data: unknown) => void) => () => void;
  /** Send a message to the server over the WebSocket connection. */
  sendWsMessage: (type: string, data: unknown) => void;
}

const defaultConnectionStatus: ConnectionStatus = {
  frontend: "connected",
  backend: "disconnected",
  websocket: "disconnected",
  agentOnline: 0,
  agentTotal: 0,
  backendChecking: true,
};

const SocketContext = createContext<SocketContextType>({
  unreadAlerts: 0,
  setUnreadAlerts: () => {},
  unreadMessages: 0,
  setUnreadMessages: () => {},
  latestActivities: [],
  latestAlerts: [],
  setLatestAlerts: () => {},
  connectionStatus: defaultConnectionStatus,
  subscribeToMessage: () => () => {},
  sendWsMessage: () => {},
});

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Base WS URL without token (token appended at connect time)
const BASE_WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/^http/, "ws") + "/ws"
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [latestActivities, setLatestActivities] = useState<Activity[]>([]);
  const [latestAlerts, setLatestAlerts] = useState<Alert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(defaultConnectionStatus);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const healthRef = useRef<ReturnType<typeof setInterval>>();

  // ── Message subscription registry ────────────────────────────────────────
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  const subscribeToMessage = useCallback((type: string, handler: (data: unknown) => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    subscribersRef.current.get(type)!.add(handler);
    return () => {
      subscribersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // ── Send a message to the server ─────────────────────────────────────────
  const sendWsMessage = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn("WebSocket not open, cannot send:", type);
    }
  }, []);

  const updateWsStatus = useCallback((connected: boolean) => {
    setConnectionStatus(prev => ({ ...prev, websocket: connected ? "connected" : "disconnected" }));
  }, []);

  // Fetch recent alerts on mount
  useEffect(() => {
    const token = localStorage.getItem("monitor_token");
    if (!token) return;
    const apiUrl = BASE_URL.endsWith("/api") ? BASE_URL : BASE_URL + "/api";
    fetch(apiUrl + "/alerts", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: Alert[]) => {
        if (Array.isArray(data)) {
          setLatestAlerts(data.slice(0, 10));
        }
      })
      .catch(() => {});
  }, []);

  // Poll backend connection status every 30 seconds
  const checkConnectionStatusRef = useRef<() => Promise<void>>();

  useEffect(() => {
    async function checkConnectionStatus() {
      // FIX 1: Mark as checking before the request
      setConnectionStatus(prev => ({ ...prev, backendChecking: true }));
      try {
        const statusUrl = BASE_URL.replace(/\/api$/, "") + "/api/connection-status";
        const res = await fetch(statusUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setConnectionStatus(prev => ({
            ...prev,
            backend: "connected",
            agentOnline: data.agentOnline ?? 0,
            agentTotal: data.agentTotal ?? 0,
            backendChecking: false, // FIX 2: Clear checking flag on success
          }));
        } else {
          setConnectionStatus(prev => ({
            ...prev,
            backend: "disconnected",
            agentOnline: 0,
            backendChecking: false, // FIX 2: Clear checking flag on failure
          }));
        }
      } catch {
        setConnectionStatus(prev => ({
          ...prev,
          backend: "disconnected",
          agentOnline: 0,
          backendChecking: false, // FIX 2: Clear checking flag on error
        }));
      }
    }

    checkConnectionStatusRef.current = checkConnectionStatus;
    checkConnectionStatus();
    healthRef.current = setInterval(checkConnectionStatus, 30_000);

    return () => {
      if (healthRef.current) clearInterval(healthRef.current);
    };
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    function connect() {
      try {
        const token = localStorage.getItem("monitor_token") || "";
        const wsUrl = token
          ? `${BASE_WS_URL}?token=${encodeURIComponent(token)}`
          : BASE_WS_URL;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          updateWsStatus(true);
          // FIX 3: Confirm backend is truly up when WS connects successfully
          checkConnectionStatusRef.current?.();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as { type: string; data: unknown };

            // ── Built-in handlers ────────────────────────────────────────
            if (msg.type === "activity") {
              setLatestActivities(prev => [msg.data as Activity, ...prev.slice(0, 19)]);
            } else if (msg.type === "alert_count") {
              setUnreadAlerts(msg.data as number);
            } else if (msg.type === "new-alert") {
              setLatestAlerts(prev => [msg.data as Alert, ...prev.slice(0, 9)]);
            } else if (msg.type === "new_message") {
              // Increment unread messages badge (the ConversationPage handles deducting via markRead)
              setUnreadMessages(prev => prev + 1);
            }

            // ── Dynamic subscribers (WebRTC, live-frame, etc.) ───────────
            const handlers = subscribersRef.current.get(msg.type);
            if (handlers && handlers.size > 0) {
              handlers.forEach(fn => fn(msg.data));
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onerror = () => {
          ws.close();
        };

        ws.onclose = () => {
          wsRef.current = null;
          // When the WS drops we don't yet know if the backend is truly offline.
          // Set backendChecking: true immediately so ProtectedRoute's
          // backendOffline guard (backend==="disconnected" && !backendChecking)
          // doesn't fire during the transient reconnect window.
          setConnectionStatus(prev => ({
            ...prev,
            websocket: "disconnected",
            backend: "disconnected",
            agentOnline: 0,
            backendChecking: true,
          }));
          // HTTP check will set the authoritative backend status + clear backendChecking
          checkConnectionStatusRef.current?.();
          reconnectRef.current = setTimeout(connect, 5000);
        };
      } catch {
        updateWsStatus(false);
        setConnectionStatus(prev => ({
          ...prev,
          backend: "disconnected",
          agentOnline: 0,
        }));
        reconnectRef.current = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [updateWsStatus]);

  return (
    <SocketContext.Provider value={{
      unreadAlerts, setUnreadAlerts,
      unreadMessages, setUnreadMessages,
      latestActivities,
      latestAlerts, setLatestAlerts,
      connectionStatus,
      subscribeToMessage,
      sendWsMessage,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}