import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { broadcastAlertCount } from "../lib/websocket";
import { AuthRequest } from "../middleware/auth.middleware";

function formatAlert(alert: {
  id: string;
  type: string;
  severity: string;
  employeeId: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  employee: { name: string };
}) {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    employeeId: alert.employeeId,
    employeeName: alert.employee.name,
    message: alert.message,
    timestamp: alert.timestamp.toISOString(),
    read: alert.isRead,
  };
}

export async function getAlerts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { severity, type, isRead, employeeId, page = "1", limit = "50" } = req.query as Record<
      string,
      string
    >;
    const companyId = req.admin?.companyId;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (severity) where.severity = severity;
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead === "true";
    if (employeeId) where.employeeId = employeeId;

    const skip = (Number(page) - 1) * Number(limit);

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: { employee: { select: { name: true } } },
        orderBy: { timestamp: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.alert.count({ where }),
    ]);

    res.json(alerts.map(formatAlert));
  } catch (err) {
    next(err);
  }
}

export async function markAlertRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;

    // Verify alert belongs to this company
    const existing = await prisma.alert.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    const alert = await prisma.alert.update({
      where: { id: existing.id },
      data: { isRead: true },
      include: { employee: { select: { name: true } } },
    });

    await broadcastAlertCount();
    res.json(formatAlert(alert));
  } catch (err) {
    next(err);
  }
}

export async function markAllAlertsRead(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    await prisma.alert.updateMany({
      where: companyId ? { companyId } : {},
      data: { isRead: true },
    });
    await broadcastAlertCount();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteAlert(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId;

    // Verify alert belongs to this company
    const existing = await prisma.alert.findFirst({
      where: { id: req.params.id, ...(companyId ? { companyId } : {}) },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    await prisma.alert.delete({ where: { id: existing.id } });
    await broadcastAlertCount();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
