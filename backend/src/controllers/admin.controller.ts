import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

export const createAdminValidation = [
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("role").isIn(["super_admin", "viewer"]),
];

function formatAdmin(admin: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    enabled: admin.isActive,
    lastLogin: admin.lastLoginAt?.toISOString() || admin.createdAt.toISOString(),
  };
}

export async function getAdmins(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    const admins = await prisma.admin.findMany({
      where: companyId ? { companyId } : { companyId: null },
      orderBy: { createdAt: "asc" },
    });
    res.json(admins.map(formatAdmin));
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(
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

    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: string;
    };
    const companyId = req.admin?.companyId ?? null;

    const existing = await prisma.admin.findFirst({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const admin = await prisma.admin.create({
      data: { name, email, password: hashed, role, isActive: true, companyId },
    });

    res.status(201).json(formatAdmin(admin));
  } catch (err) {
    next(err);
  }
}

export async function updateAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const companyId = req.admin?.companyId;

    // Verify admin belongs to this company
    const target = await prisma.admin.findFirst({
      where: { id, ...(companyId ? { companyId } : { companyId: null }) },
    });
    if (!target) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    // Prevent self-demotion
    if (id === req.admin!.id && req.body.role && req.body.role !== "super_admin") {
      res.status(400).json({ message: "Cannot change your own role" });
      return;
    }

    const { name, email, role, password } = req.body as Partial<{
      name: string;
      email: string;
      role: string;
      password: string;
    }>;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.update({
      where: { id },
      data: updateData,
    });

    res.json(formatAdmin(admin));
  } catch (err) {
    next(err);
  }
}

export async function deleteAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const companyId = req.admin?.companyId;

    if (id === req.admin!.id) {
      res.status(400).json({ message: "Cannot delete your own account" });
      return;
    }

    // Verify admin belongs to this company
    const target = await prisma.admin.findFirst({
      where: { id, ...(companyId ? { companyId } : { companyId: null }) },
      select: { id: true },
    });
    if (!target) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    await prisma.admin.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function toggleAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const companyId = req.admin?.companyId;

    if (id === req.admin!.id) {
      res.status(400).json({ message: "Cannot disable your own account" });
      return;
    }

    const admin = await prisma.admin.findFirst({
      where: { id, ...(companyId ? { companyId } : { companyId: null }) },
    });
    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: { isActive: !admin.isActive },
    });

    res.json(formatAdmin(updated));
  } catch (err) {
    next(err);
  }
}
