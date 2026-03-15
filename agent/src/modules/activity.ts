import activeWindow from "active-win";
import { CONFIG } from "../config";
import { store } from "../store";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

interface ActivityEntry {
  activity_type: string;
  detail: string;
  duration_sec: number;
  logged_at: string;
}

let lastWindow: string = "";
let windowStartTime: number = Date.now();
let activityBatch: ActivityEntry[] = [];

async function checkWindow(): Promise<void> {
  try {
    const win = await activeWindow();
    if (!win) return;

    const currentTitle = `${win.title} — ${win.owner?.name ?? ""}`.trim();
    const now = Date.now();

    if (currentTitle !== lastWindow) {
      const duration = Math.round((now - windowStartTime) / 1000);
      if (lastWindow && duration > 0) {
        activityBatch.push({
          activity_type: "app_open",
          detail: lastWindow,
          duration_sec: duration,
          logged_at: new Date().toISOString()
        });
      }
      lastWindow = currentTitle;
      windowStartTime = now;
    }
  } catch (error) {
    logger.debug?.("Activity check error", { error });
  }
}

async function flushActivity(): Promise<void> {
  try {
    const agentId = store.get(CONFIG.STORE_KEYS.AGENT_ID);
    if (!agentId || activityBatch.length === 0) return;

    const batchToSend = activityBatch;
    activityBatch = [];

    await api.post(`${CONFIG.SERVER_URL}/api/agents/activity`, {
      agent_id: agentId,
      logs: batchToSend
    });
  } catch (error) {
    logger.warn("Activity flush failed", { error });
  }
}

export function start(): void {
  setInterval(() => {
    void checkWindow();
  }, CONFIG.ACTIVITY_CHECK_INTERVAL_MS);

  setInterval(() => {
    void flushActivity();
  }, 60000);
}

