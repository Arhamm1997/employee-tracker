import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import prisma from "../../lib/prisma";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

const ERRORS_DIR = path.resolve(process.cwd(), "..", ".errors");

type ErrorSource = "agent" | "server" | "api" | "frontend" | "portal";

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  source: ErrorSource;
  severity: "error" | "warning" | "info";
  message: string;
  stackTrace?: string;
}

function parseLogFile(filename: string, defaultSource: ErrorSource): ErrorLogEntry[] {
  const logPath = path.join(ERRORS_DIR, filename);
  if (!fs.existsSync(logPath)) return [];

  const content = fs.readFileSync(logPath, "utf-8");
  const entries: ErrorLogEntry[] = [];
  const separator = "=".repeat(80);
  const blocks = content.split(separator).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length === 0) continue;

    // Match: [TIMESTAMP] [LEVEL] [optional-code] message
    const firstLine = lines[0];
    const match = firstLine.match(
      /\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]\s+\[(\w+)\](?:\s+\[([^\]]+)\])?\s*(.*)/
    );
    if (!match) continue;

    const [, ts, level, , msg] = match;

    let timestamp: string;
    try {
      timestamp = new Date(ts.replace(" ", "T") + (ts.includes("Z") ? "" : "Z")).toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    const severity: "error" | "warning" | "info" =
      level.toLowerCase() === "error"
        ? "error"
        : level.toLowerCase() === "warn" || level.toLowerCase() === "warning"
        ? "warning"
        : "info";

    // Collect stack trace + metadata lines
    const restLines = lines.slice(1).join("\n").trim();
    const stackTrace = restLines || undefined;

    // Auto-detect source for backend log only; others use their default
    let source: ErrorSource = defaultSource;
    if (defaultSource === "server") {
      const msgLower = (msg + (stackTrace ?? "")).toLowerCase();
      if (msgLower.includes("agent")) source = "agent";
      else if (msgLower.includes("api") || msgLower.includes("route")) source = "api";
    }

    entries.push({
      id: "",
      timestamp,
      source,
      severity,
      message: msg.trim() || restLines?.split("\n")[0] || "Unknown error",
      stackTrace,
    });
  }

  return entries;
}

function getAllErrorLogs(): ErrorLogEntry[] {
  const backend  = parseLogFile("backend-errors.log",  "server");
  const agent    = parseLogFile("agent-errors.log",    "agent");
  const frontend = parseLogFile("frontend-errors.log", "frontend");
  const portal   = parseLogFile("portal-errors.log",   "portal");

  const all = [...backend, ...agent, ...frontend, ...portal]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return all.map((e, i) => ({ ...e, id: String(i + 1) }));
}

// ── GET /admin/logs/errors ────────────────────────────────────────────────────
router.get("/errors", (req: AdminRequest, res: Response) => {
  try {
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const severityFilter = req.query.severity as string | undefined;
    const sourceFilter = req.query.source as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

    let logs = getAllErrorLogs();

    if (severityFilter && severityFilter !== "all") {
      logs = logs.filter((l) => l.severity === severityFilter);
    }
    if (sourceFilter && sourceFilter !== "all") {
      logs = logs.filter((l) => l.source === sourceFilter);
    }
    if (startDate) {
      logs = logs.filter((l) => new Date(l.timestamp) >= startDate);
    }
    if (endDate) {
      logs = logs.filter((l) => new Date(l.timestamp) <= endDate);
    }

    const total = logs.length;
    const skip = (page - 1) * pageSize;
    const data = logs.slice(skip, skip + pageSize);

    return res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    logger.error("Error logs read error", { err });
    return res.status(500).json({ success: false, error: "Failed to read error logs" });
  }
});

// ── GET /admin/logs/audit ─────────────────────────────────────────────────────
router.get("/audit", async (req: AdminRequest, res: Response) => {
  try {
    const pageSize = Math.min(Number(req.query.pageSize ?? 50), 100);
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const skip = (page - 1) * pageSize;
    const customerId = req.query.customerId as string | undefined;
    const actionFilter = req.query.action as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (customerId && customerId !== "all") {
      where.company_id = customerId;
    }
    if (actionFilter && actionFilter !== "all") {
      where.action = { contains: actionFilter, mode: "insensitive" };
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Batch-lookup admin names and company names
    const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
    const companyIds = [...new Set(logs.map((l) => l.company_id).filter(Boolean))];

    const [admins, companies] = await Promise.all([
      userIds.length > 0
        ? prisma.admin.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : [],
      companyIds.length > 0
        ? prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const adminMap = new Map(admins.map((a) => [a.id, a.name]));
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    const data = logs.map((log) => ({
      id: log.id,
      adminId: log.user_id ?? "",
      adminName: log.user_id ? adminMap.get(log.user_id) ?? "System" : "System",
      action: log.action,
      resource: log.entity_type ?? "",
      resourceId: log.entity_id ?? "",
      customerId: log.company_id,
      companyName: companyMap.get(log.company_id) ?? "",
      details: log.changes,
      ipAddress: log.ip_address ?? "",
      timestamp: log.created_at.toISOString(),
    }));

    return res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    logger.error("Audit logs read error", { err });
    return res.status(500).json({ success: false, error: "Failed to read audit logs" });
  }
});

export default router;
