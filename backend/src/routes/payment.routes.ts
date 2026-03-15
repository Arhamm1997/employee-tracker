import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import prisma from "../lib/prisma";
import {
  authenticateCompany,
  requireEmailVerified,
  CompanyRequest,
} from "../middleware/companyAuth.middleware";
import {
  sendInvoiceCreatedEmail,
  sendScreenshotUploadConfirmationEmail,
} from "../services/email.service";
import logger from "../lib/logger";

const router = Router();

// ── File Upload Config ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "payments");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const invoiceId = (req as CompanyRequest & Request).params.invoiceId || "unknown";
    cb(null, `${invoiceId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WEBP files allowed (max 5 MB)"));
    }
  },
});

// ── Helper: generate invoice number ──────────────────────────────────────────
async function generateInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `INV-${year}-${seq}`;
}

// ── GET /api/payment/settings (PUBLIC) ───────────────────────────────────────
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.paymentSettings.findFirst();

    if (!settings) {
      // Seed default record if none exists
      settings = await prisma.paymentSettings.create({ data: {} });
    }

    res.json({ settings });
  } catch (err) {
    logger.error("payment/settings GET error", { err });
    res.status(500).json({ message: "Failed to fetch payment settings" });
  }
});

// ── All routes below require company JWT ─────────────────────────────────────
router.use(authenticateCompany, requireEmailVerified);

// ── POST /api/payment/create-invoice ─────────────────────────────────────────
const createInvoiceSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]),
});

router.post("/create-invoice", async (req: CompanyRequest, res: Response) => {
  const parse = createInvoiceSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: "Invalid input", errors: parse.error.flatten() });
    return;
  }

  const { planId, billingCycle } = parse.data;
  const companyId = req.company!.id;

  try {
    // Check for existing PENDING invoice
    const existing = await prisma.invoice.findFirst({
      where: { companyId, status: "PENDING" },
    });

    if (existing) {
      res.status(409).json({
        message: "Aapka ek invoice already pending hai",
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
      });
      return;
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      res.status(404).json({ message: "Plan not found or inactive" });
      return;
    }

    const amount =
      billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId,
        planId,
        billingCycle,
        amount,
        status: "PENDING",
      },
      include: { plan: true },
    });

    // Fetch payment settings for email
    const paymentSettings = await prisma.paymentSettings.findFirst();
    const PORTAL_URL = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    const invoiceUrl = `${PORTAL_URL}/payment/${invoice.id}`;

    if (paymentSettings) {
      sendInvoiceCreatedEmail(
        req.company!.email,
        req.company!.name,
        invoiceNumber,
        plan.name,
        amount,
        {
          easypaisaNumber: paymentSettings.easypaisaNumber,
          nayapayNumber: paymentSettings.nayapayNumber,
          bankIban: paymentSettings.bankIban,
          bankTitle: paymentSettings.bankTitle,
          whatsappNumber: paymentSettings.whatsappNumber,
        },
        invoiceUrl
      ).catch(() => {});
    }

    res.status(201).json({
      message: "Invoice created",
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        planId: invoice.planId,
        planName: invoice.plan.name,
        billingCycle: invoice.billingCycle,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        createdAt: invoice.createdAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("payment/create-invoice error", { err });
    res.status(500).json({ message: "Failed to create invoice" });
  }
});

// ── GET /api/payment/my-invoices ──────────────────────────────────────────────
router.get("/my-invoices", async (req: CompanyRequest, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { companyId: req.company!.id },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    });

    res.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        planName: inv.plan.name,
        billingCycle: inv.billingCycle,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        paymentMethod: inv.paymentMethod,
        rejectionReason: inv.rejectionReason,
        paidAt: inv.paidAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error("payment/my-invoices error", { err });
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// ── GET /api/payment/invoice/:id ──────────────────────────────────────────────
router.get("/invoice/:id", async (req: CompanyRequest, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        plan: true,
        company: { select: { name: true, email: true } },
      },
    });

    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    // Ownership check
    if (invoice.companyId !== req.company!.id) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    // Also fetch payment settings so frontend can render payment details
    const paymentSettings = await prisma.paymentSettings.findFirst();

    res.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        planId: invoice.planId,
        planName: invoice.plan.name,
        billingCycle: invoice.billingCycle,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        paymentMethod: invoice.paymentMethod,
        hasScreenshot: !!invoice.paymentScreenshot,
        rejectionReason: invoice.rejectionReason,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        createdAt: invoice.createdAt.toISOString(),
      },
      paymentSettings: paymentSettings ?? null,
    });
  } catch (err) {
    logger.error("payment/invoice/:id error", { err });
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
});

// ── POST /api/payment/upload-screenshot/:invoiceId ───────────────────────────
const uploadSchema = z.object({
  paymentMethod: z.enum(["easypaisa", "nayapay", "sadapay", "bank"]),
});

router.post(
  "/upload-screenshot/:invoiceId",
  upload.single("screenshot"),
  async (req: CompanyRequest, res: Response) => {
    const parse = uploadSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ message: "Invalid payment method" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "Screenshot file required" });
      return;
    }

    const { invoiceId } = req.params;
    const { paymentMethod } = parse.data;

    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }

      if (invoice.companyId !== req.company!.id) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      if (invoice.status !== "PENDING") {
        res.status(400).json({
          message: `Invoice status is ${invoice.status} — cannot upload screenshot`,
        });
        return;
      }

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paymentScreenshot: req.file.filename,
          paymentMethod,
        },
      });

      // Send confirmation email to company
      const PORTAL_URL = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
      const invoiceUrl = `${PORTAL_URL}/payment/${invoiceId}`;

      sendScreenshotUploadConfirmationEmail(
        req.company!.email,
        req.company!.name,
        invoice.invoiceNumber,
        invoiceUrl
      ).catch(() => {});

      res.json({
        message: "Screenshot uploaded. Admin verification pending.",
        invoice: {
          id: updated.id,
          invoiceNumber: invoice.invoiceNumber,
          status: updated.status,
          paymentMethod: updated.paymentMethod,
          hasScreenshot: true,
        },
      });
    } catch (err) {
      logger.error("payment/upload-screenshot error", { err });
      res.status(500).json({ message: "Failed to upload screenshot" });
    }
  }
);

// ── GET /api/payment/screenshot/:filename (auth-protected view) ───────────────
router.get("/screenshot/:filename", async (req: CompanyRequest, res: Response) => {
  try {
    const { filename } = req.params;

    // Verify this screenshot belongs to the company's invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        companyId: req.company!.id,
        paymentScreenshot: filename,
      },
    });

    if (!invoice) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: "File not found" });
      return;
    }

    res.sendFile(filePath);
  } catch (err) {
    logger.error("payment/screenshot error", { err });
    res.status(500).json({ message: "Failed to serve screenshot" });
  }
});

export default router;
