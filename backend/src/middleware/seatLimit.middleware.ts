import { NextFunction, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "./auth.middleware";
import logger from "../lib/logger";

export async function checkEmployeeSeatLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  const companyId = req.admin?.companyId;

  // Platform admins (no companyId) bypass seat checks
  if (!companyId) {
    next();
    return;
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(403).json({
        success: false,
        error: "No subscription plan configured",
        code: "NO_PLAN_CONFIGURED",
      });
    }

    // maxSeats = -1 means unlimited
    if (subscription.plan.maxSeats === -1) {
      next();
      return;
    }

    const employeeCount = await prisma.employee.count({
      where: { companyId, isActive: true },
    });

    if (employeeCount >= subscription.plan.maxSeats) {
      return res.status(400).json({
        success: false,
        error: "Seat limit reach ho gayi, upgrade karein",
        code: "EMPLOYEE_SEAT_LIMIT",
        upgrade_needed: true,
      });
    }

    next();
  } catch (error) {
    logger.error("checkEmployeeSeatLimit error", { error });
    return res.status(500).json({
      success: false,
      error: "Failed to check employee seat limit",
      code: "EMPLOYEE_SEAT_CHECK_FAILED",
    });
  }
}
