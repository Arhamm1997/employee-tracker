/**
 * Global Error Logger
 * Captures all frontend errors and sends them to the backend.
 * Errors are written to .errors/frontend-errors.log on the server.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

interface ErrorEntry {
  timestamp: string;
  type: "error" | "warning" | "network" | "unhandled_rejection";
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  col?: number;
  context?: Record<string, unknown>;
}

const _buffer: ErrorEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function addEntry(entry: ErrorEntry) {
  _buffer.push(entry);
  if (!_flushTimer) {
    _flushTimer = setTimeout(flush, 5000);
  }
}

async function flush() {
  _flushTimer = null;
  if (_buffer.length === 0) return;
  const entries = _buffer.splice(0, _buffer.length);
  try {
    const token = localStorage.getItem("monitor_token");
    await fetch(`${BASE_URL}/system/frontend-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ errors: entries }),
    });
  } catch {
    // silently fail — cannot log errors about the error logger itself
  }
}

export function initErrorLogger() {
  // ── console.error intercept ────────────────────────────────────────────────
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const message = args
      .map((a) => (a instanceof Error ? a.stack || a.message : String(a)))
      .join(" ");
    addEntry({
      timestamp: new Date().toISOString(),
      type: "error",
      message,
      stack: args[0] instanceof Error ? args[0].stack : undefined,
      context: { route: window.location.pathname },
    });
  };

  // ── console.warn intercept ─────────────────────────────────────────────────
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    addEntry({
      timestamp: new Date().toISOString(),
      type: "warning",
      message: args.map(String).join(" "),
      context: { route: window.location.pathname },
    });
  };

  // ── Global JS errors ───────────────────────────────────────────────────────
  window.onerror = (message, source, lineno, colno, error) => {
    addEntry({
      timestamp: new Date().toISOString(),
      type: "error",
      message: String(message),
      stack: error?.stack,
      url: source,
      line: lineno,
      col: colno,
      context: { route: window.location.pathname },
    });
    return false;
  };

  // ── Unhandled promise rejections ───────────────────────────────────────────
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    addEntry({
      timestamp: new Date().toISOString(),
      type: "unhandled_rejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      context: { route: window.location.pathname },
    });
  });

  // ── Fetch network error intercept ──────────────────────────────────────────
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    const method = (args[1] as RequestInit)?.method || "GET";

    // Never intercept our own reporting endpoint (infinite loop prevention)
    if (url.includes("/system/frontend-error")) {
      return origFetch(...args);
    }

    try {
      const res = await origFetch(...args);
      if (!res.ok) {
        addEntry({
          timestamp: new Date().toISOString(),
          type: "network",
          message: `HTTP ${res.status} ${res.statusText} — ${method} ${url}`,
          url,
          context: { status: res.status, method },
        });
      }
      return res;
    } catch (err) {
      addEntry({
        timestamp: new Date().toISOString(),
        type: "network",
        message: `Network failure — ${method} ${url}: ${err instanceof Error ? err.message : String(err)}`,
        url,
        stack: err instanceof Error ? err.stack : undefined,
        context: { method },
      });
      throw err;
    }
  };

  // ── Flush on page close ────────────────────────────────────────────────────
  window.addEventListener("beforeunload", () => {
    if (_buffer.length > 0) flush();
  });

  // ── Periodic flush every 30s ───────────────────────────────────────────────
  setInterval(flush, 30_000);
}
