import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function subDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

const STATUS_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEmployeeStatus(lastSeenAt: Date | null, isIdle = false): "online" | "idle" | "offline" {
  if (!lastSeenAt) return "offline";
  const twoMins = new Date(Date.now() - 2 * 60 * 1000);
  if (lastSeenAt < twoMins) return "offline";
  return isIdle ? "idle" : "online";
}

export async function getDashboard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const companyId = req.admin?.companyId;
    const cFilter = companyId ? { companyId } : {};

    const settings = await prisma.settings.findFirst({
      where: cFilter,
      select: { workStartTime: true, workEndTime: true },
    });
    const workStart = settings?.workStartTime || "09:00";
    const workEnd = settings?.workEndTime || "18:00";

    // ── Stats ──────────────────────────────────────────────────────────────

    const [allEmployees, alertsToday, todayActivities] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true, ...cFilter },
        select: {
          id: true,
          name: true,
          email: true,
          employeeCode: true,
          department: true,
          avatar: true,
          lastSeenAt: true,
          activities: {
            orderBy: { timestamp: "desc" },
            take: 1,
            select: { isIdle: true, appName: true },
          },
        },
      }),
      prisma.alert.count({ where: { timestamp: { gte: todayStart, lte: todayEnd }, ...cFilter } }),
      prisma.activity.findMany({
        where: { timestamp: { gte: todayStart, lte: todayEnd }, ...cFilter },
        select: { employeeId: true, appName: true, isIdle: true, isProductive: true, isAfterHours: true, timestamp: true },
      }),
    ]);

    let online = 0, idle = 0, offline = 0;
    const afterHoursSet = new Set<string>();

    for (const emp of allEmployees) {
      const latestIsIdle = emp.activities[0]?.isIdle ?? false;
      const status = getEmployeeStatus(emp.lastSeenAt, latestIsIdle);
      if (status === "online") online++;
      else if (status === "idle") idle++;
      else offline++;
    }

    for (const act of todayActivities) {
      if (act.isAfterHours) afterHoursSet.add(act.employeeId);
    }

    const productiveCount = todayActivities.filter((a) => a.isProductive && !a.isIdle).length;
    const avgProductivity =
      todayActivities.length > 0
        ? Math.round((productiveCount / todayActivities.length) * 100)
        : 0;

    // ── Weekly Productivity (last 7 days) ──────────────────────────────────

    const weekStart = startOfDay(subDays(now, 6));
    const weekActivities = await prisma.activity.findMany({
      where: { timestamp: { gte: weekStart, lte: todayEnd }, ...cFilter },
      select: { timestamp: true, isIdle: true, isProductive: true },
    });

    const weeklyProductivity = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayActs = weekActivities.filter(
        (a) => a.timestamp >= dayStart && a.timestamp <= dayEnd
      );
      weeklyProductivity.push({
        day: DAY_NAMES[day.getDay()],
        productive: dayActs.filter((a) => a.isProductive && !a.isIdle).length,
        idle: dayActs.filter((a) => a.isIdle).length,
      });
    }

    // ── Top 5 Apps (today) ─────────────────────────────────────────────────

    const appUsage: Record<string, number> = {};
    for (const act of todayActivities) {
      if (!act.isIdle) appUsage[act.appName] = (appUsage[act.appName] || 0) + 1;
    }
    const topApps = Object.entries(appUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, fill: STATUS_COLORS[i % STATUS_COLORS.length] }));

    // ── Hourly Activity (today) ────────────────────────────────────────────

    const hourlyActivity = [];
    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(todayStart.getTime() + h * 3600000);
      const hourEnd = new Date(hourStart.getTime() + 3600000);
      const acts = todayActivities.filter(
        (a) => a.timestamp >= hourStart && a.timestamp < hourEnd
      );
      hourlyActivity.push({
        hour: `${String(h).padStart(2, "0")}:00`,
        active: acts.filter((a) => !a.isIdle).length,
        idle: acts.filter((a) => a.isIdle).length,
      });
    }

    // ── Department Comparison ──────────────────────────────────────────────

    const departments = ["Engineering", "Design", "Sales", "HR", "Marketing"];
    const empIdToDept: Record<string, string> = {};
    for (const e of allEmployees) empIdToDept[e.id] = e.department;

    const deptBuckets: Record<string, { total: number; prod: number }> = {};
    for (const dept of departments) deptBuckets[dept] = { total: 0, prod: 0 };

    for (const act of todayActivities) {
      const dept = empIdToDept[act.employeeId];
      if (dept && deptBuckets[dept]) {
        deptBuckets[dept].total++;
        if (act.isProductive && !act.isIdle) deptBuckets[dept].prod++;
      }
    }

    const deptComparison = departments.map((dept) => {
      const b = deptBuckets[dept];
      return { department: dept, productivity: b.total > 0 ? Math.round((b.prod / b.total) * 100) : 0 };
    });

    // ── After-Hours Employees ──────────────────────────────────────────────

    const afterHoursEmployees = allEmployees
      .filter((e) => afterHoursSet.has(e.id))
      .map((e) => {
        const lastAct = todayActivities
          .filter((a) => a.employeeId === e.id && a.isAfterHours)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

        const t = lastAct?.timestamp || new Date();
        const afterHoursTime = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;

        const latestIsIdle = e.activities[0]?.isIdle ?? false;
        const status = getEmployeeStatus(e.lastSeenAt, latestIsIdle);

        return {
          id: e.id,
          name: e.name,
          email: e.email,
          code: e.employeeCode,
          department: e.department,
          avatar: e.avatar || "",
          status,
          currentApp: e.activities[0]?.appName || "",
          lastSeen: e.lastSeenAt?.toISOString() ?? null,
          hoursToday: 0,
          productivityPercent: 0,
          screenshotCount: 0,
          afterHoursTime,
        };
      })
      .slice(0, 10);

    // ── Recent Employees (latest activity) ────────────────────────────────

    const recentEmployees = [...allEmployees]
      .filter((e) => e.lastSeenAt)
      .sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0))
      .slice(0, 16)
      .map((e) => {
        const latestIsIdle = e.activities[0]?.isIdle ?? false;
        const status = getEmployeeStatus(e.lastSeenAt, latestIsIdle);

        const empActs = todayActivities.filter((a) => a.employeeId === e.id);
        const empProd = empActs.filter((a) => a.isProductive && !a.isIdle).length;
        const productivityPercent =
          empActs.length > 0 ? Math.round((empProd / empActs.length) * 100) : 0;

        return {
          id: e.id,
          name: e.name,
          email: e.email,
          code: e.employeeCode,
          department: e.department,
          avatar: e.avatar || "",
          status,
          currentApp: e.activities[0]?.appName || "Unknown",
          lastSeen: e.lastSeenAt?.toISOString() ?? null,
          hoursToday: 0,
          productivityPercent,
          screenshotCount: 0,
        };
      });

    res.json({
      stats: {
        totalEmployees: allEmployees.length,
        online,
        idle,
        offline,
        avgProductivity,
        alertsToday,
      },
      weeklyProductivity,
      topApps,
      hourlyActivity,
      deptComparison,
      afterHoursEmployees,
      recentEmployees,
    });
  } catch (err) {
    next(err);
  }
}

