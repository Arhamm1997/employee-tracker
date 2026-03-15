import os from "os";
import { CONFIG } from "../config";
import { store } from "../store";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

function getLocalIP(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const value of Object.values(interfaces)) {
      if (!value) continue;
      for (const iface of value) {
        if (iface.internal) continue;
        if (iface.family === "IPv4" && iface.address) {
          return iface.address;
        }
      }
    }
    return "unknown";
  } catch (error) {
    logger.warn("Failed to determine local IP", { error });
    return "unknown";
  }
}

export function start(): void {
  setInterval(async () => {
    try {
      const agentId = store.get(CONFIG.STORE_KEYS.AGENT_ID);
      if (!agentId) return;

      await api.post(`${CONFIG.SERVER_URL}/api/agents/heartbeat`, {
        agent_id: agentId,
        status: "online",
        ip_address: getLocalIP()
      });
    } catch (error) {
      logger.warn("Heartbeat failed", { error });
    }
  }, CONFIG.HEARTBEAT_INTERVAL_MS);
}

