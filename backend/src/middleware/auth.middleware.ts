import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string | null;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration: missing token secret" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      id: string;
      role: string;
      companyId: string | null;
      type?: string;
      iat: number;
      exp: number;
    };

    if (decoded.type && decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        companyId: true,
        company: {
          select: {
            emailVerified: true,
            subscription: {
              select: {
                status: true,
                currentPeriodEnd: true,
              },
            },
          },
        },
      },
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({ message: "Account not found or disabled" });
      return;
    }

    // Company tenant admin checks (companyId=null means platform admin — no checks needed)
    if (admin.companyId && admin.company) {
      if (!admin.company.emailVerified) {
        res.status(401).json({ message: "Email verification required before accessing the dashboard" });
        return;
      }

      const sub = admin.company.subscription;
      if (!sub || sub.status !== "ACTIVE" || sub.currentPeriodEnd < new Date()) {
        res.status(403).json({
          message: "Subscription expired or inactive. Please renew your subscription.",
          code: "SUBSCRIPTION_EXPIRED",
        });
        return;
      }
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      companyId: admin.companyId,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Token expired" });
    } else {
      res.status(401).json({ message: "Invalid token" });
    }
  }
}
