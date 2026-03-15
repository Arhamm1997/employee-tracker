import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

// ── GET /api/admin/payment-settings ──────────────────────────────────────────
router.get("/", async (_req: AdminRequest, res: Response) => {
  try {
    let settings = await prisma.paymentSettings.findFirst();

    if (!settings) {
      settings = await prisma.paymentSettings.create({ data: {} });
    }

    res.json({ success: true, settings });
  } catch (err) {
    logger.error("admin/payment-settings GET error", { err });
    res.status(500).json({ success: false, error: "Failed to fetch payment settings" });
  }
});

// ── PUT /api/admin/payment-settings ──────────────────────────────────────────
const settingsSchema = z.object({
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankTitle: z.string().optional(),
  easypaisaNumber: z.string().optional(),
  easypaisaName: z.string().optional(),
  nayapayNumber: z.string().optional(),
  nayapayName: z.string().optional(),
  sadapayNumber: z.string().optional(),
  sadapayName: z.string().optional(),
  jsbankNumber: z.string().optional(),
  jsbankName: z.string().optional(),
  whatsappNumber: z.string().optional(),
  instructions: z.string().optional(),
});

router.put("/", async (req: AdminRequest, res: Response) => {
  const parse = settingsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ success: false, errors: parse.error.flatten() });
    return;
  }

  try {
    let settings = await prisma.paymentSettings.findFirst();

    if (!settings) {
      settings = await prisma.paymentSettings.create({ data: parse.data });
    } else {
      settings = await prisma.paymentSettings.update({
        where: { id: settings.id },
        data: parse.data,
      });
    }

    res.json({ success: true, settings });
  } catch (err) {
    logger.error("admin/payment-settings PUT error", { err });
    res.status(500).json({ success: false, error: "Failed to update payment settings" });
  }
});

export default router;
