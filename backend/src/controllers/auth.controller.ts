import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { authenticator } from "otplib";
const generateSecret = () => authenticator.generateSecret();
const generateURI = ({ secret, label, issuer }: { secret: string; label: string; issuer: string }) =>
  authenticator.keyuri(label, issuer, secret);
const verifySync = ({ token, secret }: { token: string; secret: string }) =>
  authenticator.check(token, secret);
const generateSync = ({ secret }: { secret: string }) => authenticator.generate(secret);
import QRCode from "qrcode";
import { z } from "zod";
import { body, validationResult } from "express-validator";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendPasswordResetEmail } from "../services/email.service";

// ─── Token / Cookie Helpers ───────────────────────────────────────────────────

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "default_access_secret";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "default_refresh_secret";
const AGENT_TOKEN_SECRET = process.env.AGENT_TOKEN_SECRET || process.env.JWT_SECRET || "default_agent_secret";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "30d";

export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
export const CSRF_TOKEN_COOKIE_NAME = "csrf_token";

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const CSRF_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  httpOnly: false, // should be readable by JS for double-submit CSRF
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function createAccessToken(payload: { id: string; role: string; companyId: string | null }) {
  return jwt.sign({ ...payload, type: "access" }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function createRefreshToken(payload: { id: string; role: string; companyId: string | null }) {
  return jwt.sign({ ...payload, type: "refresh" }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function validateRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as {
    id: string;
    role: string;
    companyId: string | null;
    type: string;
    iat: number;
    exp: number;
  };
}

function setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie(CSRF_TOKEN_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);
}

function clearAuthCookies(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: "/" });
  res.clearCookie(CSRF_TOKEN_COOKIE_NAME, { path: "/" });
}

// ─── Brute Force Protection (in-memory) ─────────────────────────────────────

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkBruteForce(email: string): { locked: boolean; remainingMinutes?: number } {
  const entry = loginAttempts.get(email);
  if (!entry) return { locked: false };
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return {
      locked: true,
      remainingMinutes: Math.ceil((entry.lockedUntil - Date.now()) / 60000),
    };
  }
  return { locked: false };
}

function recordFailedAttempt(email: string): void {
  const entry = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_DURATION_MS;
    logger.warn(`Account locked for 15 min due to failed attempts: ${email}`);
  }
  loginAttempts.set(email, entry);
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ─── Temp Token (5 min) for 2FA step ─────────────────────────────────────────

function getTempSecret(): string {
  return (process.env.JWT_SECRET || "fallback") + "_temp_2fa";
}

function signTempToken(adminId: string): string {
  return jwt.sign({ adminId, type: "2fa_pending" }, getTempSecret(), { expiresIn: "5m" });
}

function verifyTempToken(token: string): { adminId: string } {
  const decoded = jwt.verify(token, getTempSecret()) as {
    adminId: string;
    type: string;
  };
  if (decoded.type !== "2fa_pending") throw new Error("Invalid temp token type");
  return { adminId: decoded.adminId };
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const twoFACodeSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must be numeric"),
});

const verify2FASchema = z.object({
  tempToken: z.string().min(1, "Temp token is required"),
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must be numeric"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

// ─── express-validator compat (existing routes still use these) ───────────────

export const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

export const changePasswordValidation = [
  body("currentPassword").notEmpty(),
  body("newPassword").isLength({ min: 6 }),
];

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = result.data;

    // Brute force check
    const bruteCheck = checkBruteForce(email);
    if (bruteCheck.locked) {
      res.status(429).json({
        message: `Too many failed attempts. Account locked for ${bruteCheck.remainingMinutes} minute(s). Try again later.`,
      });
      return;
    }

    const admin = await prisma.admin.findFirst({ where: { email } });

    if (!admin || !admin.isActive) {
      recordFailedAttempt(email);
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      recordFailedAttempt(email);
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    clearLoginAttempts(email);

    // 2FA required — return temp token instead of full JWT
    if (admin.twoFactorEnabled && admin.twoFactorSecret) {
      const tempToken = signTempToken(admin.id);
      res.json({ success: true, data: { requires2FA: true, tempToken } });
      return;
    }

    // No 2FA — issue full JWT immediately
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { id: admin.id, role: admin.role, companyId: admin.companyId };
    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);
    const csrfToken = crypto.randomBytes(16).toString("hex");

    setAuthCookies(res, refreshToken, csrfToken);

    const company = admin.companyId
      ? await prisma.company.findUnique({
          where: { id: admin.companyId },
          select: {
            id: true,
            name: true,
            subscription: { select: { status: true, currentPeriodEnd: true } },
          },
        })
      : null;

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          companyId: admin.companyId,
        },
        company: company
          ? {
              id: company.id,
              name: company.name,
              subscriptionStatus: company.subscription?.status ?? null,
              subscriptionExpiresAt: company.subscription?.currentPeriodEnd ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export async function logout(_req: Request, res: Response): Promise<void> {
  // ✅ Clear auth cookies
  clearAuthCookies(res);
  // Maintain compatibility with older cookie names
  res.clearCookie("admin_token", { path: "/" });
  res.json({ message: "Logged out successfully" });
}

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    const csrfHeader = (req.headers["x-csrf-token"] as string) || undefined;
    const csrfCookie = req.cookies?.[CSRF_TOKEN_COOKIE_NAME];

    if (!refreshToken || !csrfHeader || csrfHeader !== csrfCookie) {
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh token or CSRF token" });
      return;
    }

    const payload = validateRefreshToken(refreshToken);
    if (payload.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
    if (!admin || !admin.isActive) {
      clearAuthCookies(res);
      res.status(401).json({ message: "Invalid refresh session" });
      return;
    }

    const newPayload = { id: admin.id, role: admin.role, companyId: admin.companyId };
    const accessToken = createAccessToken(newPayload);
    const newRefreshToken = createRefreshToken(newPayload);
    const newCsrfToken = crypto.randomBytes(16).toString("hex");

    setAuthCookies(res, newRefreshToken, newCsrfToken);

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    clearAuthCookies(res);
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
      },
    });

    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      twoFactorEnabled: admin.twoFactorEnabled,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/change-password ──────────────────────────────────────────

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: "Validation failed", errors: errors.array() });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({ where: { id: admin.id }, data: { password: hashed } });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/auth/me ──────────────────────────────────────────────────────

