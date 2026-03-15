import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

const planSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  priceMonthly: z.number().min(0, "Price must be non-negative"),
  priceYearly: z.number().min(0, "Price must be non-negative"),
  maxSeats: z.number().int().min(-1, "Use -1 for unlimited"),
  maxAdmins: z.number().int().min(-1, "Use -1 for unlimited").default(1),
  screenshotsEnabled: z.boolean().default(true),
  browserHistoryEnabled: z.boolean().default(false),
  usbMonitoringEnabled: z.boolean().default(false),
  alertsEnabled: z.boolean().default(false),
  keylogEnabled: z.boolean().default(false),
  fileActivityEnabled: z.boolean().default(false),
  printLogsEnabled: z.boolean().default(false),
  advancedReports: z.boolean().default(false),
  shutdownEnabled: z.boolean().default(false),
  livescreenEnabled: z.boolean().default(false),
  lockEnabled: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// ── GET /admin/plans ──────────────────────────────────────────────────────────
router.get("/", async (_req: AdminRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    const data = plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      price: p.priceMonthly,
      billingCycle: "monthly",
      currency: "PKR",
      maxSeats: p.maxSeats,
      maxAdmins: (p as Record<string, unknown>).maxAdmins ?? 1,
      features: [
        p.screenshotsEnabled ? "Screenshots" : null,
        p.browserHistoryEnabled ? "Browser History" : null,
        p.usbMonitoringEnabled ? "USB Monitoring" : null,
        p.alertsEnabled ? "Alerts" : null,
        p.keylogEnabled ? "Keylogger" : null,
        p.fileActivityEnabled ? "File Activity" : null,
        p.printLogsEnabled ? "Print Logs" : null,
        p.advancedReports ? "Advanced Reports" : null,
        (p as Record<string, unknown>).shutdownEnabled ? "Shutdown" : null,
        (p as Record<string, unknown>).livescreenEnabled ? "Live Screen" : null,
        (p as Record<string, unknown>).lockEnabled ? "Lock" : null,
      ].filter(Boolean) as string[],
      screenshotsEnabled: p.screenshotsEnabled,
      browserHistoryEnabled: p.browserHistoryEnabled,
      usbMonitoringEnabled: p.usbMonitoringEnabled,
      alertsEnabled: p.alertsEnabled,
      keylogEnabled: p.keylogEnabled,
      fileActivityEnabled: p.fileActivityEnabled,
      printLogsEnabled: p.printLogsEnabled,
      advancedReports: p.advancedReports,
      shutdownEnabled: (p as Record<string, unknown>).shutdownEnabled ?? false,
      livescreenEnabled: (p as Record<string, unknown>).livescreenEnabled ?? false,
      lockEnabled: (p as Record<string, unknown>).lockEnabled ?? false,
      isActive: p.isActive,
      customerCount: p._count.subscriptions,
      createdAt: p.createdAt.toISOString(),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Admin plans list error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch plans" });
  }
});

// ── POST /admin/plans ─────────────────────────────────────────────────────────
router.post("/", async (req: AdminRequest, res: Response) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  try {
    const plan = await prisma.plan.create({ data: parsed.data });
    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    logger.error("Admin create plan error", { err });
    return res.status(500).json({ success: false, error: "Failed to create plan" });
  }
});

// ── PUT /admin/plans/:id ──────────────────────────────────────────────────────
router.put("/:id", async (req: AdminRequest, res: Response) => {
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  try {
    const existing = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    return res.json({ success: true, data: plan });
  } catch (err) {
    logger.error("Admin update plan error", { err });
    return res.status(500).json({ success: false, error: "Failed to update plan" });
  }
});

// ── DELETE /admin/plans/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const count = await prisma.subscription.count({
      where: { planId: req.params.id },
    });

    if (count > 0) {
      return res.status(400).json({
        success: false,
        error: `${count} compan${count === 1 ? "y" : "ies"} is plan pe hain, pehle migrate karein`,
      });
    }

    await prisma.plan.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Plan deleted" });
  } catch (err) {
    logger.error("Admin delete plan error", { err });
    return res.status(500).json({ success: false, error: "Failed to delete plan" });
  }
});

export default router;
