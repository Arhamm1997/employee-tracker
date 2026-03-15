import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

// ── GET /admin/dashboard/stats ────────────────────────────────────────────────
router.get("/stats", async (_req: AdminRequest, res: Response) => {
  try {
    const [
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalEmployees,
      activeSubs,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: { select: { priceMonthly: true } } },
      }),
    ]);

    const mrr = activeSubs.reduce((sum, s) => sum + s.plan.priceMonthly, 0);

    return res.json({
      success: true,
      data: {
        totalCustomers: totalCompanies,
        activeCustomers: activeCompanies,
        trialCustomers: suspendedCompanies,
        mrr,
        totalAgents: totalEmployees,
        onlineAgents: 0,
      },
    });
  } catch (err) {
    logger.error("Dashboard stats error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// ── GET /admin/dashboard/signups ──────────────────────────────────────────────
router.get("/signups", async (req: AdminRequest, res: Response) => {
  const days = Math.min(Number(req.query.days ?? 30), 90);

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const companies = await prisma.company.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const countsByDate = new Map<string, number>();
    for (const c of companies) {
      const d = c.createdAt.toISOString().slice(0, 10);
      countsByDate.set(d, (countsByDate.get(d) ?? 0) + 1);
    }

    const result: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      result.push({ date: d, count: countsByDate.get(d) ?? 0 });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Dashboard signups error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch signups" });
  }
});

// ── GET /admin/dashboard/subscription-status ─────────────────────────────────
router.get("/subscription-status", async (_req: AdminRequest, res: Response) => {
  try {
    const [active, suspended, cancelled] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
    ]);

    const data = [
      { name: "Active", value: active },
      { name: "Suspended", value: suspended },
      { name: "Cancelled", value: cancelled },
    ].filter((d) => d.value > 0);

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Dashboard subscription-status error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch subscription status" });
  }
});

export default router;
