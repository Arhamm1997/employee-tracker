import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";

const router = Router();

// POST /api/upgrade-request — company submits upgrade request
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { planId, note } = req.body as { planId?: string; note?: string };
  if (!planId) {
    return res.status(400).json({ message: "planId is required" });
  }

  try {
    // Check plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Cancel any existing pending request first
    await prisma.planUpgradeRequest.updateMany({
      where: { companyId, status: "pending" },
      data: { status: "cancelled" },
    });

    const request = await prisma.planUpgradeRequest.create({
      data: { companyId, requestedPlanId: planId, note: note ?? null },
      include: { requestedPlan: true },
    });

    return res.json({ success: true, request });
  } catch (err) {
    console.error("upgrade-request error", err);
    return res.status(500).json({ message: "Failed to submit upgrade request" });
  }
});

// GET /api/upgrade-request/status — check company's pending request
router.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const pending = await prisma.planUpgradeRequest.findFirst({
      where: { companyId, status: "pending" },
      include: { requestedPlan: { select: { id: true, name: true, priceMonthly: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ pending });
  } catch {
    return res.status(500).json({ message: "Failed to fetch request status" });
  }
});

export default router;
