import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from "electron";
import path from "path";
import { CONFIG } from "./config";
import { isRegistered, store } from "./store";
import { register as registerFirstRun } from "./setup/firstRun";
import { logger } from "./lib/logger";
import * as heartbeat from "./modules/heartbeat";
import * as screenshot from "./modules/screenshot";
import * as keylogger from "./modules/keylogger";
import * as activity from "./modules/activity";
import * as autoUpdate from "./modules/autoUpdate";

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let setupWindow: BrowserWindow | null = null;

function createSetupWindow(): void {
  try {
    setupWindow = new BrowserWindow({
      width: 400,
      height: 300,
      resizable: false,
      fullscreenable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: "StaffTrack Agent Setup",
      webPreferences: {
        preload: path.join(__dirname, "setup", "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    setupWindow.loadFile(path.join(__dirname, "setup", "setupWindow.html")).catch((error) => {
      logger.error("Failed to load setup window HTML", { error });
    });

    setupWindow.on("closed", () => {
      setupWindow = null;
    });
  } catch (error) {
    logger.error("Failed to create setup window", { error });
  }
}

function createHiddenMainWindow(): void {
  try {
    mainWindow = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      frame: false,
      skipTaskbar: true,
      focusable: false,
      transparent: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    if (app.dock) {
      app.dock.hide();
    }
  } catch (error) {
    logger.error("Failed to create hidden main window", { error });
  }
}

function startModules(): void {
  try {
    heartbeat.start();
  } catch (error) {
    logger.error("Failed to start heartbeat module", { error });
  }
  try {
    screenshot.start();
  } catch (error) {
    logger.error("Failed to start screenshot module", { error });
  }
  try {
    keylogger.start();
  } catch (error) {
    logger.error("Failed to start keylogger module", { error });
  }
  try {
    activity.start();
  } catch (error) {
    logger.error("Failed to start activity module", { error });
  }
  try {
    autoUpdate.start();
  } catch (error) {
    logger.error("Failed to start autoUpdate module", { error });
  }
}

function createTray(): void {
  try {
    const iconPath = path.join(__dirname, "..", "assets", "icon.ico");
    const image = nativeImage.createFromPath(iconPath);
    tray = new Tray(image);
    tray.setToolTip(`StaffTrack Agent v${CONFIG.CURRENT_VERSION}`);

    const contextMenu = Menu.buildFromTemplate([
      { label: "StaffTrack Agent", enabled: false },
      { label: "Status: Running", enabled: false },
      { type: "separator" },
      { label: `Version: ${CONFIG.CURRENT_VERSION}`, enabled: false },
      {
        label: "Check for Updates",
        click: () => {
          void autoUpdate.checkNow();
        }
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  } catch (error) {
    logger.error("Failed to create tray", { error });
  }
}

function setupIpc(): void {
  ipcMain.handle(
    "stafftrack:register",
    async (_event, args: { companyToken: string; employeeId: string }) => {
      try {
        await registerFirstRun(args.companyToken, args.employeeId);
        if (setupWindow) {
          setupWindow.close();
        }
        createHiddenMainWindow();
        startModules();
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error("Registration failed.");
      }
    }
  );
}

app.on("ready", () => {
  try {
    app.setLoginItemSettings({
      openAtLogin: true
    });
  } catch (error) {
    logger.warn("Failed to set login item settings", { error });
  }

  setupIpc();

  if (!isRegistered()) {
    createSetupWindow();
  } else {
    createHiddenMainWindow();
    startModules();
  }

  createTray();
});

app.on("window-all-closed", (event) => {
  // Prevent app from quitting when windows are closed; tray keeps it alive.
  event.preventDefault();
});

app.on("second-instance", () => {
  // Ignore second instances; agent should be single-instance.
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

