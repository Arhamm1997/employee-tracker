import { v2 as cloudinary } from "cloudinary";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

export async function cleanupOldData(): Promise<{
  activitiesDeleted: number;
  screenshotsDeleted: number;
  alertsDeleted: number;
}> {
  const settings = await prisma.settings.findFirst();

  if (!settings) {
    logger.warn("No settings found, skipping cleanup");
    return { activitiesDeleted: 0, screenshotsDeleted: 0, alertsDeleted: 0 };
  }

  const activityCutoff = new Date(
    Date.now() - settings.activityRetentionDays * 24 * 60 * 60 * 1000
  );
  const screenshotCutoff = new Date(
    Date.now() - settings.screenshotRetentionDays * 24 * 60 * 60 * 1000
  );
  const alertCutoff = new Date(
    Date.now() - settings.alertRetentionDays * 24 * 60 * 60 * 1000
  );

  // Delete old activities
  const { count: activitiesDeleted } = await prisma.activity.deleteMany({
    where: { timestamp: { lt: activityCutoff } },
  });

  // Delete old screenshots — also remove from Cloudinary
  const oldScreenshots = await prisma.screenshot.findMany({
    where: { timestamp: { lt: screenshotCutoff } },
    select: { id: true, cloudinaryId: true },
  });

  let screenshotsDeleted = 0;
  if (oldScreenshots.length > 0) {
    const cloudinaryIds = oldScreenshots
      .map((s) => s.cloudinaryId)
      .filter((id): id is string => !!id);

    // Delete from Cloudinary in batches of 100
    for (let i = 0; i < cloudinaryIds.length; i += 100) {
      const batch = cloudinaryIds.slice(i, i + 100);
      try {
        await cloudinary.api.delete_resources(batch);
      } catch (err) {
        logger.warn("Cloudinary batch delete error:", err);
      }
    }

    const result = await prisma.screenshot.deleteMany({
      where: { timestamp: { lt: screenshotCutoff } },
    });
    screenshotsDeleted = result.count;
  }

  // Delete old alerts
  const { count: alertsDeleted } = await prisma.alert.deleteMany({
    where: { timestamp: { lt: alertCutoff } },
  });

  // Delete old browser history (use activity retention)
  await prisma.browserHistory.deleteMany({
    where: { visitedAt: { lt: activityCutoff } },
  });

  // Delete old USB events
  await prisma.usbEvent.deleteMany({
    where: { timestamp: { lt: activityCutoff } },
  });

  // Delete old clipboard logs
  await prisma.clipboardLog.deleteMany({
    where: { timestamp: { lt: activityCutoff } },
  });

  logger.info(
    `Cleanup: deleted ${activitiesDeleted} activities, ${screenshotsDeleted} screenshots, ${alertsDeleted} alerts`
  );

  return { activitiesDeleted, screenshotsDeleted, alertsDeleted };
}
