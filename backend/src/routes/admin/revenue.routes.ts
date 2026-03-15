import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

// ── GET /admin/revenue/stats ──────────────────────────────────────────────────
router.get("/stats", async (_req: AdminRequest, res: Response) => {
  try {
    const activeSubs = await prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: { select: { priceMonthly: true, priceYearly: true } } },
    });

    const mrr = activeSubs.reduce((sum, s) => sum + s.plan.priceMonthly, 0);
    const arr = mrr * 12;

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const prevSubs = await prisma.subscription.count({
      where: { status: "ACTIVE", createdAt: { lt: oneMonthAgo } },
    });
    const growth = activeSubs.length > 0
      ? Math.round(((activeSubs.length - prevSubs) / Math.max(prevSubs, 1)) * 100)
      : 0;

    return res.json({
      success: true,
      data: { allTime: arr, mrr, arr, growth },
    });
  } catch (err) {
    logger.error("Revenue stats error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch revenue stats" });
  }
});

// ── GET /admin/revenue/monthly ────────────────────────────────────────────────
router.get("/monthly", async (req: AdminRequest, res: Response) => {
  const months = Math.min(Number(req.query.months ?? 12), 24);

  try {
    const result: { month: string; revenue: number; mrr: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const subs = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          createdAt: { lte: monthEnd },
          currentPeriodEnd: { gte: monthStart },
        },
        include: { plan: { select: { priceMonthly: true } } },
      });

      const rev = subs.reduce((sum, s) => sum + s.plan.priceMonthly, 0);

      result.push({
        month: monthStart.toLocaleString("en-US", { month: "short", year: "numeric" }),
        revenue: rev,
        mrr: rev,
      });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Revenue monthly error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch monthly revenue" });
  }
});

// ── GET /admin/revenue/by-plan ────────────────────────────────────────────────
router.get("/by-plan", async (_req: AdminRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
      },
    });

    const data = plans.map((p) => ({
      planName: p.name,
      count: p.subscriptions.length,
      revenue: p.subscriptions.length * p.priceMonthly,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Revenue by plan error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch revenue by plan" });
  }
});

export default router;
