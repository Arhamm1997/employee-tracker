import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import {
  authenticateCompany,
  requireEmailVerified,
  CompanyRequest,
} from "../middleware/companyAuth.middleware";
import {
  sendUpgradeConfirmationEmail,
  sendDowngradeConfirmationEmail,
} from "../services/email.service";
import logger from "../lib/logger";

const router = Router();

// All routes require company JWT + verified email
router.use(authenticateCompany, requireEmailVerified);

// ── Helper: days remaining ────────────────────────────────────────────────────
function daysRemaining(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── GET /api/subscription/usage ───────────────────────────────────────────────
router.get("/usage", async (req: CompanyRequest, res: Response) => {
  try {
    const companyId = req.company!.id;

    const [subscription, employeeCount] = await Promise.all([
      prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ]);

    if (!subscription) {
      res.status(404).json({ message: "No active subscription found" });
      return;
    }

    const { plan } = subscription;
    const days = daysRemaining(subscription.currentPeriodEnd);

    let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
    if (days <= 0) {
      status = "EXPIRED";
    } else if (days <= 7) {
      status = "EXPIRING_SOON";
    } else {
      status = "ACTIVE";
    }

    const maxSeats = plan.maxSeats === -1 ? 9999 : plan.maxSeats;
    const percentage =
      plan.maxSeats === -1 ? 0 : Math.round((employeeCount / maxSeats) * 100);

    const features: string[] = [];
    if (plan.screenshotsEnabled) features.push("Screenshots");
    if (plan.browserHistoryEnabled) features.push("Browser History");
    if (plan.usbMonitoringEnabled) features.push("USB Monitoring");
    if (plan.alertsEnabled) features.push("Alerts & Notifications");
    if (plan.keylogEnabled) features.push("Keylogger");
    if (plan.fileActivityEnabled) features.push("File Activity");
    if (plan.printLogsEnabled) features.push("Print Logs");
    if (plan.advancedReports) features.push("Advanced Reports");

    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        maxSeats: plan.maxSeats,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features,
      },
      usage: {
        seats: {
          used: employeeCount,
          total: plan.maxSeats,
          percentage,
        },
        billingCycle: subscription.billingCycle,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        daysRemaining: Math.max(0, days),
        status,
      },
    });
  } catch (err) {
    logger.error("subscription/usage error", { err });
    res.status(500).json({ message: "Failed to fetch subscription usage" });
  }
});

// ── POST /api/subscription/upgrade ───────────────────────────────────────────
const upgradeSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]),
});

router.post("/upgrade", async (req: CompanyRequest, res: Response) => {
  const parse = upgradeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: "Invalid input", errors: parse.error.flatten() });
    return;
  }

  const { planId, billingCycle } = parse.data;
  const companyId = req.company!.id;

  try {
    const [subscription, newPlan] = await Promise.all([
      prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);

    if (!subscription) {
      res.status(404).json({ message: "No subscription found" });
      return;
    }

    if (!newPlan || !newPlan.isActive) {
      res.status(404).json({ message: "Plan not found or inactive" });
      return;
    }

    // Must have more seats (or unlimited) than current
    const currentSeats = subscription.plan.maxSeats;
    const newSeats = newPlan.maxSeats;
    if (
      newSeats !== -1 &&
      currentSeats !== -1 &&
      newSeats <= currentSeats
    ) {
      res.status(400).json({
        message: `Upgrade requires a plan with more seats than current (${currentSeats} seats)`,
      });
      return;
    }

    // Calculate new period end
    const now = new Date();
    const currentEnd = subscription.currentPeriodEnd;
    const baseDate = currentEnd > now ? currentEnd : now;
    const newPeriodEnd = new Date(baseDate);
    if (billingCycle === "yearly") {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
    }

    const updated = await prisma.subscription.update({
      where: { companyId },
      data: {
        planId,
        billingCycle,
        status: "ACTIVE",
        currentPeriodEnd: newPeriodEnd,
      },
      include: { plan: true },
    });

    const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

    // Send upgrade confirmation email
    sendUpgradeConfirmationEmail(
      req.company!.email,
      req.company!.name,
      subscription.plan.name,
      newPlan.name,
      DASHBOARD_URL
    ).catch(() => {});

    res.json({
      message: "Plan upgraded successfully",
      subscription: {
        id: updated.id,
        planId: updated.planId,
        planName: updated.plan.name,
        billingCycle: updated.billingCycle,
        status: updated.status,
        currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
      },
    });
  } catch (err) {
    logger.error("subscription/upgrade error", { err });
    res.status(500).json({ message: "Failed to upgrade subscription" });
  }
});

// ── POST /api/subscription/downgrade ─────────────────────────────────────────
const downgradeSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]),
});

router.post("/downgrade", async (req: CompanyRequest, res: Response) => {
  const parse = downgradeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: "Invalid input", errors: parse.error.flatten() });
    return;
  }

  const { planId, billingCycle } = parse.data;
  const companyId = req.company!.id;

  try {
    const [subscription, newPlan, employeeCount] = await Promise.all([
      prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }),
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ]);

    if (!subscription) {
      res.status(404).json({ message: "No subscription found" });
      return;
    }

    if (!newPlan || !newPlan.isActive) {
      res.status(404).json({ message: "Plan not found or inactive" });
      return;
    }

    // Check employee count fits in new plan
    if (newPlan.maxSeats !== -1 && employeeCount > newPlan.maxSeats) {
      const excess = employeeCount - newPlan.maxSeats;
      res.status(400).json({
        message: `Downgrade nahi ho sakta. Pehle ${excess} employee${excess > 1 ? "s" : ""} remove karein (current: ${employeeCount}, new plan limit: ${newPlan.maxSeats})`,
      });
      return;
    }

    const now = new Date();
    const currentEnd = subscription.currentPeriodEnd;
    const baseDate = currentEnd > now ? currentEnd : now;
    const newPeriodEnd = new Date(baseDate);
    if (billingCycle === "yearly") {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    } else {
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
    }

    const updated = await prisma.subscription.update({
      where: { companyId },
      data: {
        planId,
        billingCycle,
        status: "ACTIVE",
        currentPeriodEnd: newPeriodEnd,
      },
      include: { plan: true },
    });

    const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

    sendDowngradeConfirmationEmail(
      req.company!.email,
      req.company!.name,
      subscription.plan.name,
      newPlan.name,
      DASHBOARD_URL
    ).catch(() => {});

    res.json({
      message: "Plan downgraded successfully",
      subscription: {
        id: updated.id,
        planId: updated.planId,
        planName: updated.plan.name,
        billingCycle: updated.billingCycle,
        status: updated.status,
        currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
      },
    });
  } catch (err) {
    logger.error("subscription/downgrade error", { err });
    res.status(500).json({ message: "Failed to downgrade subscription" });
  }
});

export default router;
