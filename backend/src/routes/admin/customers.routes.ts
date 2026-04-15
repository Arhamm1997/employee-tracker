import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma"; // customers routes
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import { hashPassword } from "../../lib/bcrypt";
import { sendWelcomeEmail, sendCancellationEmail } from "../../services/email.service";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

const twoMinsAgo = () => new Date(Date.now() - 2 * 60 * 1000);

const createCustomerSchema = z.object({
  companyName: z.string().min(2, "Company name required"),
  email: z.string().email("Invalid email"),
  planId: z.string().min(1, "Plan is required"),
  employeeCount: z.number().int().min(1).optional().default(1),
});

// ── GET /admin/customers ──────────────────────────────────────────────────────
router.get("/", async (req: AdminRequest, res: Response) => {
  const pageSize = Math.min(Number(req.query.pageSize ?? req.query.limit ?? 20), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const skip = (page - 1) * pageSize;
  const search = (req.query.search as string | undefined)?.trim();
  const statusFilter = req.query.status as string | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "suspended") {
        where.subscription = { status: "SUSPENDED" };
      } else if (statusFilter === "active") {
        where.subscription = { status: "ACTIVE" };
      } else if (statusFilter === "cancelled") {
        where.subscription = { status: "CANCELLED" };
      } else if (statusFilter === "expired") {
        where.subscription = { currentPeriodEnd: { lt: new Date() } };
      }
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: { include: { plan: true } },
          _count: {
            select: { employees: true },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    const data = companies.map((c) => {
      const sub = c.subscription;
      const plan = sub?.plan;
      const subStatus = sub?.status ?? "ACTIVE";
      const isExpired = sub ? sub.currentPeriodEnd < new Date() : false;

      let status: "active" | "trial" | "suspended" | "cancelled";
      if (subStatus === "SUSPENDED") status = "suspended";
      else if (subStatus === "CANCELLED") status = "cancelled";
      else if (isExpired) status = "cancelled";
      else status = "active";

      return {
        id: c.id,
        companyName: c.name,
        email: c.email,
        planId: plan?.id ?? "",
        planName: plan?.name ?? "No Plan",
        status,
        employeeCount: c._count.employees,
        agentCount: c._count.employees,
        onlineAgentCount: 0,
        joinedAt: c.createdAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        subscriptionEndDate: sub?.currentPeriodEnd.toISOString() ?? null,
        trialEndsAt: null,
        mrr: plan ? (sub?.status === "ACTIVE" ? plan.priceMonthly : 0) : 0,
      };
    });

    return res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    logger.error("Admin customers list error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch customers" });
  }
});

