import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { errorsDir } from "../lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appendToLog(filename: string, lines: string) {
  try {
    // Ensure the errors directory exists at write-time (not just at module load)
    if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true });
    const file = path.join(errorsDir, filename);
    fs.appendFileSync(file, lines, "utf8");
  } catch {
    // Silently swallow — never let log-writing crash the server
  }
}

function readLogSafe(filename: string): string {
  const file = path.join(errorsDir, filename);
  if (!fs.existsSync(file)) return `[No entries yet — ${filename} is empty]\n`;
  return fs.readFileSync(file, "utf8");
}

export async function downloadBackup(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [
      admins,
      employees,
      activities,
      screenshots,
      alerts,
      browserHistory,
      usbEvents,
      clipboardLogs,
      connectionEvents,
      keylogEntries,
      fileActivities,
      printLogs,
      settings,
    ] = await Promise.all([
      prisma.admin.findMany(),
      prisma.employee.findMany(),
      prisma.activity.findMany(),
      prisma.screenshot.findMany(),
      prisma.alert.findMany(),
      prisma.browserHistory.findMany(),
      prisma.usbEvent.findMany(),
      prisma.clipboardLog.findMany(),
      prisma.connectionEvent.findMany(),
      prisma.keylogEntry.findMany(),
      prisma.fileActivity.findMany(),
      prisma.printLog.findMany(),
      prisma.settings.findFirst(),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        admins: admins.map((a) => ({
          ...a,
          password: "[REDACTED]",
        })),
        employees,
        activities,
        screenshots: screenshots.map((s) => ({
          ...s,
          imageUrl: "[REDACTED]",
        })),
        alerts,
        browserHistory,
        usbEvents,
        clipboardLogs: clipboardLogs.map((c) => ({
          ...c,
          content: "[REDACTED]",
        })),
        connectionEvents,
        keylogEntries: keylogEntries.map((k) => ({
          ...k,
          keys: "[REDACTED]",
        })),
        fileActivities,
        printLogs,
        settings,
      },
    };

    const filename = `employee-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    next(err);
  }
}

export async function resetCompleteApp(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { confirmation } = req.body as { confirmation?: string };

    if (confirmation !== "RESET_COMPLETE_APP") {
      res.status(400).json({ message: "Invalid confirmation phrase" });
      return;
    }

    // Delete all data in order of dependencies
    await prisma.$transaction([
      // Delete monitoring data first
      prisma.activity.deleteMany({}),
      prisma.screenshot.deleteMany({}),
      prisma.alert.deleteMany({}),
      prisma.browserHistory.deleteMany({}),
      prisma.usbEvent.deleteMany({}),
      prisma.clipboardLog.deleteMany({}),
      prisma.connectionEvent.deleteMany({}),
      prisma.keylogEntry.deleteMany({}),
      prisma.fileActivity.deleteMany({}),
      prisma.printLog.deleteMany({}),
      // Delete employees
      prisma.employee.deleteMany({}),
      // Delete settings
      prisma.settings.deleteMany({}),
      // Keep admins - don't delete them
    ]);

    res.json({
      success: true,
      message: "Application has been completely reset. All data has been deleted.",
    });
  } catch (err) {
    next(err);
  }
}

// ─── Error Report Endpoints ───────────────────────────────────────────────────

interface ErrorEntry {
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  col?: number;
  context?: Record<string, unknown>;
}

/**
 * POST /api/system/frontend-error
 * Receives batched frontend errors and appends to frontend-errors.log
 */
export async function logFrontendError(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { errors } = req.body as { errors: ErrorEntry[] };
    if (!Array.isArray(errors) || errors.length === 0) {
      res.json({ ok: true });
      return;
    }

    const sep = "=".repeat(80);
    const lines = errors
      .map((e) => {
        let entry = `${sep}\n[${e.timestamp}] [${e.type.toUpperCase()}] ${e.message}`;
        if (e.url) entry += `\nSOURCE: ${e.url}`;
        if (e.line != null) entry += `  LINE: ${e.line}  COL: ${e.col ?? "?"}`;
        if (e.stack) entry += `\nSTACK:\n${e.stack}`;
        if (e.context && Object.keys(e.context).length)
          entry += `\nCONTEXT: ${JSON.stringify(e.context)}`;
        entry += "\n";
        return entry;
      })
      .join("");

    appendToLog("frontend-errors.log", lines);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // never error on error reporting
  }
}

/**
 * POST /api/agent/error-report  (called from agent, registered in agent.routes.ts)
 * Receives batched agent errors and appends to agent-errors.log
 */
export async function logAgentError(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { employeeCode, errors } = req.body as {
      employeeCode: string;
      errors: Array<{ timestamp: string; level: string; message: string }>;
    };
    if (!Array.isArray(errors) || errors.length === 0) {
      res.json({ ok: true });
      return;
    }

    const sep = "=".repeat(80);
    const lines = errors
      .map((e) => {
        return `${sep}\n[${e.timestamp}] [${e.level.toUpperCase()}] [${employeeCode || "UNKNOWN"}] ${e.message}\n`;
      })
      .join("");

    appendToLog("agent-errors.log", lines);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
}

/**
 * GET /api/system/download-errors?file=frontend|backend|agent
 * Returns the requested error log file as plain text download.
 * superadmin only.
 */
export async function downloadErrorReport(
  req: Request,
  res: Response
): Promise<void> {
  const allowed = ["frontend", "backend", "agent"];
  const which = req.query.file as string;

  if (!allowed.includes(which)) {
    res.status(400).json({ message: "file must be frontend, backend, or agent" });
    return;
  }

  const filename = `${which}-errors.log`;
  const content = readLogSafe(filename);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(content);
}
