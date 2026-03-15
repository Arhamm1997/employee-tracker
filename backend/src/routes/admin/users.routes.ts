import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import { hashPassword } from "../../lib/bcrypt";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

const createUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "viewer"]).default("viewer"),
  permissions: z.array(z.string()).default([]),
});

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get("/", async (_req: AdminRequest, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      where: { companyId: null }, // master admins only
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const data = admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      isActive: a.isActive,
      permissions: [],
      lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("Admin users list error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch admin users" });
  }
});

// ── POST /admin/users ─────────────────────────────────────────────────────────
router.post("/", async (req: AdminRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const { name, email, password, role } = parsed.data;

  try {
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already in use" });
    }

    const hashed = await hashPassword(password);
    const admin = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        isActive: true,
        companyId: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: { ...admin, permissions: [], createdAt: admin.createdAt.toISOString() },
    });
  } catch (err) {
    logger.error("Create admin user error", { err });
    return res.status(500).json({ success: false, error: "Failed to create admin user" });
  }
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req: AdminRequest, res: Response) => {
  if (req.params.id === req.admin?.id) {
    return res.status(400).json({ success: false, error: "Cannot delete your own account" });
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!admin || admin.companyId !== null) {
      return res.status(404).json({ success: false, error: "Admin not found" });
    }

    await prisma.admin.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: "Admin user deleted" });
  } catch (err) {
    logger.error("Delete admin user error", { err });
    return res.status(500).json({ success: false, error: "Failed to delete admin user" });
  }
});

// ── PATCH /admin/users/:id/toggle ────────────────────────────────────────────
router.patch("/:id/toggle", async (req: AdminRequest, res: Response) => {
  try {
    const admin = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!admin || admin.companyId !== null) {
      return res.status(404).json({ success: false, error: "Admin not found" });
    }

    const updated = await prisma.admin.update({
      where: { id: req.params.id },
      data: { isActive: !admin.isActive },
    });

    return res.json({ success: true, data: { isActive: updated.isActive } });
  } catch (err) {
    logger.error("Toggle admin user error", { err });
    return res.status(500).json({ success: false, error: "Failed to toggle admin user" });
  }
});

export default router;
