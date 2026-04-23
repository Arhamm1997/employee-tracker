import { Request, Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { body, validationResult } from "express-validator";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma";
import { broadcast } from "../lib/websocket";
import { createAlert, checkBlockedSite, checkAfterHours } from "../services/alert.service";
import { AgentRequest } from "../middleware/agentAuth.middleware";
import logger from "../lib/logger";
import { Readable } from "stream";

const SCREENSHOTS_DIR = path.join(process.cwd(), "uploads", "screenshots");

// ─── Multer ──────────────────────────────────────────────────────────────────

export const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function uploadToCloudinary(
  buffer: Buffer,
  folder = "screenshots"
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        quality: "auto",
        fetch_format: "auto",
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

async function saveLocally(buffer: Buffer): Promise<string> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  // Use full backend URL so frontend can load it across domains
  const baseUrl = (process.env.VPS_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/api$/, "");
  return `${baseUrl}/uploads/screenshots/${filename}`;
}

function getSettingsForAgent(settings: {
  screenshotInterval: number;
  idleThreshold: number;
  screenshotsEnabled: boolean;
  browserHistoryEnabled: boolean;
  usbMonitoringEnabled: boolean;
  clipboardEnabled: boolean;
  afterHoursEnabled: boolean;
  blockedSites: string[];
  productiveApps: string[];
  nonProductiveApps: string[];
  keylogEnabled: boolean;
  fileMonitorEnabled: boolean;
  printMonitorEnabled: boolean;
}) {
  return {
    screenshotInterval: settings.screenshotInterval,
    idleThreshold: settings.idleThreshold,
    screenshotsEnabled: settings.screenshotsEnabled,
    browserHistoryEnabled: settings.browserHistoryEnabled,
    usbMonitoringEnabled: settings.usbMonitoringEnabled,
    clipboardEnabled: settings.clipboardEnabled,
    afterHoursEnabled: settings.afterHoursEnabled,
    blockedSites: settings.blockedSites,
    productiveApps: settings.productiveApps,
    nonProductiveApps: settings.nonProductiveApps,
    keylogEnabled: settings.keylogEnabled,
    fileMonitorEnabled: settings.fileMonitorEnabled,
    printMonitorEnabled: settings.printMonitorEnabled,
  };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export async function verifyAgent(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emp = req.employee!;
    res.json({
      valid: true,
      employee: { name: emp.name, code: emp.employeeCode },
    });
  } catch (err) {
    next(err);
  }
}

export const heartbeatValidation = [
  body("employeeCode").notEmpty(),
  body("appName").notEmpty(),
  body("windowTitle").notEmpty(),
  body("isIdle").isBoolean(),
];

export async function heartbeat(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appName, windowTitle, isIdle, timestamp } = req.body as {
      appName: string;
      windowTitle: string;
      isIdle: boolean;
      timestamp?: string;
    };

    const emp = req.employee!;
    const companyId = emp.companyId;

    // Subscription check — return stop signal if expired
    if (companyId) {
      const sub = await prisma.subscription.findUnique({
        where: { companyId },
        select: { status: true, currentPeriodEnd: true },
      });
      if (!sub || sub.status !== "ACTIVE" || sub.currentPeriodEnd < new Date()) {
        res.json({ success: false, shouldStop: true, reason: "subscription_expired" });
        return;
      }
    }

    const settings = await prisma.settings.findFirst({
      where: companyId ? { companyId } : {},
    });
    if (!settings) {
      res.status(500).json({ message: "Settings not configured" });
      return;
    }

    // Determine if productive
    const isProductive =
      settings.productiveApps.some((p) => appName.toLowerCase().includes(p.toLowerCase())) ||
      (!settings.nonProductiveApps.some((np) => appName.toLowerCase().includes(np.toLowerCase())) && !isIdle);

    // Determine after-hours
    const now = new Date();
    const [startH, startM] = settings.workStartTime.split(":").map(Number);
    const [endH, endM] = settings.workEndTime.split(":").map(Number);
    const workStartMins = startH * 60 + startM;
    const workEndMins = endH * 60 + endM;
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isAfterHours = currentMins < workStartMins || currentMins > workEndMins;

    const activityTimestamp = timestamp ? new Date(timestamp) : now;

    // Save activity
    const activity = await prisma.activity.create({
      data: {
        employeeId: emp.id,
        companyId,
        appName,
        windowTitle,
        isIdle,
        isProductive,
        isAfterHours,
        timestamp: activityTimestamp,
      },
    });

    // Update lastSeenAt
    await prisma.employee.update({
      where: { id: emp.id },
      data: { lastSeenAt: now },
    });

    // Record connection event (online) if was offline — check lastSeenAt before update
    const empRecord = await prisma.employee.findUnique({ where: { id: emp.id }, select: { lastSeenAt: true } });
    const prevSeen = empRecord?.lastSeenAt;
    const wasOffline = !prevSeen || (new Date().getTime() - prevSeen.getTime() > 5 * 60 * 1000);
    if (wasOffline) {
      await prisma.connectionEvent.create({ data: { employeeId: emp.id, event: "online" } });
      broadcast("employee-status-change", { employeeId: emp.id, event: "online", time: now.toISOString() });
    }

    // Emit real-time activity update
    broadcast("activity-update", {
      employeeId: emp.id,
      employeeName: emp.name,
      avatar: "",
      app: appName,
      windowTitle,
      time: activityTimestamp.toISOString(),
      type: isIdle ? "idle" : isProductive ? "productive" : "neutral",
    });

    broadcast("employee-online", { employeeId: emp.id });

    // ── Alert checks ────────────────────────────────────────────────────────
    // Note: blocked site alerts are fired from browser history (real URLs only),
    // not from window titles — window title matching causes too many false positives.

    // 2. After-hours check
    if (settings.afterHoursEnabled && settings.alertOnAfterHours && isAfterHours && !isIdle) {
      // Only create after-hours alert once per 30 minutes per employee
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const recentAfterHoursAlert = await prisma.alert.findFirst({
        where: {
          employeeId: emp.id,
          type: "after_hours",
          timestamp: { gte: thirtyMinsAgo },
        },
      });

      if (!recentAfterHoursAlert) {
        await checkAfterHours(emp.id, settings.workStartTime, settings.workEndTime);
      }
    }

    // 3. Idle alert
    if (isIdle && settings.alertOnIdle) {
      const thresholdMs = settings.idleAlertThreshold * 60 * 1000;
      const thresholdAgo = new Date(now.getTime() - thresholdMs);

      // Check if consecutive idle activities exceed threshold
      const recentIdleAlert = await prisma.alert.findFirst({
        where: {
          employeeId: emp.id,
          type: "idle_long",
          timestamp: { gte: thresholdAgo },
        },
      });

      if (!recentIdleAlert) {
        const idleStreak = await prisma.activity.count({
          where: {
            employeeId: emp.id,
            isIdle: true,
            timestamp: { gte: thresholdAgo },
          },
        });

        if (idleStreak >= 3) {
          await createAlert({
            employeeId: emp.id,
            type: "idle_long",
            message: `${emp.name} has been idle for over ${settings.idleAlertThreshold} minutes`,
            severity: "medium",
            metadata: { idleMinutes: settings.idleAlertThreshold },
          });
        }
      }
    }

    res.json({
      success: true,
      settings: getSettingsForAgent(settings),
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadScreenshot(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ message: "Screenshot file is required" });
      return;
    }

    const { appName = "Unknown", windowTitle = "", monitorCount = "1" } = req.body as {
      appName?: string;
      windowTitle?: string;
      monitorCount?: string;
    };

    const emp = req.employee!;

    let imageUrl: string;
    let cloudinaryId: string | undefined;

    try {
      const result = await uploadToCloudinary(file.buffer, "employee-monitor/screenshots");
      imageUrl = result.url;
      cloudinaryId = result.publicId;
    } catch (cloudErr) {
      logger.warn("Cloudinary upload failed, saving locally:", (cloudErr as Error).message);
      try {
        imageUrl = await saveLocally(file.buffer);
      } catch (localErr) {
        logger.error("Local screenshot save also failed:", localErr);
        res.status(502).json({ message: "Screenshot upload failed" });
        return;
      }
    }

    const screenshot = await prisma.screenshot.create({
      data: {
        employeeId: emp.id,
        companyId: emp.companyId,
        imageUrl,
        cloudinaryId,
        appName,
        windowTitle,
        monitorCount: Number(monitorCount) || 1,
      },
    });

    broadcast("screenshot-taken", {
      employeeId: emp.id,
      imageUrl,
      timestamp: screenshot.timestamp.toISOString(),
    });

    res.json({ success: true, screenshotId: screenshot.id, imageUrl });
  } catch (err) {
    next(err);
  }
}