export async function deleteMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const adminCount = await prisma.admin.count();

    if (adminCount <= 1) {
      res.status(400).json({ message: "Cannot delete the last admin account" });
      return;
    }

    await prisma.admin.delete({ where: { id: adminId } });
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/2fa/setup ─────────────────────────────────────────────────

export async function setup2FA(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const secret = generateSecret();
    const appName = process.env.COMPANY_NAME || "MonitorHub";
    const otpauth = generateURI({ secret, label: admin.email, issuer: appName });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Save secret (2FA not enabled yet — user must verify the code first)
    await prisma.admin.update({
      where: { id: admin.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });

    res.json({ secret, qrCodeUrl });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/2fa/enable ────────────────────────────────────────────────

export async function enable2FA(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = twoFACodeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "A valid 6-digit code is required" });
      return;
    }

    const { code } = result.data;
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });

    if (!admin || !admin.twoFactorSecret) {
      res.status(400).json({
        message: "2FA setup not started. Please call /api/auth/2fa/setup first.",
      });
      return;
    }

    const totpResult = verifySync({ token: code, secret: admin.twoFactorSecret! });
    const isValid = totpResult !== null && totpResult.valid === true;
    if (!isValid) {
      res.status(400).json({ message: "Invalid code. Please check your authenticator app." });
      return;
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { twoFactorEnabled: true },
    });

    logger.info(`2FA enabled for admin: ${admin.email}`);
    res.json({ message: "Two-factor authentication has been enabled successfully." });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/2fa/verify (login step 2) ────────────────────────────────

export async function verify2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = verify2FASchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { tempToken, code } = result.data;

    let adminId: string;
    try {
      ({ adminId } = verifyTempToken(tempToken));
    } catch {
      res.status(401).json({
        message: "Session expired. Please login again.",
      });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive || !admin.twoFactorSecret) {
      res.status(401).json({ message: "Account not found or 2FA not configured." });
      return;
    }

    const totpResult = verifySync({ token: code, secret: admin.twoFactorSecret! });
    const isValid = totpResult !== null && totpResult.valid === true;
    if (!isValid) {
      recordFailedAttempt(admin.email);
      res.status(400).json({ message: "Invalid code. Please check your authenticator app." });
      return;
    }

    clearLoginAttempts(admin.email);
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const payload = { id: admin.id, role: admin.role, companyId: admin.companyId };
    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);
    const csrfToken = crypto.randomBytes(16).toString("hex");

    setAuthCookies(res, refreshToken, csrfToken);

    const company = admin.companyId
      ? await prisma.company.findUnique({
          where: { id: admin.companyId },
          select: {
            id: true,
            name: true,
            subscription: { select: { status: true, currentPeriodEnd: true } },
          },
        })
      : null;

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          companyId: admin.companyId,
        },
        company: company
          ? {
              id: company.id,
              name: company.name,
              subscriptionStatus: company.subscription?.status ?? null,
              subscriptionExpiresAt: company.subscription?.currentPeriodEnd ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/2fa/disable ───────────────────────────────────────────────

export async function disable2FA(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = twoFACodeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "A valid 6-digit code is required" });
      return;
    }

    const { code } = result.data;
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });

    if (!admin || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
      res.status(400).json({ message: "Two-factor authentication is not enabled on this account." });
      return;
    }

    const totpResult = verifySync({ token: code, secret: admin.twoFactorSecret! });
    const isValid = totpResult !== null && totpResult.valid === true;
    if (!isValid) {
      res.status(400).json({ message: "Invalid code. Please check your authenticator app." });
      return;
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    logger.info(`2FA disabled for admin: ${admin.email}`);
    res.json({ message: "Two-factor authentication has been disabled." });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const GENERIC_RESPONSE = "If this email is registered, a password reset link has been sent.";

  try {
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "A valid email address is required" });
      return;
    }

    const { email } = result.data;
    const admin = await prisma.admin.findFirst({ where: { email } });

    if (admin) {
      // Remove any existing reset tokens for this admin
      await prisma.adminPasswordResetToken.deleteMany({ where: { adminId: admin.id } });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.adminPasswordResetToken.create({
        data: { adminId: admin.id, token, expiresAt },
      });

      const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:5173";
      const resetUrl = `${dashboardUrl}/reset-password?token=${token}`;

      await sendPasswordResetEmail(email, admin.name, resetUrl);
      logger.info(`Password reset email sent to: ${email}`);
    }

    // Always return the same message — don't reveal if email exists
    res.json({ message: GENERIC_RESPONSE });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/reset-password ────────────────────────────────────────────

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const { token, newPassword } = result.data;

    const record = await prisma.adminPasswordResetToken.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!record) {
      res.status(400).json({ message: "Invalid or expired reset link." });
      return;
    }

    if (record.expiresAt < new Date()) {
      await prisma.adminPasswordResetToken.delete({ where: { token } });
      res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.admin.update({
      where: { id: record.adminId },
      data: { password: passwordHash },
    });

    // Delete the used token
    await prisma.adminPasswordResetToken.delete({ where: { token } });

    logger.info(`Password reset successfully for admin: ${record.admin.email}`);
    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (err) {
    next(err);
  }
}
