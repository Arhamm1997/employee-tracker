import os from "os";
import path from "path";
import fs from "fs";
import screenshot from "screenshot-desktop";
import FormData from "form-data";
import { CONFIG } from "../config";
import { store } from "../store";
import { api } from "../lib/api";
import { logger } from "../lib/logger";

export function start(): void {
  setInterval(async () => {
    try {
      const agentId = store.get(CONFIG.STORE_KEYS.AGENT_ID);
      if (!agentId) return;

      const imgBuffer = await screenshot({ format: "png" });
      const tmpPath = path.join(os.tmpdir(), `st_screenshot_${Date.now()}.png`);
      fs.writeFileSync(tmpPath, imgBuffer);

      const form = new FormData();
      form.append("file", fs.createReadStream(tmpPath), "screenshot.png");
      form.append("agent_id", agentId);
      form.append("taken_at", new Date().toISOString());

      await api.post(`${CONFIG.SERVER_URL}/api/agents/screenshot`, form, {
        headers: form.getHeaders()
      });

      fs.unlinkSync(tmpPath);
    } catch (error) {
      logger.warn("Screenshot failed", { error });
    }
  }, CONFIG.SCREENSHOT_INTERVAL_MS);
}

