import cron from "node-cron";
import prisma from "../lib/prisma";
import { broadcast } from "../lib/websocket";
import logger from "../lib/logger";

// Track which employees were last known online to avoid duplicate offline events
const onlineSet = new Set<string>();

export function startOfflineDetectionJob(): void {
  // Run every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const employees = await prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, lastSeenAt: true },
      });

      for (const emp of employees) {
        const isOffline = !emp.lastSeenAt || emp.lastSeenAt < tenMinutesAgo;

        if (isOffline && onlineSet.has(emp.id)) {
          // Was online, now offline
          onlineSet.delete(emp.id);
          broadcast("employee-offline", { employeeId: emp.id });
          logger.debug(`Employee ${emp.id} went offline`);
        } else if (!isOffline && !onlineSet.has(emp.id)) {
          onlineSet.add(emp.id);
        }
      }
    } catch (err) {
      logger.error("Offline detection job error:", err);
    }
  });

  logger.info("Offline detection job started (every 2 minutes)");
}
