import { Router, Response } from "express";
import path from "path";
import fs from "fs";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from "../../services/email.service";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "payments");

// ── GET /api/admin/invoices ───────────────────────────────────────────────────
router.get("/", async (req: AdminRequest, res: Response) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const skip = (page - 1) * pageSize;
  const statusFilter = req.query.status as string | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statusFilter && statusFilter !== "all") {
      where.status = statusFilter.toUpperCase();
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true, email: true } },
          plan: { select: { name: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          companyId: inv.company.id,
          companyName: inv.company.name,
          companyEmail: inv.company.email,
          planName: inv.plan.name,
          billingCycle: inv.billingCycle,
          amount: inv.amount,
          currency: inv.currency,
          status: inv.status,
          paymentMethod: inv.paymentMethod,
          hasScreenshot: !!inv.paymentScreenshot,
          // FIX: removed leading /api — frontend's API_URL already includes /api
          // was:  `/api/admin/invoices/screenshot/${inv.paymentScreenshot}`
          // now:  `/admin/invoices/screenshot/${inv.paymentScreenshot}`
          screenshotUrl: inv.paymentScreenshot
            ? `/admin/invoices/screenshot/${inv.paymentScreenshot}`
            : null,
          paidAt: inv.paidAt?.toISOString() ?? null,
          rejectionReason: inv.rejectionReason,
          createdAt: inv.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    logger.error("admin/invoices GET error", { err });
    res.status(500).json({ success: false, error: "Failed to fetch invoices" });
  }
});

// ── GET /api/admin/invoices/screenshot/:filename ──────────────────────────────
// FIX: this MUST be registered BEFORE /:id — otherwise Express matches
//      "screenshot" as the :id param and this route is never reached.
router.get("/screenshot/:filename", (req: AdminRequest, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

// ── GET /api/admin/invoices/:id ───────────────────────────────────────────────
router.get("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { id: true, name: true, email: true } },
        plan: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: "Invoice not found" });
      return;
    }

    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        companyId: invoice.company.id,
        companyName: invoice.company.name,
        companyEmail: invoice.company.email,
        planId: invoice.planId,
        planName: invoice.plan.name,
        billingCycle: invoice.billingCycle,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        paymentMethod: invoice.paymentMethod,
        hasScreenshot: !!invoice.paymentScreenshot,
        // FIX: removed leading /api — same as above
        screenshotUrl: invoice.paymentScreenshot
          ? `/admin/invoices/screenshot/${invoice.paymentScreenshot}`
          : null,
        verifiedBy: invoice.verifiedBy,
        verifiedAt: invoice.verifiedAt?.toISOString() ?? null,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        rejectionReason: invoice.rejectionReason,
        notes: invoice.notes,
        createdAt: invoice.createdAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("admin/invoices/:id GET error", { err });
    res.status(500).json({ success: false, error: "Failed to fetch invoice" });
  }
});

// ── POST /api/admin/invoices/:id/approve ─────────────────────────────────────
router.post("/:id/approve", async (req: AdminRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { email: true, name: true } },
        plan: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: "Invoice not found" });
      return;
    }

    if (invoice.status === "PAID") {
      res.status(400).json({ success: false, error: "Invoice already approved" });
      return;
    }

    const now = new Date();
    const days = invoice.billingCycle === "yearly" ? 365 : 30;

    // Update invoice
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: now,
        verifiedBy: req.admin!.id,
        verifiedAt: now,
      },
    });

    // Activate or extend subscription
    const existingSub = await prisma.subscription.findUnique({
      where: { companyId: invoice.companyId },
    });

    let newPeriodEnd: Date;

    if (existingSub) {
      // Extend from current end (or now if already expired)
      const base = existingSub.currentPeriodEnd > now ? existingSub.currentPeriodEnd : now;
      newPeriodEnd = new Date(base);
      newPeriodEnd.setDate(newPeriodEnd.getDate() + days);

      await prisma.subscription.update({
        where: { companyId: invoice.companyId },
        data: {
          planId: invoice.planId,
          billingCycle: invoice.billingCycle,
          status: "ACTIVE",
          currentPeriodEnd: newPeriodEnd,
        },
      });
    } else {
      // New subscription
      newPeriodEnd = new Date(now);
      newPeriodEnd.setDate(newPeriodEnd.getDate() + days);

      await prisma.subscription.create({
        data: {
          companyId: invoice.companyId,
          planId: invoice.planId,
          billingCycle: invoice.billingCycle,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
        },
      });
    }

    const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

    sendPaymentApprovedEmail(
      invoice.company.email,
      invoice.company.name,
      invoice.plan.name,
      newPeriodEnd,
      DASHBOARD_URL
    ).catch(() => {});

    logger.info(
      `Invoice ${invoice.invoiceNumber} approved by admin ${req.admin!.id}`
    );

    res.json({
      success: true,
      message: "Payment approved and subscription activated",
      invoice: {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        status: updated.status,
        paidAt: updated.paidAt?.toISOString(),
        subscriptionValidUntil: newPeriodEnd.toISOString(),
      },
    });
  } catch (err) {
    logger.error("admin/invoices/:id/approve error", { err });
    res.status(500).json({ success: false, error: "Failed to approve invoice" });
  }
});

// ── POST /api/admin/invoices/:id/reject ──────────────────────────────────────
const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason required"),
});

router.post("/:id/reject", async (req: AdminRequest, res: Response) => {
  const parse = rejectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, error: "Rejection reason required" });
    return;
  }

  const { reason } = parse.data;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { email: true, name: true } },
      },
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: "Invoice not found" });
      return;
    }

    if (invoice.status === "PAID") {
      res.status(400).json({ success: false, error: "Cannot reject an already paid invoice" });
      return;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
      },
    });

    const PORTAL_URL = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    const invoiceUrl = `${PORTAL_URL}/payment/${invoice.id}`;

    sendPaymentRejectedEmail(
      invoice.company.email,
      invoice.company.name,
      reason,
      invoiceUrl
    ).catch(() => {});

    logger.info(
      `Invoice ${invoice.invoiceNumber} rejected by admin ${req.admin!.id}: ${reason}`
    );

    res.json({
      success: true,
      message: "Invoice rejected",
      invoice: {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
      },
    });
  } catch (err) {
    logger.error("admin/invoices/:id/reject error", { err });
    res.status(500).json({ success: false, error: "Failed to reject invoice" });
  }
});

export default router;
