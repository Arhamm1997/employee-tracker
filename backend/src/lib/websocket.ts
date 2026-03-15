import { WebSocket, WebSocketServer } from "ws";
import http from "http";
import { parse as parseUrl } from "url";
import jwt from "jsonwebtoken";
import logger from "./logger";
import prisma from "./prisma";

let wss: WebSocketServer | null = null;

// ── Client registries ─────────────────────────────────────────────────────────
// employeeId → agent WebSocket (one agent per employee)
const agentSockets = new Map<string, WebSocket>();

// sessionId → live view session (admin WS + which employee)
interface LiveSession {
  adminWs: WebSocket;
  employeeId: string;
}
const liveSessions = new Map<string, LiveSession>();

function sendTo(ws: WebSocket, type: string, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// ── Signaling: Admin → Agent ──────────────────────────────────────────────────
function handleAdminMessage(
  adminWs: WebSocket,
  adminId: string,
  msg: { type: string; data: unknown }
): void {
  const { type, data } = msg;

  if (type === "webrtc:request") {
    // Admin wants live view of an employee
    const { employeeId } = data as { employeeId: string };
    logger.debug(`WebRTC: admin ${adminId} requested live view of employee ${employeeId}`);
    logger.debug(`WebRTC: agentSockets has ${agentSockets.size} entries: [${[...agentSockets.keys()].join(", ")}]`);
    const agentWs = agentSockets.get(employeeId);

    if (!agentWs || agentWs.readyState !== WebSocket.OPEN) {
      logger.warn(`WebRTC: agent not found or not open for employee ${employeeId}`);
      sendTo(adminWs, "webrtc:error", { message: "Agent is offline or not connected" });
      return;
    }

    // Close any existing session this admin has for this employee
    for (const [sid, session] of liveSessions) {
      if (session.adminWs === adminWs && session.employeeId === employeeId) {
        sendTo(agentWs, "webrtc:stop", {});
        liveSessions.delete(sid);
      }
    }

    const sessionId = `${adminId}-${employeeId}-${Date.now()}`;
    liveSessions.set(sessionId, { adminWs, employeeId });

    // Tell agent to start WebRTC
    logger.debug(`WebRTC: sending webrtc:start to agent, sessionId=${sessionId}`);
    sendTo(agentWs, "webrtc:start", { sessionId });
    // Tell admin the session ID so it can route messages
    sendTo(adminWs, "webrtc:session", { sessionId, employeeId });

  } else if (type === "webrtc:answer") {
    // Admin sends SDP answer → forward to agent
    const { sessionId, sdp } = data as { sessionId: string; sdp: unknown };
    const session = liveSessions.get(sessionId);
    if (session) {
      const agentWs = agentSockets.get(session.employeeId);
      if (agentWs) sendTo(agentWs, "webrtc:answer", { sdp });
    }

  } else if (type === "webrtc:ice") {
    // Admin ICE candidate → forward to agent
    const { sessionId, candidate } = data as { sessionId: string; candidate: unknown };
    const session = liveSessions.get(sessionId);
    if (session) {
      const agentWs = agentSockets.get(session.employeeId);
      if (agentWs) sendTo(agentWs, "webrtc:ice", { candidate });
    }

  } else if (type === "webrtc:stop") {
    // Admin stopped watching
    const { sessionId } = data as { sessionId: string };
    const session = liveSessions.get(sessionId);
    if (session) {
      const agentWs = agentSockets.get(session.employeeId);
      if (agentWs) sendTo(agentWs, "webrtc:stop", {});
      liveSessions.delete(sessionId);
    }
  }
}

// ── Signaling: Agent → Admin ──────────────────────────────────────────────────
function handleAgentMessage(
  employeeId: string,
  msg: { type: string; data: unknown }
): void {
  const { type, data } = msg;

  if (type === "webrtc:offer") {
    // Agent SDP offer → route to the admin who requested
    const { sessionId, sdp } = data as { sessionId: string; sdp: unknown };
    const session = liveSessions.get(sessionId);
    if (session && session.employeeId === employeeId) {
      sendTo(session.adminWs, "webrtc:offer", { sessionId, sdp, employeeId });
    }

  } else if (type === "webrtc:ice") {
    // Agent ICE candidate → route to admin
    const { sessionId, candidate } = data as { sessionId: string; candidate: unknown };
    const session = liveSessions.get(sessionId);
    if (session && session.employeeId === employeeId) {
      sendTo(session.adminWs, "webrtc:ice", { sessionId, candidate });
    }

  } else if (type === "webrtc:error") {
    // Agent failed to create the offer — route error to admin
    const { sessionId, message } = data as { sessionId: string; message: string };
    const session = liveSessions.get(sessionId);
    if (session && session.employeeId === employeeId) {
      sendTo(session.adminWs, "webrtc:error", { message });
      liveSessions.delete(sessionId);
    }
  }
}

// ── WebSocket server init ─────────────────────────────────────────────────────
export function initWebSocket(server: http.Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    if (
      url === "/ws" ||
      url === "/api/ws" ||
      url.startsWith("/ws?") ||
      url.startsWith("/api/ws?")
    ) {
      wss!.handleUpgrade(request, socket, head, (client) => {
        wss!.emit("connection", client, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket, request: http.IncomingMessage) => {
    const query = parseUrl(request.url || "", true).query;
    const agentToken = query.agentToken as string | undefined;
    const adminToken = query.token as string | undefined;

    // ── Agent connection ─────────────────────────────────────────────────────
    if (agentToken) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { agentToken },
          select: { id: true, employeeCode: true, name: true, isActive: true },
        });

        if (!employee || !employee.isActive) {
          ws.close();
          return;
        }

        agentSockets.set(employee.id, ws);
        logger.debug(`Agent WS connected: ${employee.name} (${employee.employeeCode})`);

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString()) as { type: string; data: unknown };
            handleAgentMessage(employee.id, msg);
          } catch { /* ignore */ }
        });

        ws.on("close", () => {
          if (agentSockets.get(employee.id) === ws) {
            agentSockets.delete(employee.id);
          }
          // Notify any admin watching this employee that stream ended
          for (const [sid, session] of liveSessions) {
            if (session.employeeId === employee.id) {
              sendTo(session.adminWs, "webrtc:disconnected", { employeeId: employee.id });
              liveSessions.delete(sid);
            }
          }
          logger.debug(`Agent WS disconnected: ${employee.name}`);
        });

        ws.on("error", () => ws.close());
        return;
      } catch (e) {
        logger.error("Agent WS auth error:", e);
        ws.close();
        return;
      }
    }

    // ── Admin / viewer connection ─────────────────────────────────────────────
    let adminId: string | null = null;

    if (adminToken) {
      try {
        const decoded = jwt.verify(adminToken, process.env.JWT_SECRET!) as { id: string };
        adminId = decoded.id;
      } catch {
        // Invalid token: allow as passive viewer (broadcasts only, no signaling)
      }
    }

    // Send initial unread alert count
    try {
      const unread = await prisma.alert.count({ where: { isRead: false } });
      ws.send(JSON.stringify({ type: "alert_count", data: unread }));
    } catch { /* ignore */ }

    if (adminId) {
      const capturedAdminId = adminId;
      logger.debug(`Admin WS authenticated: adminId=${adminId}`);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type: string; data: unknown };
          logger.debug(`Admin WS message received: type=${msg.type}`);
          handleAdminMessage(ws, capturedAdminId, msg);
        } catch { /* ignore */ }
      });

      ws.on("close", () => {
        // Clean up any live sessions this admin owned
        for (const [sid, session] of liveSessions) {
          if (session.adminWs === ws) {
            const agentWs = agentSockets.get(session.employeeId);
            if (agentWs) sendTo(agentWs, "webrtc:stop", {});
            liveSessions.delete(sid);
          }
        }
      });
    }

    ws.on("error", () => ws.close());
    logger.debug("Admin/viewer WS client connected");
  });

  logger.info("WebSocket server initialized (paths: /ws, /api/ws)");
}

// ── Utility ───────────────────────────────────────────────────────────────────
export function getConnectedClients(): number {
  if (!wss) return 0;
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

export function broadcast(type: string, data: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export async function broadcastAlertCount(): Promise<void> {
  try {
    const unread = await prisma.alert.count({ where: { isRead: false } });
    broadcast("alert_count", unread);
  } catch (err) {
    logger.error("Failed to broadcast alert count:", err);
  }
}
