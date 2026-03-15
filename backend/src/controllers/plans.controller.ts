import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

// ─── GET /api/plans ───────────────────────────────────────────────────────────

export async function getPlans(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        priceMonthly: true,
        priceYearly: true,
        maxSeats: true,
        screenshotsEnabled: true,
        browserHistoryEnabled: true,
        usbMonitoringEnabled: true,
        alertsEnabled: true,
        keylogEnabled: true,
        fileActivityEnabled: true,
        printLogsEnabled: true,
        advancedReports: true,
        shutdownEnabled: true,
        livescreenEnabled: true,
        lockEnabled: true,
      },
      orderBy: { priceMonthly: "asc" },
    });

    res.json(plans);
  } catch (err) {
    next(err);
  }
}
