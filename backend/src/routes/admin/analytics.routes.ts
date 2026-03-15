import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import { Response } from "express";
import logger from "../../lib/logger";
import os from "os";

const router = Router();
router.use(requireAdmin);

// ── GET /admin/analytics/overview ────────────────────────────────────────────
router.get("/overview", async (_req: AdminRequest, res: Response) => {
  try {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

    const [totalEmployees, activeEmployees, recentEmployees, onlineEmployees] =
      await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { isActive: true } }),
        prisma.employee.count({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        }),
        prisma.employee.count({
          where: { isActive: true, lastSeenAt: { gte: twoMinsAgo } },
        }),
      ]);

    return res.json({
      success: true,
      data: {
        totalCustomers: totalEmployees,
        activeCustomers: activeEmployees,
        trialCustomers: recentEmployees,   // "new this week" mapped to trial slot
        mrr: 0,                            // not applicable for single-tenant
        totalAgents: totalEmployees,
        onlineAgents: onlineEmployees,
      },
    });
  } catch (err) {
    logger.error("Analytics overview error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch overview" });
  }
});

// ── GET /admin/analytics/signups ──────────────────────────────────────────────
// Returns employee registrations per day for the last 30 days
router.get("/signups", async (_req: AdminRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const employees = await prisma.employee.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by date string
    const countsByDate = new Map<string, number>();
    for (const e of employees) {
      const dateStr = e.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
    }

    // Fill in all 30 days (including zeros)
    const result: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, count: countsByDate.get(dateStr) ?? 0 });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Signups analytics error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch signups" });
  }
});

// ── GET /admin/analytics/subscription-status ─────────────────────────────────
// Maps active/inactive/never-seen to active/trial/cancelled
router.get("/subscription-status", async (_req: AdminRequest, res: Response) => {
  try {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

    const [active, inactive, neverSeen] = await Promise.all([
      prisma.employee.count({
        where: { isActive: true, lastSeenAt: { gte: twoMinsAgo } },
      }),
      prisma.employee.count({
        where: { isActive: true, lastSeenAt: { lt: twoMinsAgo } },
      }),
      prisma.employee.count({
        where: { isActive: true, lastSeenAt: null },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        active,
        trial: neverSeen,      // never connected agent → "trial"
        cancelled: inactive,   // was active, now offline → "inactive"
      },
    });
  } catch (err) {
    logger.error("Subscription status error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch status" });
  }
});

// ── GET /admin/analytics/growth ──────────────────────────────────────────────
// Company signups per day over a date range
router.get("/growth", async (req: AdminRequest, res: Response) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const companies = await prisma.company.findMany({
      where: { createdAt: { gte: startDate, lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const countsByDate = new Map<string, number>();
    for (const c of companies) {
      const dateStr = c.createdAt.toISOString().slice(0, 10);
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
    }

    const result: { date: string; count: number }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);
      result.push({ date: dateStr, count: countsByDate.get(dateStr) ?? 0 });
      current.setDate(current.getDate() + 1);
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Analytics growth error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch growth data" });
  }
});

// ── GET /admin/analytics/revenue ────────────────────────────────────────────
// Monthly revenue from paid invoices
router.get("/revenue", async (req: AdminRequest, res: Response) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: startDate, lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: { amount: true, paidAt: true, billingCycle: true },
    });

    const monthlyRevenue = new Map<string, number>();
    for (const inv of invoices) {
      const month = inv.paidAt!.toISOString().slice(0, 7); // "YYYY-MM"
      monthlyRevenue.set(month, (monthlyRevenue.get(month) ?? 0) + inv.amount);
    }

    // Generate all months in range
    const result: { month: string; revenue: number; mrr: number }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const month = current.toISOString().slice(0, 7);
      const revenue = monthlyRevenue.get(month) ?? 0;
      result.push({ month, revenue, mrr: revenue });
      current.setMonth(current.getMonth() + 1);
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Analytics revenue error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch revenue data" });
  }
});

// ── GET /admin/analytics/churn ──────────────────────────────────────────────
// Monthly cancelled subscriptions
router.get("/churn", async (req: AdminRequest, res: Response) => {
  try {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const cancelled = await prisma.subscription.findMany({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: startDate, lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: { updatedAt: true },
    });

    const totalActive = await prisma.subscription.count({ where: { status: "ACTIVE" } });

    const monthlyChurn = new Map<string, number>();
    for (const sub of cancelled) {
      const month = sub.updatedAt.toISOString().slice(0, 7);
      monthlyChurn.set(month, (monthlyChurn.get(month) ?? 0) + 1);
    }

    const result: { month: string; churned: number; churnRate: number }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const month = current.toISOString().slice(0, 7);
      const churned = monthlyChurn.get(month) ?? 0;
      const churnRate = totalActive > 0 ? Math.round((churned / totalActive) * 100 * 10) / 10 : 0;
      result.push({ month, churned, churnRate });
      current.setMonth(current.getMonth() + 1);
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Analytics churn error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch churn data" });
  }
});

// ── GET /admin/analytics/status-distribution ────────────────────────────────
// Subscription status breakdown (pie chart)
router.get("/status-distribution", async (_req: AdminRequest, res: Response) => {
  try {
    const [active, suspended, cancelled, expired] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gte: new Date() } } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      prisma.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { lt: new Date() } } }),
    ]);

    return res.json({
      success: true,
      data: [
        { name: "Active", value: active },
        { name: "Suspended", value: suspended },
        { name: "Cancelled", value: cancelled },
        { name: "Expired", value: expired },
      ],
    });
  } catch (err) {
    logger.error("Analytics status distribution error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch status distribution" });
  }
});

// ── GET /admin/analytics/plan-distribution ──────────────────────────────────
// Subscriptions grouped by plan
router.get("/plan-distribution", async (_req: AdminRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      select: {
        id: true,
        name: true,
        priceMonthly: true,
        _count: { select: { subscriptions: true } },
      },
    });

    const data = plans.map((p) => ({
      planName: p.name,
      count: p._count.subscriptions,
      revenue: p._count.subscriptions * p.priceMonthly,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Analytics plan distribution error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch plan distribution" });
  }
});

// ── GET /admin/analytics/top-customers ──────────────────────────────────────
// Companies ordered by MRR
router.get("/top-customers", async (req: AdminRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 10), 50);

    const companies = await prisma.company.findMany({
      where: { subscription: { status: "ACTIVE" } },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { subscription: { plan: { priceMonthly: "desc" } } },
      take: limit,
    });

    const data = companies.map((c) => ({
      companyName: c.name,
      mrr: c.subscription?.plan?.priceMonthly ?? 0,
      agentCount: c._count.employees,
      employeeCount: c._count.employees,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Analytics top customers error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch top customers" });
  }
});

export default router;
