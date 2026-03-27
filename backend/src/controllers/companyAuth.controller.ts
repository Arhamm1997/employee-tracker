import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendAdminNewSignupNotification,
} from "../services/email.service";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  email: z.string().email("Valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

const resendSchema = z.object({
  email: z.string().email("Valid email is required"),
});

// ─── POST /api/company/auth/register ─────────────────────────────────────────

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { companyName, email, password } = result.data;

    const existing = await prisma.company.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "This email is already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const company = await prisma.company.create({
      data: { name: companyName, email, passwordHash, emailVerified: false },
    });

    // Create an Admin record so the company owner can log into the dashboard
    await prisma.admin.create({
      data: {
        companyId: company.id,
        email,
        password: passwordHash,
        name: companyName,
        role: "super_admin",
        isActive: true,
      },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: { companyId: company.id, token, expiresAt },
    });

    const portalUrl = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    const verificationUrl = `${portalUrl}/verify-email?token=${token}`;

    await sendVerificationEmail(email, companyName, verificationUrl);

    // Notify master admin (non-blocking)
    const adminUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
    prisma.admin.findFirst({ where: { companyId: null, role: "super_admin" } })
      .then((masterAdmin) => {
        if (masterAdmin?.email) {
          sendAdminNewSignupNotification(masterAdmin.email, companyName, email, adminUrl).catch(() => {});
        }
      })
      .catch(() => {});

    logger.info(`Company registered: ${email}`);
    res.status(201).json({ message: "Verification email sent" });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/company/auth/verify-email?token=xxx ────────────────────────────

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ message: "Verification token is required" });
      return;
    }

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!record) {
      res.status(404).json({ message: "Invalid verification link" });
      return;
    }

    if (record.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { token } });
      res.status(410).json({ message: "Verification link has expired" });
      return;
    }

    // Mark verified + delete used token
    await prisma.company.update({
      where: { id: record.companyId },
      data: { emailVerified: true },
    });
    await prisma.emailVerificationToken.delete({ where: { token } });

    // Issue JWT so user can immediately select a plan
    const jwtToken = jwt.sign(
      { companyId: record.companyId, email: record.company.email },
      process.env.COMPANY_JWT_SECRET!,
      { expiresIn: "7d" }
    );

    // Send welcome email (non-blocking)
    const portalUrl = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    sendWelcomeEmail(record.company.email, record.company.name, `${portalUrl}/select-plan`).catch(
      () => {}
    );

    logger.info(`Company email verified: ${record.company.email}`);
    res.json({
      message: "Email verified",
      companyId: record.companyId,
      token: jwtToken,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/company/auth/resend-verification ───────────────────────────────

export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = resendSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Valid email is required" });
      return;
    }

    const { email } = result.data;
    const company = await prisma.company.findUnique({ where: { email } });

    // Don't reveal if email doesn't exist
    if (!company) {
      res.json({ message: "If this email is registered, a verification link has been sent" });
      return;
    }

    if (company.emailVerified) {
      res.status(400).json({ message: "This email is already verified" });
      return;
    }

    // Delete old tokens and create new one
    await prisma.emailVerificationToken.deleteMany({
      where: { companyId: company.id },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { companyId: company.id, token, expiresAt },
    });

    const portalUrl = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
    await sendVerificationEmail(email, company.name, `${portalUrl}/verify-email?token=${token}`);

    logger.info(`Verification resent to: ${email}`);
    res.json({ message: "Verification email sent" });
  } catch (err) {
    next(err);
  }
}
