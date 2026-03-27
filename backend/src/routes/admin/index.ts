import { Router, Response } from "express";
import authRoutes from "./auth.routes";
import analyticsRoutes from "./analytics.routes";
import customersRoutes from "./customers.routes";
import systemRoutes from "./system.routes";
import dashboardRoutes from "./dashboard.routes";
import agentsRoutes from "./agents.routes";
import logsRoutes from "./logs.routes";
import plansRoutes from "./plans.routes";
import subscriptionsRoutes from "./subscriptions.routes";
import revenueRoutes from "./revenue.routes";
import usersRoutes from "./users.routes";
import ticketsRoutes from "./tickets.routes";
import agentVersionsRoutes from "./agent-versions.routes";
import invoicesRoutes from "./invoices.routes";
import paymentSettingsRoutes from "./payment-settings.routes";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import prisma from "../../lib/prisma";

const router = Router();

// Auth — no middleware (login/verify handled inside)
router.use("/auth", authRoutes);

// All routes below are protected via requireAdmin inside each file
router.use("/dashboard", dashboardRoutes);
router.use("/customers", customersRoutes);
router.use("/plans", plansRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/revenue", revenueRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/agents", agentsRoutes);
router.use("/logs", logsRoutes);
router.use("/system", systemRoutes);
router.use("/users", usersRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/agent-versions", agentVersionsRoutes);

// Phase 7 & 8: Billing / Offline Payment
router.use("/invoices", invoicesRoutes);
router.use("/payment-settings", paymentSettingsRoutes);

// ── GET /admin/notifications ──────────────────────────────────────────────────
router.get("/notifications", requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pendingInvoices, newCustomers, newInvoicesToday, upgradeRequests] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { company: { select: { name: true } }, plan: { select: { name: true } } },
      }),
      prisma.company.findMany({
        where: { createdAt: { gte: oneDayAgo } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { name: true, email: true, createdAt: true },
      }),
      prisma.invoice.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.planUpgradeRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          company: { select: { id: true, name: true, email: true } },
          requestedPlan: { select: { name: true } },
        },
      }),
    ]);

    const notifications = [
      ...upgradeRequests.map((r) => ({
        id: `upgrade-${r.id}`,
        type: "upgrade_request" as const,
        title: `Plan Upgrade Request: ${r.company.name}`,
        body: `Wants to upgrade to ${r.requestedPlan.name}${r.note ? ` — "${r.note}"` : ""}`,
        time: r.createdAt.toISOString(),
        link: `/admin/customers/${r.company.id}`,
        isNew: r.createdAt >= oneDayAgo,
      })),
      ...pendingInvoices.map((inv) => ({
        id: `inv-${inv.id}`,
        type: "invoice" as const,
        title: `New Invoice: ${inv.invoiceNumber}`,
        body: `${inv.company.name} — PKR ${inv.amount.toLocaleString("en-PK")} (${inv.plan.name})`,
        time: inv.createdAt.toISOString(),
        link: "/admin/invoices",
        isNew: inv.createdAt >= oneDayAgo,
      })),
      ...newCustomers.map((c) => ({
        id: `signup-${c.email}`,
        type: "signup" as const,
        title: `New Signup: ${c.name}`,
        body: c.email,
        time: c.createdAt.toISOString(),
        link: "/admin/customers",
        isNew: true,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json({
      total: notifications.length,
      pendingInvoicesCount: pendingInvoices.length,
      newSignupsToday: newCustomers.length,
      newInvoicesToday,
      pendingUpgradeRequests: upgradeRequests.length,
      notifications,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// ── GET /admin/upgrade-requests ───────────────────────────────────────────────
router.get("/upgrade-requests", requireAdmin, async (_req: AdminRequest, res: Response) => {
  try {
    const requests = await prisma.planUpgradeRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, email: true } },
        requestedPlan: { select: { id: true, name: true, priceMonthly: true } },
      },
    });
    res.json({ requests });
  } catch {
    res.status(500).json({ message: "Failed to fetch upgrade requests" });
  }
});

// ── POST /admin/upgrade-requests/:id/approve ──────────────────────────────────
router.post("/upgrade-requests/:id/approve", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const request = await prisma.planUpgradeRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Change the plan
    await prisma.subscription.update({
      where: { companyId: request.companyId },
      data: { planId: request.requestedPlanId },
    });

    // Mark as approved
    await prisma.planUpgradeRequest.update({
      where: { id: req.params.id },
      data: { status: "approved", adminNote: (req.body as { adminNote?: string }).adminNote ?? null },
    });

    return res.json({ success: true, message: "Upgrade request approved and plan changed" });
  } catch (err) {
    console.error("approve upgrade error", err);
    return res.status(500).json({ message: "Failed to approve upgrade request" });
  }
});

// ── POST /admin/upgrade-requests/:id/reject ───────────────────────────────────
router.post("/upgrade-requests/:id/reject", requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const request = await prisma.planUpgradeRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: "Request not found" });

    await prisma.planUpgradeRequest.update({
      where: { id: req.params.id },
      data: { status: "rejected", adminNote: (req.body as { adminNote?: string }).adminNote ?? null },
    });

    return res.json({ success: true, message: "Upgrade request rejected" });
  } catch {
    return res.status(500).json({ message: "Failed to reject upgrade request" });
  }
});

export default router;