// Minimal stats-only endpoint (for agent spec compatibility)
export async function getDashboardStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const companyId = req.admin?.companyId;
    const cFilter = companyId ? { companyId } : {};

    const [allEmployees, alertsToday, todayActivities] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true, ...cFilter },
        select: {
          id: true,
          lastSeenAt: true,
          activities: {
            orderBy: { timestamp: "desc" },
            take: 1,
            select: { isIdle: true },
          },
        },
      }),
      prisma.alert.count({ where: { timestamp: { gte: todayStart, lte: todayEnd }, ...cFilter } }),
      prisma.activity.findMany({
        where: { timestamp: { gte: todayStart, lte: todayEnd }, isAfterHours: true, ...cFilter },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
    ]);

    let online = 0, idle = 0, offline = 0;
    for (const emp of allEmployees) {
      const latestIsIdle = emp.activities[0]?.isIdle ?? false;
      const status = getEmployeeStatus(emp.lastSeenAt, latestIsIdle);
      if (status === "online") online++;
      else if (status === "idle") idle++;
      else offline++;
    }

    const [productiveCount, totalCount] = await Promise.all([
      prisma.activity.count({ where: { timestamp: { gte: todayStart, lte: todayEnd }, isProductive: true, isIdle: false, ...cFilter } }),
      prisma.activity.count({ where: { timestamp: { gte: todayStart, lte: todayEnd }, ...cFilter } }),
    ]);

    const avgProductivity = totalCount > 0 ? Math.round((productiveCount / totalCount) * 100) : 0;

    res.json({
      totalEmployees: allEmployees.length,
      online,
      idle,
      offline,
      avgProductivity,
      alertsToday,
      afterHoursCount: todayActivities.length,
    });
  } catch (err) {
    next(err);
  }
}
