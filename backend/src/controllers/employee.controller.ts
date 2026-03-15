import { Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ─── Avatar upload multer ─────────────────────────────────────────────────────
const AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");
export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
      cb(null, AVATARS_DIR);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function endOfDay(d: Date) {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}
function subDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() - n); return r;
}

function getStatus(lastSeenAt: Date | null, isIdle = false): "online" | "idle" | "offline" {
  if (!lastSeenAt) return "offline";
  const twoMins = new Date(Date.now() - 2 * 60 * 1000);
  if (lastSeenAt < twoMins) return "offline";
  return isIdle ? "idle" : "online";
}

function computeHoursToday(acts: { timestamp: Date; isIdle: boolean }[]): number {
  const nonIdle = acts.filter((a) => !a.isIdle).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (nonIdle.length < 2) return 0;
  const diff = nonIdle[nonIdle.length - 1].timestamp.getTime() - nonIdle[0].timestamp.getTime();
  return Math.round((diff / 3600000) * 10) / 10;
}

async function buildEmployeeResponse(
  emp: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    department: string;
    avatar: string | null;
    lastSeenAt: Date | null;
    isActive: boolean;
  },
  todayActivities: { timestamp: Date; isIdle: boolean; isProductive: boolean; appName: string }[],
  screenshotCount: number
) {
  const latestAct = todayActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  const status = getStatus(emp.lastSeenAt, latestAct?.isIdle ?? false);
  const productive = todayActivities.filter((a) => a.isProductive && !a.isIdle).length;
  const productivityPercent =
    todayActivities.length > 0 ? Math.round((productive / todayActivities.length) * 100) : 0;

  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    code: emp.employeeCode,
    department: emp.department,
    avatar: emp.avatar || "",
    status,
    currentApp: latestAct?.appName || "Unknown",
    lastSeen: emp.lastSeenAt?.toISOString() ?? null,
    hoursToday: computeHoursToday(todayActivities),
    productivityPercent,
    screenshotCount,
  };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export async function getEmployees(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, department, status, page = "1", limit = "100" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (department) where.department = department;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    const empIds = employees.map((e) => e.id);

    const [allTodayActs, allSsCounts] = await Promise.all([
      prisma.activity.findMany({
        where: { employeeId: { in: empIds }, timestamp: { gte: todayStart, lte: todayEnd } },
        select: { employeeId: true, timestamp: true, isIdle: true, isProductive: true, appName: true },
      }),
      prisma.screenshot.groupBy({
        by: ["employeeId"],
        where: { employeeId: { in: empIds }, timestamp: { gte: todayStart, lte: todayEnd } },
        _count: { id: true },
      }),
    ]);

    const actsByEmp: Record<string, typeof allTodayActs> = {};
    for (const act of allTodayActs) {
      if (!actsByEmp[act.employeeId]) actsByEmp[act.employeeId] = [];
      actsByEmp[act.employeeId].push(act);
    }
    const ssCountByEmp: Record<string, number> = {};
    for (const row of allSsCounts) ssCountByEmp[row.employeeId] = row._count.id;

    const results = await Promise.all(
      employees.map((emp) =>
        buildEmployeeResponse(emp, actsByEmp[emp.id] || [], ssCountByEmp[emp.id] || 0)
      )
    );

    const filtered = status ? results.filter((e) => e.status === status) : results;
    res.json(filtered);
  } catch (err) {
    next(err);
  }
}

