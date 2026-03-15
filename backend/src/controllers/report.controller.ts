import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d: Date) { const r = new Date(d); r.setHours(23,59,59,999); return r; }
function subDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()-n); return r; }

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDateRange(dateRange: string): { start: Date; end: Date } {
  const now = new Date();
  switch (dateRange) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "week":
    default:
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
  }
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad2(m)}m`;
}

export async function getReports(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { dateRange = "week", employeeId } = req.query as Record<string, string>;
    const { start, end } = getDateRange(dateRange);

    const companyId = req.admin?.companyId;
    if (!companyId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const companyFilter = { companyId };
    const empFilter = employeeId ? { employeeId } : {};

    // ── Fetch core data ────────────────────────────────────────────────────

    const [activities, screenshots, alerts, employees, browserHistory] = await Promise.all([
      prisma.activity.findMany({
        where: { ...empFilter, ...companyFilter, timestamp: { gte: start, lte: end } },
        select: {
          employeeId: true,
          appName: true,
          isIdle: true,
          isProductive: true,
          timestamp: true,
          employee: { select: { name: true, department: true } },
        },
      }),
      prisma.screenshot.count({ where: { ...empFilter, ...companyFilter, timestamp: { gte: start, lte: end } } }),
      prisma.alert.count({ where: { ...empFilter, ...companyFilter, timestamp: { gte: start, lte: end } } }),
      prisma.employee.findMany({
        where: { isActive: true, ...companyFilter },
        select: { id: true, name: true, department: true },
      }),
      prisma.browserHistory.findMany({
        where: { ...empFilter, visitedAt: { gte: start, lte: end }, employee: { ...companyFilter } },
        orderBy: { visitedAt: "desc" },
        take: 200,
        include: { employee: { select: { name: true } } },
      }),
    ]);

    // ── Summary ───────────────────────────────────────────────────────────

    // Each activity ≈ 10-minute heartbeat slot
    const MINS_PER_SLOT = 10;
    const totalSlots = activities.length;
    const productiveSlots = activities.filter((a) => a.isProductive && !a.isIdle).length;
    const idleSlots = activities.filter((a) => a.isIdle).length;

    const totalMinutes = totalSlots * MINS_PER_SLOT;
    const productiveMinutes = productiveSlots * MINS_PER_SLOT;
    const idleMinutes = idleSlots * MINS_PER_SLOT;

    const summary = {
      totalHours: formatHours(totalMinutes),
      productive: formatHours(productiveMinutes),
      idleTime: formatHours(idleMinutes),
      screenshots: String(screenshots),
      alerts: String(alerts),
    };

    // ── Daily Breakdown ────────────────────────────────────────────────────

    const [allDayScreenshots, allDayAlerts] = await Promise.all([
      prisma.screenshot.findMany({
        where: { ...empFilter, ...companyFilter, timestamp: { gte: start, lte: end } }, // ✅ companyFilter added
        select: { timestamp: true },
      }),
      prisma.alert.findMany({
        where: { ...empFilter, ...companyFilter, timestamp: { gte: start, lte: end } }, // ✅ companyFilter added
        select: { timestamp: true },
      }),
    ]);

    const dayCount = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    const dailyBreakdown = [];

    for (let i = 0; i < dayCount; i++) {
      const day = new Date(start.getTime() + i * 86400000);
      const dayStr = day.toISOString().split("T")[0];
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayActs = activities.filter(
        (a) => a.timestamp >= dayStart && a.timestamp <= dayEnd
      );
      const dayProd = dayActs.filter((a) => a.isProductive && !a.isIdle).length;
      const dayIdle = dayActs.filter((a) => a.isIdle).length;
      const dayScreenshots = allDayScreenshots.filter(
        (s) => s.timestamp >= dayStart && s.timestamp <= dayEnd
      ).length;
      const dayAlerts = allDayAlerts.filter(
        (a) => a.timestamp >= dayStart && a.timestamp <= dayEnd
      ).length;

      dailyBreakdown.push({
        date: dayStr,
        hours: Math.round((dayActs.length * MINS_PER_SLOT) / 60 * 10) / 10,
        productive: Math.round((dayProd / (dayActs.length || 1)) * 100),
        idle: Math.round((dayIdle / (dayActs.length || 1)) * 100),
        screenshots: dayScreenshots,
        alerts: dayAlerts,
      });
    }

    // ── Weekly Productivity (by day name) ─────────────────────────────────

    const dayBuckets: Record<string, { productive: number; idle: number }> = {};
    for (const a of activities) {
      const day = DAY_NAMES[a.timestamp.getDay()];
      if (!dayBuckets[day]) dayBuckets[day] = { productive: 0, idle: 0 };
      if (a.isProductive && !a.isIdle) dayBuckets[day].productive++;
      if (a.isIdle) dayBuckets[day].idle++;
    }

    const weeklyProductivity = DAY_NAMES.map((d) => ({
      day: d,
      productive: dayBuckets[d]?.productive || 0,
      idle: dayBuckets[d]?.idle || 0,
    }));

    // ── Top Apps ──────────────────────────────────────────────────────────

    const appSlots: Record<string, number> = {};
    for (const a of activities) {
      if (!a.isIdle) appSlots[a.appName] = (appSlots[a.appName] || 0) + 1;
    }

    const topApps = Object.entries(appSlots)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, slots]) => ({
        name,
        hours: Math.round((slots * MINS_PER_SLOT) / 60 * 10) / 10,
      }));

    // ── Employee Comparison ───────────────────────────────────────────────

    const empMap: Record<string, { name: string; total: number; prod: number }> = {};
    for (const a of activities) {
      if (!empMap[a.employeeId]) {
        empMap[a.employeeId] = { name: a.employee.name, total: 0, prod: 0 };
      }
      empMap[a.employeeId].total++;
      if (a.isProductive && !a.isIdle) empMap[a.employeeId].prod++;
    }

    const employeeComparison = Object.values(empMap)
      .map((e) => ({
        name: e.name,
        productivity: e.total > 0 ? Math.round((e.prod / e.total) * 100) : 0,
      }))
      .sort((a, b) => b.productivity - a.productivity)
      .slice(0, 10);

    // ── Department Comparison (radar) ─────────────────────────────────────

    const deptMap: Record<string, { total: number; prod: number }> = {};
    for (const a of activities) {
      const dept = a.employee.department;
      if (!deptMap[dept]) deptMap[dept] = { total: 0, prod: 0 };
      deptMap[dept].total++;
      if (a.isProductive && !a.isIdle) deptMap[dept].prod++;
    }

    const deptComparison = Object.entries(deptMap).map(([dept, v]) => ({
      subject: dept,
      A: v.total > 0 ? Math.round((v.prod / v.total) * 100) : 0,
      fullMark: 100,
    }));

    const browserHistoryData = browserHistory.map((b) => ({
      id: b.id,
      employeeId: b.employeeId,
      employeeName: b.employee.name,
      browser: b.browser,
      url: b.url,
      title: b.title,
      visitedAt: b.visitedAt.toISOString(),
      duration: b.duration || 0,
      isBlocked: b.isBlocked,
    }));

    res.json({
      summary,
      weeklyProductivity,
      topApps,
      dailyBreakdown,
      employeeComparison,
      deptComparison,
      browserHistory: browserHistoryData,
    });
  } catch (err) {
    next(err);
  }
}
