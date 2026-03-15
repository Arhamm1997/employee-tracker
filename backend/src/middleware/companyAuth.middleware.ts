import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface CompanyRequest extends Request {
  company?: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    planId?: string;
  };
}

export async function authenticateCompany(
  req: CompanyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.COMPANY_JWT_SECRET!) as {
      companyId: string;
      email: string;
      planId?: string;
    };

    const company = await prisma.company.findUnique({
      where: { id: decoded.companyId },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!company) {
      res.status(401).json({ message: "Company not found" });
      return;
    }

    req.company = {
      id: company.id,
      email: company.email,
      name: company.name,
      emailVerified: company.emailVerified,
      planId: decoded.planId,
    };

    // ── EXPIRING_SOON warning header ─────────────────────────────────────────
    // Check subscription expiry and add warning header if ≤ 7 days remaining
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId: company.id },
        select: { status: true, currentPeriodEnd: true },
      });

      if (subscription && subscription.status === "ACTIVE") {
        const now = new Date();
        const msLeft = subscription.currentPeriodEnd.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

        if (daysLeft <= 7 && daysLeft > 0) {
          res.setHeader("X-Subscription-Warning", `EXPIRING_SOON:${daysLeft}`);
        } else if (daysLeft <= 0) {
          res.setHeader("X-Subscription-Warning", "EXPIRED");
        }
      }
    } catch {
      // Non-blocking — don't fail the request if subscription check fails
    }

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Token expired" });
    } else {
      res.status(401).json({ message: "Invalid token" });
    }
  }
}

export function requireEmailVerified(
  req: CompanyRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.company?.emailVerified) {
    res.status(403).json({ message: "Email verification required before this action" });
    return;
  }
  next();
}
