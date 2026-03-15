import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import prisma from "../../lib/prisma";
import { comparePassword } from "../../lib/bcrypt";
import logger from "../../lib/logger";

const router = Router();

// Temp tokens stored in memory (single-server admin panel)
const tempTokens = new Map<string, { adminId: string; code: string; expiresAt: number }>();

function getAdminSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not set");
  return secret;
}

// ── Send 2FA code via email ───────────────────────────────────────────────────
async function send2FACodeEmail(to: string, name: string, code: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const company = process.env.COMPANY_NAME || "MonitorHub";
  const from    = process.env.SMTP_FROM    || "MonitorHub <noreply@monitorhub.com>";

  await transporter.sendMail({
    from,
    to,
    subject: `${code} — Your Admin Login Code`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
        <div style="background:#1e1e2e;padding:20px 28px;">
          <h2 style="color:#fff;margin:0;font-size:18px;">${company} — Admin Login</h2>
        </div>
        <div style="padding:28px;">
          <p style="color:#374151;margin-top:0;">Hi <strong>${name}</strong>,</p>
          <p style="color:#374151;">Your 2FA login code is:</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#6366f1;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color:#6b7280;font-size:13px;">If you did not attempt to login, please secure your account immediately.</p>
        </div>
        <div style="background:#f9fafb;padding:12px 28px;text-align:center;font-size:12px;color:#9ca3af;">
          Automated security alert.
        </div>
      </div>
    `,
  });
}

// ── POST /admin/auth/login ────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required" });
  }

  try {
    // Only master admins (companyId = null)
    const admin = await prisma.admin.findFirst({
      where: { email, companyId: null },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const valid = await comparePassword(password, admin.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // Short-lived temp token for 2FA step — signed with ADMIN_JWT_SECRET
    const temp_token = jwt.sign({ adminId: admin.id }, getAdminSecret(), { expiresIn: "10m" });

    // 6-digit 2FA code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    tempTokens.set(temp_token, {
      adminId: admin.id,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    logger.info(`[2FA] Master Admin ${email} login code: ${code}`);

    // ✅ Send code to admin's email
    send2FACodeEmail(admin.email, admin.name, code).catch((err) => {
      logger.error("Failed to send 2FA email:", err);
    });

    return res.json({
      success: true,
      data: {
        temp_token,
        // Include code in dev so dashboard can auto-fill
        ...(process.env.NODE_ENV !== "production" && { dev_code: code }),
      },
    });
  } catch (err) {
    logger.error("Admin login error", { err });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ── POST /admin/auth/verify-2fa ───────────────────────────────────────────────
router.post("/verify-2fa", async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };

  const authHeader = req.headers.authorization;
  const temp_token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (req.body.temp_token as string | undefined);

  if (!temp_token || !code) {
    return res.status(400).json({ success: false, error: "Token and code are required" });
  }

  const entry = tempTokens.get(temp_token);

  if (!entry || Date.now() > entry.expiresAt) {
    tempTokens.delete(temp_token);
    return res.status(401).json({ success: false, error: "Code expired. Please login again." });
  }

  if (entry.code !== code) {
    return res.status(401).json({ success: false, error: "Invalid code" });
  }

  tempTokens.delete(temp_token);

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: entry.adminId },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: "Account not found or disabled" });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      getAdminSecret(),
      { expiresIn: "8h" }
    );

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          permissions: [],
          createdAt: admin.createdAt.toISOString(),
        },
      },
    });
  } catch (err) {
    logger.error("2FA verify error", { err });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;