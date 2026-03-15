import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export async function requireAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Prefer Authorization header (Bearer access token), fallback to cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.admin_token;

  if (!token) {
    res.status(401).json({ success: false, error: "Admin authentication required" });
    return;
  }

  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ success: false, error: "JWT secret is not configured" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: string;
      companyId?: string | null;
      type?: string;
    };

    if (decoded.type && decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true },
    });

    // Only allow master admins (companyId = null)
    if (!admin || !admin.isActive || admin.companyId !== null) {
      res.status(401).json({ success: false, error: "Account not found or not a master admin" });
      return;
    }

    req.admin = { id: admin.id, email: admin.email, role: admin.role, name: admin.name };
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
