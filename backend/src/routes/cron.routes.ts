/**
 * Cron Routes — Daily subscription health checks
 *
 * Endpoint: GET /api/cron/check-subscriptions
 * Secured by: X-Cron-Secret header matching CRON_SECRET env var
 *
 * Can be triggered by:
 *  - External scheduler (cron-job.org, GitHub Actions, Render cron)
 *  - Or internally via node-cron in index.ts
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  sendExpiryWarningEmail,
  sendExpiryNotificationEmail,
} from "../services/email.service";
import logger from "../lib/logger";

const router = Router();

// ── Secret Header Guard ───────────────────────────────────────────────────────
function verifyCronSecret(req: Request, res: Response): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — only allow localhost
    const ip = req.ip || req.socket.remoteAddress || "";
    if (!ip.includes("127.0.0.1") && !ip.includes("::1") && !ip.includes("localhost")) {
      res.status(401).json({ message: "CRON_SECRET not configured — only localhost allowed" });
      return false;
    }
    return true;
  }

  const provided = req.headers["x-cron-secret"];
  if (provided !== secret) {
    res.status(401).json({ message: "Invalid cron secret" });
    return false;
  }
  return true;
}

// ── GET /api/cron/check-subscriptions ────────────────────────────────────────
router.get("/check-subscriptions", async (req: Request, res: Response) => {
  if (!verifyCronSecret(req, res)) return;

  const PORTAL_URL = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
  const renewUrl = `${PORTAL_URL}/billing`;

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let warningSent = 0;
  let expiredCount = 0;
  const errors: string[] = [];

  try {
    // ── 1. Find subscriptions expiring within 7 days ────────────────────────
    const expiringSoon = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: {
          gt: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        company: { select: { email: true, name: true } },
        plan: { select: { name: true } },
      },
    });

    for (const sub of expiringSoon) {
      try {
        await sendExpiryWarningEmail(
          sub.company.email,
          sub.company.name,
          sub.plan.name,
          sub.currentPeriodEnd,
          renewUrl
        );
        warningSent++;
      } catch (err) {
        errors.push(`Warning email failed for ${sub.company.email}: ${String(err)}`);
      }
    }

    // ── 2. Find expired subscriptions ──────────────────────────────────────
    const expired = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lt: now },
      },
      include: {
        company: { select: { email: true, name: true } },
      },
    });

    if (expired.length > 0) {
      // Batch update status to EXPIRED
      await prisma.subscription.updateMany({
        where: {
          id: { in: expired.map((s) => s.id) },
          status: "ACTIVE",
        },
        data: { status: "EXPIRED" },
      });

      for (const sub of expired) {
        try {
          await sendExpiryNotificationEmail(
            sub.company.email,
            sub.company.name,
            renewUrl
          );
          expiredCount++;
        } catch (err) {
          errors.push(`Expiry notification failed for ${sub.company.email}: ${String(err)}`);
        }
      }
    }

    logger.info(`Cron check-subscriptions: warningSent=${warningSent}, expired=${expiredCount}`);

    res.json({
      success: true,
      warningSent,
      expiredCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    logger.error("Cron check-subscriptions error", { err });
    res.status(500).json({ message: "Cron job failed", error: String(err) });
  }
});

export default router;