export async function saveBrowserHistory(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { history } = req.body as {
      history: {
        browser: string;
        url: string;
        title: string;
        visitedAt: string;
        duration?: number;
      }[];
    };

    if (!Array.isArray(history) || history.length === 0) {
      res.status(400).json({ message: "History array is required" });
      return;
    }

    const emp = req.employee!;
    const settings = await prisma.settings.findFirst({
      where: emp.companyId ? { companyId: emp.companyId } : {},
      select: { blockedSites: true, browserHistoryEnabled: true },
    });

    if (settings && !settings.browserHistoryEnabled) {
      res.json({ success: true, message: "Browser history tracking is disabled" });
      return;
    }

    const blockedSites = settings?.blockedSites || [];

    // Domain-aware blocked check: match hostname exactly or as subdomain
    const isUrlBlocked = (url: string): boolean => {
      if (!blockedSites.length) return false;
      let hostname = url.toLowerCase();
      try { hostname = new URL(url).hostname.toLowerCase(); } catch { /* use raw */ }
      return blockedSites.some((site) => {
        const s = site.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
        return hostname === s || hostname.endsWith(`.${s}`);
      });
    };

    const data = history.slice(0, 200).map((item) => ({
      employeeId: emp.id,
      browser: item.browser,
      url: item.url.substring(0, 2000),
      title: item.title.substring(0, 500),
      visitedAt: new Date(item.visitedAt),
      duration: item.duration || null,
      isBlocked: isUrlBlocked(item.url),
    }));

    await prisma.browserHistory.createMany({ data, skipDuplicates: true });

    // Alert only for blocked URLs — deduplicate: skip if same employee+hostname alerted in last 10 min
    const blockedEntries = data.filter((d) => d.isBlocked);
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    for (const entry of blockedEntries.slice(0, 5)) {
      let hostname = entry.url;
      try { hostname = new URL(entry.url).hostname; } catch { /* keep raw */ }

      const recentAlert = await prisma.alert.findFirst({
        where: {
          employeeId: emp.id,
          type: "blocked_site",
          message: { contains: hostname },
          createdAt: { gte: tenMinAgo },
        },
      });
      if (recentAlert) continue; // already alerted recently for this site

      await createAlert({
        employeeId: emp.id,
        type: "blocked_site",
        message: `${emp.name} visited blocked site: ${hostname}`,
        severity: "high",
        metadata: { url: entry.url, title: entry.title, browser: entry.browser },
      });
    }

    res.json({ success: true, saved: data.length, blocked: blockedEntries.length });
  } catch (err) {
    next(err);
  }
}