export async function getEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [todayActs, ssCount] = await Promise.all([
      prisma.activity.findMany({
        where: { employeeId: emp.id, timestamp: { gte: todayStart, lte: todayEnd } },
        select: { timestamp: true, isIdle: true, isProductive: true, appName: true },
      }),
      prisma.screenshot.count({
        where: { employeeId: emp.id, timestamp: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    res.json(await buildEmployeeResponse(emp, todayActs, ssCount));
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeDetail(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [todayActs, ssCount, screenshots, browserHistory, alerts, usbEvents] = await Promise.all([
      prisma.activity.findMany({
        where: { employeeId: emp.id, timestamp: { gte: todayStart, lte: todayEnd } },
        orderBy: { timestamp: "asc" },
      }),
      prisma.screenshot.count({
        where: { employeeId: emp.id, timestamp: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.screenshot.findMany({
        where: { employeeId: emp.id },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.browserHistory.findMany({
        where: { employeeId: emp.id },
        orderBy: { visitedAt: "desc" },
        take: 50,
      }),
      prisma.alert.findMany({
        where: { employeeId: emp.id },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.usbEvent.findMany({
        where: { employeeId: emp.id },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
    ]);

    const employee = await buildEmployeeResponse(emp, todayActs, ssCount);

    const appUsage: Record<string, number> = {};
    for (const a of todayActs) {
      if (!a.isIdle) appUsage[a.appName] = (appUsage[a.appName] || 0) + 1;
    }
    const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
    const topApps = Object.entries(appUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

    const prodCount = todayActs.filter((a) => a.isProductive && !a.isIdle).length;
    const nonProdCount = todayActs.filter((a) => !a.isProductive && !a.isIdle).length;
    const neutralCount = todayActs.filter((a) => a.isIdle).length;
    const total = todayActs.length || 1;
    const productivity = {
      productive: Math.round((prodCount / total) * 100),
      nonProductive: Math.round((nonProdCount / total) * 100),
      neutral: Math.round((neutralCount / total) * 100),
    };

    const hourlyActivity = Array.from({ length: 24 }, (_, h) => {
      const hourStart = new Date(todayStart.getTime() + h * 3600000);
      const hourEnd = new Date(hourStart.getTime() + 3600000);
      const acts = todayActs.filter((a) => a.timestamp >= hourStart && a.timestamp < hourEnd);
      return {
        hour: `${String(h).padStart(2, "0")}:00`,
        productive: acts.filter((a) => a.isProductive && !a.isIdle).length,
        idle: acts.filter((a) => a.isIdle).length,
      };
    });

    const timeline = buildTimeline(todayActs);
    const heatmap = await buildHeatmap(emp.id, now);

    res.json({
      employee,
      screenshots: screenshots.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: emp.name,
        avatar: emp.avatar || "",
        imageUrl: s.imageUrl,
        timestamp: s.timestamp.toISOString(),
        app: s.appName,
        windowTitle: s.windowTitle,
        department: emp.department,
      })),
      browserHistory: browserHistory.map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title,
        browser: b.browser,
        time: b.visitedAt.toISOString(),
        duration: b.duration ? `${Math.floor(b.duration / 60)}m ${b.duration % 60}s` : "—",
        blocked: b.isBlocked,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        employeeId: a.employeeId,
        employeeName: emp.name,
        message: a.message,
        timestamp: a.timestamp.toISOString(),
        read: a.isRead,
      })),
      usbEvents: usbEvents.map((u) => ({
        id: u.id,
        device: u.deviceName,
        type: u.action as "connected" | "disconnected",
        time: u.timestamp.toISOString(),
      })),
      topApps,
      productivity,
      hourlyActivity,
      timeline,
      heatmap,
    });
  } catch (err) {
    next(err);
  }
}

function buildTimeline(
  acts: { timestamp: Date; isIdle: boolean; isProductive: boolean; isAfterHours: boolean }[]
) {
  if (acts.length === 0) return [];

  type BlockType = "productive" | "idle" | "offline" | "blocked";
  const blocks: { start: number; end: number; type: BlockType }[] = [];

  let currentType: BlockType = "offline";
  let blockStart = 0;

  const sorted = [...acts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const dayStart = startOfDay(sorted[0].timestamp);

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    const minuteOfDay = Math.floor((act.timestamp.getTime() - dayStart.getTime()) / 60000);

    let type: BlockType;
    if (act.isIdle) type = "idle";
    else if (act.isAfterHours) type = "blocked";
    else if (act.isProductive) type = "productive";
    else type = "idle";

    if (blocks.length === 0) {
      blockStart = minuteOfDay;
      currentType = type;
    } else if (type !== currentType || minuteOfDay - (blocks[blocks.length - 1]?.end || 0) > 30) {
      if (currentType !== "offline") {
        blocks.push({ start: blockStart, end: minuteOfDay, type: currentType });
      }
      blockStart = minuteOfDay;
      currentType = type;
    }
  }

  if (sorted.length > 0 && currentType !== "offline") {
    const lastMinute = Math.floor(
      (sorted[sorted.length - 1].timestamp.getTime() - dayStart.getTime()) / 60000
    );
    blocks.push({ start: blockStart, end: lastMinute + 15, type: currentType });
  }

  return blocks;
}

async function buildHeatmap(employeeId: string, now: Date) {
  const start = subDays(now, 182);
  const activities = await prisma.activity.findMany({
    where: { employeeId, timestamp: { gte: start }, isIdle: false },
    select: { timestamp: true },
  });

  const countByDate: Record<string, number> = {};
  for (const a of activities) {
    const dateStr = a.timestamp.toISOString().split("T")[0];
    countByDate[dateStr] = (countByDate[dateStr] || 0) + 1;
  }

  return Object.entries(countByDate).map(([date, count]) => ({ date, count }));
}

export async function getEmployeeActivities(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, limit = "100" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
    }

    const activities = await prisma.activity.findMany({
      where,
      include: { employee: { select: { name: true, avatar: true } } },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });

    res.json(
      activities.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        avatar: a.employee.avatar || "",
        app: a.appName,
        windowTitle: a.windowTitle,
        time: a.timestamp.toISOString(),
        type: a.isIdle ? "idle" : a.isProductive ? "productive" : "neutral",
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeScreenshots(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, limit = "20" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
    }

    const screenshots = await prisma.screenshot.findMany({
      where,
      include: { employee: { select: { name: true, avatar: true, department: true } } },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });

    res.json(
      screenshots.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: s.employee.name,
        avatar: s.employee.avatar || "",
        imageUrl: s.imageUrl,
        timestamp: s.timestamp.toISOString(),
        app: s.appName,
        windowTitle: s.windowTitle,
        department: s.employee.department,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeBrowserHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, browser } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.visitedAt = { gte: startOfDay(d), lte: endOfDay(d) };
    }
    if (browser) where.browser = browser;

    const history = await prisma.browserHistory.findMany({
      where,
      orderBy: { visitedAt: "desc" },
      take: 100,
    });

    res.json(
      history.map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title,
        browser: b.browser,
        time: b.visitedAt.toISOString(),
        duration: b.duration ? `${Math.floor(b.duration / 60)}m ${b.duration % 60}s` : "—",
        blocked: b.isBlocked,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeAlerts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { limit = "20" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true, name: true },
    });
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const alerts = await prisma.alert.findMany({
      where: { employeeId: employee.id },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });

    res.json(
      alerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        employeeId: a.employeeId,
        employeeName: employee.name,
        message: a.message,
        timestamp: a.timestamp.toISOString(),
        read: a.isRead,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeUsbEvents(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const events = await prisma.usbEvent.findMany({
      where: { employeeId: emp.id },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    res.json(
      events.map((u) => ({
        id: u.id,
        device: u.deviceName,
        type: u.action as "connected" | "disconnected",
        time: u.timestamp.toISOString(),
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeTimeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date } = req.query as Record<string, string>;
    const d = date ? new Date(date) : new Date();
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const acts = await prisma.activity.findMany({
      where: { employeeId: emp.id, timestamp: { gte: startOfDay(d), lte: endOfDay(d) } },
      orderBy: { timestamp: "asc" },
    });

    res.json(buildTimeline(acts));
  } catch (err) {
    next(err);
  }
}

export async function disableEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }
    await prisma.employee.update({ where: { id: emp.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function enableEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }
    await prisma.employee.update({ where: { id: emp.id }, data: { isActive: true } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function createEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, department } = req.body;
    const companyId = req.admin?.companyId ?? null;

    if (!name || !email || !department) {
      res.status(400).json({ message: "Name, email, and department are required" });
      return;
    }

    // Check for duplicate email within this company
    const existing = await prisma.employee.findFirst({
      where: { email, ...(companyId ? { companyId } : {}) },
    });
    if (existing) {
      res.status(409).json({ message: "An employee with this email already exists" });
      return;
    }

    // Seat limit check against subscription plan
    if (companyId) {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      });

      if (subscription?.plan && subscription.plan.maxSeats !== -1) {
        const count = await prisma.employee.count({ where: { companyId, isActive: true } });
        if (count >= subscription.plan.maxSeats) {
          res.status(400).json({
            message: `Seat limit reach ho gayi (${subscription.plan.maxSeats}), upgrade karein`,
            code: "EMPLOYEE_SEAT_LIMIT",
          });
          return;
        }
      }
    }

    // Auto-generate employee code scoped to company
    const lastEmployee = await prisma.employee.findFirst({
      where: { employeeCode: { startsWith: "EMP" }, ...(companyId ? { companyId } : {}) },
      orderBy: { employeeCode: "desc" },
    });
    let nextNum = 1;
    if (lastEmployee) {
      const num = parseInt(lastEmployee.employeeCode.replace("EMP", ""), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    const employeeCode = `EMP${String(nextNum).padStart(3, "0")}`;
    const agentKey = randomUUID();

    // ✅ FIX: Cast to `any` to allow agentKey until schema migration is run.
    // After running: npx prisma migrate dev --name add_agent_key_to_employee
    // you can remove the cast and use the typed version directly.
    const employee = await (prisma.employee.create as any)({
      data: {
        employeeCode,
        name,
        email,
        department,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        agentKey,
        agentToken: agentKey, // initial key; will be rotated into JWT after agent registration
        isActive: true,
        companyId,
      },
    });

    res.status(201).json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      code: employee.employeeCode,
      agentKey: employee.agentKey,
      agentToken: employee.agentToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployee(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }
    await prisma.employee.delete({ where: { id: emp.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: "Image file is required" });
      return;
    }

    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    if (emp.avatar && emp.avatar.startsWith("/uploads/")) {
      const oldPath = path.join(process.cwd(), emp.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await prisma.employee.update({ where: { id: emp.id }, data: { avatar: avatarUrl } });

    res.json({ success: true, avatarUrl });
  } catch (err) {
    next(err);
  }
}

export async function getConnectionHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { limit = "50" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const events = await prisma.connectionEvent.findMany({
      where: { employeeId: emp.id },
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });
    res.json(events.map(e => ({ id: e.id, event: e.event, timestamp: e.timestamp.toISOString() })));
  } catch (err) {
    next(err);
  }
}

export async function sendRemoteCommand(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { command } = req.body as { command: "lock" | "shutdown" | "clear" | "start_live" | "stop_live" };
    if (!["lock", "shutdown", "clear", "start_live", "stop_live"].includes(command)) {
      res.status(400).json({ message: "Invalid command. Must be lock, shutdown, clear, start_live, or stop_live." });
      return;
    }

    const companyId = req.admin?.companyId;
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: { pendingCommand: command === "clear" ? null : command },
    });

    res.json({ success: true, command });
  } catch (err) {
    next(err);
  }
}

export async function resetAllData(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const companyFilter = companyId ? { companyId } : {};
    const empFilter = companyId ? { employee: { companyId } } : {};

    await prisma.$transaction([
      prisma.activity.deleteMany({ where: companyFilter }),
      prisma.screenshot.deleteMany({ where: companyFilter }),
      prisma.alert.deleteMany({ where: companyFilter }),
      prisma.browserHistory.deleteMany({ where: empFilter }),
      prisma.usbEvent.deleteMany({ where: empFilter }),
      prisma.clipboardLog.deleteMany({ where: empFilter }),
      prisma.connectionEvent.deleteMany({ where: empFilter }),
      prisma.keylogEntry.deleteMany({ where: empFilter }),
      prisma.fileActivity.deleteMany({ where: empFilter }),
      prisma.printLog.deleteMany({ where: empFilter }),
    ]);

    await prisma.employee.updateMany({
      where: companyId ? { companyId } : {},
      data: { lastSeenAt: null },
    });

    res.json({ success: true, message: "All monitoring data has been reset." });
  } catch (err) {
    next(err);
  }
}

export async function getKeylogHistory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, limit = "100" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
    }
    const entries = await prisma.keylogEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });
    res.json(entries.map(e => ({
      id: e.id,
      appName: e.appName,
      keys: e.keys,
      timestamp: e.timestamp.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
}

export async function getFileActivity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, limit = "100" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
    }
    const activities = await prisma.fileActivity.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });
    res.json(activities.map(a => ({
      id: a.id,
      action: a.action,
      filePath: a.filePath,
      appName: a.appName,
      timestamp: a.timestamp.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
}

export async function getPrintLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { date, limit = "100" } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!emp) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (date) {
      const d = new Date(date);
      where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
    }
    const logs = await prisma.printLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Number(limit),
    });
    res.json(logs.map(l => ({
      id: l.id,
      printer: l.printer,
      document: l.document,
      pages: l.pages,
      appName: l.appName,
      timestamp: l.timestamp.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
}