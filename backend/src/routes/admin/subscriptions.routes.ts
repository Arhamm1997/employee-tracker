import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import { sendCancellationEmail } from "../../services/email.service";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

// ── GET /admin/subscriptions ──────────────────────────────────────────────────
router.get("/", async (req: AdminRequest, res: Response) => {
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const skip = (page - 1) * pageSize;
  const statusFilter = req.query.status as string | undefined;
  const planFilter = req.query.planId as string | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statusFilter && statusFilter !== "all") where.status = statusFilter.toUpperCase();
    if (planFilter) where.planId = planFilter;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { name: true, email: true } },
          plan: { select: { name: true, priceMonthly: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    const data = subscriptions.map((s) => ({
      id: s.id,
      companyId: s.companyId,
      companyName: s.company.name,
      planId: s.planId,
      planName: s.plan.name,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      seatsUsed: 0,
      seatsTotal: 0,
      mrr: s.status === "ACTIVE" ? s.plan.priceMonthly : 0,
      autoRenew: true,
    }));

    return res.json({
      success: true,
      data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    });
  } catch (err) {
    logger.error("Admin subscriptions list error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch subscriptions" });
  }
});

// ── GET /admin/subscriptions/:id ──────────────────────────────────────────────
router.get("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { name: true, email: true } },
        plan: true,
      },
    });

    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    return res.json({
      success: true,
      data: {
        id: sub.id,
        companyId: sub.companyId,
        companyName: sub.company.name,
        planId: sub.planId,
        planName: sub.plan.name,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        seatsUsed: 0,
        seatsTotal: sub.plan.maxSeats,
        mrr: sub.status === "ACTIVE" ? sub.plan.priceMonthly : 0,
        autoRenew: true,
        plan: sub.plan,
      },
    });
  } catch (err) {
    logger.error("Admin subscription detail error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch subscription" });
  }
});

// ── PUT /admin/subscriptions/:id ──────────────────────────────────────────────
router.put("/:id", async (req: AdminRequest, res: Response) => {
  const { planId, status, currentPeriodEnd } = req.body as {
    planId?: string;
    status?: string;
    currentPeriodEnd?: string;
  };

  try {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (planId) data.planId = planId;
    if (status) data.status = status.toUpperCase();
    if (currentPeriodEnd) data.currentPeriodEnd = new Date(currentPeriodEnd);

    const updated = await prisma.subscription.update({ where: { id: req.params.id }, data });
    return res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("Update subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to update subscription" });
  }
});

// ── POST /admin/subscriptions/:id/cancel ─────────────────────────────────────
router.post("/:id/cancel", async (req: AdminRequest, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { company: { select: { name: true, email: true } } },
    });

    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    sendCancellationEmail(sub.company.email, sub.company.name).catch((e) =>
      logger.warn("Cancellation email failed", { e })
    );

    return res.json({ success: true, message: "Subscription cancelled" });
  } catch (err) {
    logger.error("Cancel subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to cancel subscription" });
  }
});

// ── POST /admin/subscriptions/:id/extend ─────────────────────────────────────
router.post("/:id/extend", async (req: AdminRequest, res: Response) => {
  const { days } = req.body as { days?: number };
  if (!days || days <= 0) {
    return res.status(400).json({ success: false, error: "days must be a positive number" });
  }

  try {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    const newEnd = new Date(sub.currentPeriodEnd.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: { currentPeriodEnd: newEnd, status: "ACTIVE" },
    });

    return res.json({
      success: true,
      message: `Subscription extended by ${days} days`,
      data: updated,
    });
  } catch (err) {
    logger.error("Extend subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to extend subscription" });
  }
});

export default router;
