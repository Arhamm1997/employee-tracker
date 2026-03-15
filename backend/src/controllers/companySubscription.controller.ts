import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { sendPlanConfirmationEmail } from "../services/email.service";
import { CompanyRequest } from "../middleware/companyAuth.middleware";

// ─── Schema ───────────────────────────────────────────────────────────────────

const selectPlanSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  billingCycle: z.enum(["monthly", "yearly"] as const),
});

// ─── POST /api/company/subscription/select ────────────────────────────────────

export async function selectPlan(
  req: CompanyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = selectPlanSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { planId, billingCycle } = result.data;
    const companyId = req.company!.id;

    // Verify plan exists and is active
    const plan = await prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) {
      res.status(404).json({ message: "Plan not found or no longer available" });
      return;
    }

    // Check existing subscription
    const existing = await prisma.subscription.findUnique({ where: { companyId } });
    if (existing) {
      res.status(409).json({ message: "Company already has an active subscription" });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "monthly") {
      periodEnd.setDate(periodEnd.getDate() + 30);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 365);
    }

    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        planId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Send confirmation email (non-blocking)
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
    sendPlanConfirmationEmail(
      req.company!.email,
      req.company!.name,
      plan.name,
      plan.maxSeats,
      periodEnd,
      dashboardUrl
    ).catch(() => {});

    // Reissue JWT with planId included
    const token = jwt.sign(
      { companyId, email: req.company!.email, planId },
      process.env.COMPANY_JWT_SECRET!,
      { expiresIn: "7d" }
    );

    logger.info(`Plan selected: company=${companyId} plan=${plan.name} cycle=${billingCycle}`);

    res.json({
      message: "Plan selected",
      subscription: {
        id: subscription.id,
        planName: plan.name,
        maxSeats: plan.maxSeats,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        billingCycle,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}