// ── POST /admin/customers ─────────────────────────────────────────────────────
router.post("/", async (req: AdminRequest, res: Response) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const { companyName, email, planId } = parsed.data;

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(400).json({ success: false, error: "Plan not found" });
    }

    const existing = await prisma.company.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    const tempPassword = `Pass${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await hashPassword(tempPassword);

    const company = await prisma.company.create({
      data: {
        name: companyName,
        email,
        passwordHash,
        emailVerified: true,
        subscription: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { subscription: { include: { plan: true } } },
    });

    // Send welcome email (fire and forget)
    const portalUrl = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    sendWelcomeEmail(email, companyName, `${portalUrl}/select-plan`).catch((e) =>
      logger.warn("Welcome email failed", { e })
    );

    return res.status(201).json({ success: true, data: company });
  } catch (err) {
    logger.error("Admin create customer error", { err });
    return res.status(500).json({ success: false, error: "Failed to create customer" });
  }
});

// ── POST /admin/customers/bulk-suspend ────────────────────────────────────────
router.post("/bulk-suspend", async (req: AdminRequest, res: Response) => {
  const { ids } = req.body as { ids?: string[] };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: "ids array is required" });
  }

  try {
    await prisma.subscription.updateMany({
      where: { companyId: { in: ids } },
      data: { status: "SUSPENDED" },
    });

    return res.json({ success: true, suspended: ids.length });
  } catch (err) {
    logger.error("Bulk suspend error", { err });
    return res.status(500).json({ success: false, error: "Failed to suspend companies" });
  }
});

// ── GET /admin/customers/:id ──────────────────────────────────────────────────
router.get("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { plan: true } },
        _count: {
          select: { employees: true, screenshots: true, activities: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    const sub = company.subscription;
    const plan = sub?.plan;
    const isExpired = sub ? sub.currentPeriodEnd < new Date() : false;

    let status: "active" | "trial" | "suspended" | "cancelled";
    if (sub?.status === "SUSPENDED") status = "suspended";
    else if (sub?.status === "CANCELLED") status = "cancelled";
    else if (isExpired) status = "cancelled";
    else status = "active";

    return res.json({
      success: true,
      data: {
        id: company.id,
        companyName: company.name,
        email: company.email,
        planId: plan?.id ?? "",
        planName: plan?.name ?? "No Plan",
        status,
        employeeCount: company._count.employees,
        agentCount: company._count.employees,
        onlineAgentCount: 0,
        joinedAt: company.createdAt.toISOString(),
        subscriptionEndDate: sub?.currentPeriodEnd.toISOString() ?? null,
        totalScreenshots: company._count.screenshots,
        lastActivity: null,
        mrr: plan ? (sub?.status === "ACTIVE" ? plan.priceMonthly : 0) : 0,
        subscription: sub
          ? {
              id: sub.id,
              planId: sub.planId,
              planName: plan?.name ?? "",
              status: sub.status,
              currentPeriodStart: sub.currentPeriodStart.toISOString(),
              currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            }
          : null,
      },
    });
  } catch (err) {
    logger.error("Admin customer detail error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch customer" });
  }
});

// ── GET /admin/customers/:id/subscription ────────────────────────────────────
router.get("/:id/subscription", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    const sub = company.subscription;
    if (!sub) {
      return res.status(404).json({ success: false, error: "No subscription found" });
    }

    const plan = sub.plan;
    const seatsTotal = plan?.maxSeats ?? 0;
    const seatsUsed = company._count.employees;

    let status: "active" | "trial" | "suspended" | "cancelled";
    if (sub.status === "SUSPENDED") status = "suspended";
    else if (sub.status === "CANCELLED") status = "cancelled";
    else if (sub.currentPeriodEnd < new Date()) status = "cancelled";
    else status = "active";

    return res.json({
      success: true,
      data: {
        id: sub.id,
        customerId: company.id,
        companyName: company.name,
        planId: sub.planId,
        planName: plan?.name ?? "No Plan",
        status,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        seatsUsed,
        seatsTotal,
        mrr: plan ? (sub.status === "ACTIVE" ? plan.priceMonthly : 0) : 0,
        autoRenew: false,
      },
    });
  } catch (err) {
    logger.error("Customer subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch subscription" });
  }
});

// ── GET /admin/customers/:id/invoices ─────────────────────────────────────────
router.get("/:id/invoices", async (req: AdminRequest, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { companyId: req.params.id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    const data = invoices.map((inv) => ({
      id: inv.id,
      customerId: inv.companyId,
      companyName: "",
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status.toLowerCase() as "paid" | "pending" | "failed",
      dueDate: new Date(inv.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
      items: [{ description: inv.plan?.name ?? "Plan", quantity: 1, unitPrice: inv.amount, total: inv.amount }],
      createdAt: inv.createdAt.toISOString(),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Customer invoices error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch invoices" });
  }
});

// ── GET /admin/customers/:id/agents ───────────────────────────────────────────
router.get("/:id/agents", async (req: AdminRequest, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: req.params.id, isActive: true },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        department: true,
        lastSeenAt: true,
        agentVersion: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const cutoff = twoMinsAgo();
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const data = employees.map((e) => {
      let status: "online" | "idle" | "offline";
      if (!e.lastSeenAt || e.lastSeenAt < fifteenMinsAgo) status = "offline";
      else if (e.lastSeenAt >= cutoff) status = "online";
      else status = "idle";

      return {
        id: e.id,
        machineId: e.employeeCode,
        employeeName: e.name,
        companyId: req.params.id,
        status,
        lastSeen: e.lastSeenAt?.toISOString() ?? "",
        version: e.agentVersion ?? "—",
        os: "Windows",
        ipAddress: "—",
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Customer agents error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch agents" });
  }
});

// ── POST /admin/customers/:id/change-plan ────────────────────────────────────
router.post("/:id/change-plan", async (req: AdminRequest, res: Response) => {
  const { planId } = req.body as { planId?: string };
  if (!planId) {
    return res.status(400).json({ success: false, error: "planId is required" });
  }

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(400).json({ success: false, error: "Plan not found" });
    }

    await prisma.subscription.update({
      where: { companyId: req.params.id },
      data: { planId },
    });

    return res.json({ success: true, message: "Plan changed successfully" });
  } catch (err) {
    logger.error("Change plan error", { err });
    return res.status(500).json({ success: false, error: "Failed to change plan" });
  }
});

// ── POST /admin/customers/:id/extend-subscription ────────────────────────────
router.post("/:id/extend-subscription", async (req: AdminRequest, res: Response) => {
  const { days } = req.body as { days?: number };
  if (!days || days <= 0) {
    return res.status(400).json({ success: false, error: "days must be a positive number" });
  }

  try {
    const sub = await prisma.subscription.findUnique({
      where: { companyId: req.params.id },
    });

    if (!sub) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    const newEnd = new Date(sub.currentPeriodEnd.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.subscription.update({
      where: { companyId: req.params.id },
      data: { currentPeriodEnd: newEnd, status: "ACTIVE" },
    });

    return res.json({ success: true, message: `Subscription extended by ${days} days` });
  } catch (err) {
    logger.error("Extend subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to extend subscription" });
  }
});

// ── POST /admin/customers/:id/cancel-subscription ────────────────────────────
router.post("/:id/cancel-subscription", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { name: true, email: true },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    await prisma.subscription.update({
      where: { companyId: req.params.id },
      data: { status: "CANCELLED" },
    });

    sendCancellationEmail(company.email, company.name).catch((e) =>
      logger.warn("Cancellation email failed", { e })
    );

    return res.json({ success: true, message: "Subscription cancelled" });
  } catch (err) {
    logger.error("Cancel subscription error", { err });
    return res.status(500).json({ success: false, error: "Failed to cancel subscription" });
  }
});

// ── POST /admin/customers/:id/suspend ────────────────────────────────────────
router.post("/:id/suspend", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { companyId: req.params.id },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    await prisma.subscription.update({
      where: { companyId: req.params.id },
      data: { status: "SUSPENDED" },
    });

    return res.json({ success: true, message: "Company suspended" });
  } catch (err) {
    logger.error("Suspend company error", { err });
    return res.status(500).json({ success: false, error: "Failed to suspend company" });
  }
});

// ── POST /admin/customers/:id/activate ───────────────────────────────────────
router.post("/:id/activate", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { companyId: req.params.id },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    await prisma.subscription.update({
      where: { companyId: req.params.id },
      data: { status: "ACTIVE" },
    });

    return res.json({ success: true, message: "Company activated" });
  } catch (err) {
    logger.error("Activate company error", { err });
    return res.status(500).json({ success: false, error: "Failed to activate company" });
  }
});

// ── DELETE /admin/customers/:id ───────────────────────────────────────────────
router.delete("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: { name: true, email: true },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }

    // Delete in correct order to respect FK constraints
    const employees = await prisma.employee.findMany({
      where: { companyId: req.params.id },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    if (employeeIds.length > 0) {
      await Promise.all([
        prisma.printLog.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.fileActivity.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.keylogEntry.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.connectionEvent.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.clipboardLog.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.usbEvent.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.browserHistory.deleteMany({ where: { employeeId: { in: employeeIds } } }),
        prisma.alert.deleteMany({ where: { companyId: req.params.id } }),
        prisma.screenshot.deleteMany({ where: { companyId: req.params.id } }),
        prisma.activity.deleteMany({ where: { companyId: req.params.id } }),
      ]);
      await prisma.employee.deleteMany({ where: { companyId: req.params.id } });
    }

    // Delete AgentRefreshTokens for company employees
    if (employeeIds.length > 0) {
      await prisma.agentRefreshToken.deleteMany({ where: { companyId: req.params.id } });
    }

    // Delete support ticket replies first (FK: ticketId → SupportTicket)
    const tickets = await prisma.supportTicket.findMany({
      where: { companyId: req.params.id },
      select: { id: true },
    });
    if (tickets.length > 0) {
      await prisma.ticketReply.deleteMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } });
      await prisma.supportTicket.deleteMany({ where: { companyId: req.params.id } });
    }

    await Promise.all([
      prisma.planUpgradeRequest.deleteMany({ where: { companyId: req.params.id } }),
      prisma.invoice.deleteMany({ where: { companyId: req.params.id } }),
      prisma.auditLog.deleteMany({ where: { company_id: req.params.id } }),
      prisma.admin.deleteMany({ where: { companyId: req.params.id } }),
      prisma.settings.deleteMany({ where: { companyId: req.params.id } }),
      prisma.subscription.deleteMany({ where: { companyId: req.params.id } }),
      prisma.emailVerificationToken.deleteMany({ where: { companyId: req.params.id } }),
      prisma.passwordResetToken.deleteMany({ where: { companyId: req.params.id } }),
      prisma.agentRefreshToken.deleteMany({ where: { companyId: req.params.id } }),
    ]);

    await prisma.company.delete({ where: { id: req.params.id } });

    sendCancellationEmail(company.email, company.name).catch((e) =>
      logger.warn("Cancellation email failed", { e })
    );

    return res.json({ success: true, message: "Company deleted" });
  } catch (err) {
    logger.error("Delete company error", { err });
    return res.status(500).json({ success: false, error: "Failed to delete company" });
  }
});

export default router;
