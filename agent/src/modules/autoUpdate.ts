import os from "os";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { spawn } from "child_process";
import axios from "axios";
import { CONFIG } from "../config";
import { store } from "../store";
import { logger } from "../lib/logger";

interface UpdateInfo {
  version: string;
  download_url: string;
}

async function downloadAndInstall(url: string): Promise<void> {
  const tmpExe = path.join(os.tmpdir(), "stafftrack-update.exe");
  try {
    const writer = fs.createWriteStream(tmpExe);
    const response = await axios.get(url, { responseType: "stream" });

    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", () => resolve());
      writer.on("error", (err) => reject(err));
    });

    const stats = fs.statSync(tmpExe);
    if (!stats || stats.size <= 0) {
      throw new Error("Downloaded file is empty");
    }

    logger.info("Update downloaded, installing...");

    const child = spawn(tmpExe, [], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 2000);
  } catch (error) {
    logger.error("Download/install failed", { error });
    if (fs.existsSync(tmpExe)) {
      try {
        fs.unlinkSync(tmpExe);
      } catch {
        // ignore
      }
    }
    throw error;
  }
}

async function checkForUpdate(): Promise<void> {
  try {
    store.set(CONFIG.STORE_KEYS.LAST_UPDATE_CHECK, new Date().toISOString());

    const response = await axios.get<UpdateInfo>(`${CONFIG.SERVER_URL}/api/agents/check-update`);
    const serverVersion = response.data.version;
    const downloadUrl = response.data.download_url;

    if (serverVersion === CONFIG.CURRENT_VERSION) {
      logger.info(`Already up to date: ${CONFIG.CURRENT_VERSION}`);
      return;
    }

    logger.info(`Update available: ${CONFIG.CURRENT_VERSION} → ${serverVersion}`);
    await downloadAndInstall(downloadUrl);
  } catch (error) {
    logger.warn("Update check failed", { error });
  }
}

export function start(): void {
  void checkForUpdate();
  setInterval(() => {
    void checkForUpdate();
  }, CONFIG.UPDATE_CHECK_INTERVAL_MS);
}

export async function checkNow(): Promise<void> {
  await checkForUpdate();
}