export async function saveUsbEvent(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceName, deviceType, action } = req.body as {
      deviceName: string;
      deviceType: string;
      action: "connected" | "disconnected";
    };

    const emp = req.employee!;

    const usbEvent = await prisma.usbEvent.create({
      data: { employeeId: emp.id, deviceName, deviceType, action },
    });

    // Create high severity alert for USB connection
    if (action === "connected") {
      await createAlert({
        employeeId: emp.id,
        type: "usb_connected",
        message: `${emp.name} connected USB device: ${deviceName}`,
        severity: "high",
        metadata: { deviceName, deviceType, action },
      });
    }

    res.json({ success: true, eventId: usbEvent.id });
  } catch (err) {
    next(err);
  }
}

export async function reportNewSoftware(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { softwareName, installedAt } = req.body as {
      softwareName: string;
      installedAt?: string;
    };

    const emp = req.employee!;

    await createAlert({
      employeeId: emp.id,
      type: "new_software",
      message: `${emp.name} installed new software: ${softwareName}`,
      severity: "medium",
      metadata: {
        softwareName,
        installedAt: installedAt || new Date().toISOString(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function saveClipboard(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { content, appName } = req.body as { content: string; appName: string };
    const emp = req.employee!;

    const settings = await prisma.settings.findFirst({
      where: emp.companyId ? { companyId: emp.companyId } : {},
      select: { clipboardEnabled: true },
    });
    if (!settings?.clipboardEnabled) {
      res.json({ success: true, message: "Clipboard monitoring is disabled" });
      return;
    }

    await prisma.clipboardLog.create({
      data: {
        employeeId: emp.id,
        content: content.substring(0, 500),
        appName,
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function reportShutdown(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emp = req.employee!;
    await prisma.connectionEvent.create({
      data: { employeeId: emp.id, event: "shutdown" },
    });
    broadcast("employee-offline", { employeeId: emp.id, event: "shutdown" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getPendingCommand(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emp = req.employee!;
    const employee = await prisma.employee.findUnique({
      where: { id: emp.id },
      select: { pendingCommand: true },
    });
    const command = employee?.pendingCommand || null;
    if (command) {
      await prisma.employee.update({ where: { id: emp.id }, data: { pendingCommand: null } });
    }
    res.json({ command });
  } catch (err) {
    next(err);
  }
}

export async function saveKeylog(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appName, keys } = req.body as { appName: string; keys: string };
    if (!keys || !appName) {
      res.status(400).json({ message: "appName and keys are required" });
      return;
    }
    const emp = req.employee!;
    const settings = await prisma.settings.findFirst({
      where: emp.companyId ? { companyId: emp.companyId } : {},
      select: { keylogEnabled: true },
    });
    if (!settings?.keylogEnabled) {
      res.json({ success: true, message: "Keylogger disabled" });
      return;
    }
    await prisma.keylogEntry.create({
      data: { employeeId: emp.id, appName, keys: keys.substring(0, 2000) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function saveFileActivity(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { activities } = req.body as {
      activities: { action: string; filePath: string; appName: string; timestamp?: string }[];
    };
    if (!Array.isArray(activities) || activities.length === 0) {
      res.status(400).json({ message: "activities array required" });
      return;
    }
    const emp = req.employee!;
    const settings = await prisma.settings.findFirst({
      where: emp.companyId ? { companyId: emp.companyId } : {},
      select: { fileMonitorEnabled: true },
    });
    if (!settings?.fileMonitorEnabled) {
      res.json({ success: true, message: "File monitoring disabled" });
      return;
    }
    await prisma.fileActivity.createMany({
      data: activities.slice(0, 100).map((a) => ({
        employeeId: emp.id,
        action: a.action,
        filePath: a.filePath.substring(0, 500),
        appName: a.appName,
        timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
      })),
    });
    res.json({ success: true, saved: activities.length });
  } catch (err) {
    next(err);
  }
}

export async function savePrintLog(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { printer, document, pages, appName } = req.body as {
      printer: string;
      document: string;
      pages?: number;
      appName: string;
    };
    if (!printer || !document) {
      res.status(400).json({ message: "printer and document required" });
      return;
    }
    const emp = req.employee!;
    const settings = await prisma.settings.findFirst({
      where: emp.companyId ? { companyId: emp.companyId } : {},
      select: { printMonitorEnabled: true },
    });
    if (!settings?.printMonitorEnabled) {
      res.json({ success: true, message: "Print monitoring disabled" });
      return;
    }
    await prisma.printLog.create({
      data: { employeeId: emp.id, printer, document, pages: pages || 1, appName },
    });
    await createAlert({
      employeeId: emp.id,
      type: "new_software",
      message: `${emp.name} printed: "${document}" (${pages || 1} page${(pages || 1) > 1 ? "s" : ""}) on ${printer}`,
      severity: "low",
      metadata: { printer, document, pages },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function receiveLiveScreenFrame(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ message: "Frame required" });
      return;
    }
    const emp = req.employee!;
    const base64 = file.buffer.toString("base64");
    broadcast("live-frame", {
      employeeId: emp.id,
      employeeName: emp.name,
      frame: `data:image/jpeg;base64,${base64}`,
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function checkUpdate(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agentVersion = req.headers["x-agent-version"] as string | undefined;

    const latestUpdate = await prisma.agentUpdate.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: "desc" },
    });

    if (!latestUpdate) {
      res.json({ hasUpdate: false });
      return;
    }

    const hasUpdate = !agentVersion || agentVersion !== latestUpdate.version;

    // Update agent version on employee record
    if (agentVersion) {
      await prisma.employee.update({
        where: { id: req.employee!.id },
        data: { agentVersion },
      });
    }

    res.json({
      hasUpdate,
      version: latestUpdate.version,
      downloadUrl: hasUpdate ? latestUpdate.downloadUrl : undefined,
      changelog: hasUpdate ? latestUpdate.changelog : undefined,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Agent Update Management ──────────────────────────────────────────────────

export async function getAgentUpdates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updates = await prisma.agentUpdate.findMany({ orderBy: { createdAt: "desc" } });
    res.json(updates);
  } catch (err) {
    next(err);
  }
}

export async function createAgentUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { version, downloadUrl, changelog } = req.body as {
      version: string;
      downloadUrl: string;
      changelog: string;
    };

    // Mark all existing as not latest
    await prisma.agentUpdate.updateMany({ data: { isLatest: false } });

    const update = await prisma.agentUpdate.create({
      data: { version, downloadUrl, changelog, isLatest: true },
    });

    res.status(201).json(update);
  } catch (err) {
    next(err);
  }
}
