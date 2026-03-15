import cron from "node-cron";
import { cleanupOldData } from "../services/cleanup.service";
import { sendDailySummaryEmail } from "../services/email.service";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function endOfDay(d: Date) {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}

async function sendDailySummary(): Promise<void> {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const settings = await prisma.settings.findFirst({
      select: { alertEmails: true },
    });

    if (!settings || settings.alertEmails.length === 0) return;

    const [allEmployees, alertsToday, todayActivities] = await Promise.all([
      prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, lastSeenAt: true, name: true },
      }),
      prisma.alert.count({ where: { timestamp: { gte: todayStart, lte: todayEnd } } }),
      prisma.activity.findMany({
        where: { timestamp: { gte: todayStart, lte: todayEnd } },
        select: { employeeId: true, isIdle: true, isProductive: true },
      }),
    ]);

    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    let online = 0, idle = 0, offline = 0;

    for (const emp of allEmployees) {
      if (!emp.lastSeenAt || emp.lastSeenAt < tenMinsAgo) offline++;
      else if (emp.lastSeenAt < twoMinsAgo) idle++;
      else online++;
    }

    const productive = todayActivities.filter((a) => a.isProductive && !a.isIdle).length;
    const avgProductivity =
      todayActivities.length > 0 ? Math.round((productive / todayActivities.length) * 100) : 0;

    // Find top performer
    const empProductivity: Record<string, { name: string; prod: number; total: number }> = {};
    for (const emp of allEmployees) {
      empProductivity[emp.id] = { name: emp.name, prod: 0, total: 0 };
    }
    for (const act of todayActivities) {
      if (empProductivity[act.employeeId]) {
        empProductivity[act.employeeId].total++;
        if (act.isProductive && !act.isIdle) empProductivity[act.employeeId].prod++;
      }
    }

    const topEmployee = Object.values(empProductivity)
      .filter((e) => e.total > 0)
      .map((e) => ({ name: e.name, productivity: Math.round((e.prod / e.total) * 100) }))
      .sort((a, b) => b.productivity - a.productivity)[0];

    await sendDailySummaryEmail(settings.alertEmails, {
      totalEmployees: allEmployees.length,
      online,
      idle,
      offline,
      avgProductivity,
      alertsToday,
      topEmployee,
    });

    logger.info("Daily summary email sent");
  } catch (err) {
    logger.error("Daily summary job error:", err);
  }
}

export function startDataCleanupJob(): void {
  // Data cleanup: every day at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    logger.info("Starting scheduled data cleanup...");
    try {
      const result = await cleanupOldData();
      logger.info("Data cleanup completed:", result);
    } catch (err) {
      logger.error("Data cleanup job error:", err);
    }
  });

  // Daily summary email: every day at 7:00 PM
  cron.schedule("0 19 * * *", sendDailySummary);

  logger.info("Data cleanup job started (daily at 2:00 AM)");
  logger.info("Daily summary email job started (daily at 7:00 PM)");
}
