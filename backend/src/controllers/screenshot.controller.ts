import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

function formatScreenshot(s: {
  id: string;
  employeeId: string;
  imageUrl: string;
  appName: string;
  windowTitle: string;
  timestamp: Date;
  employee: { name: string; avatar: string | null; department: string };
}) {
  return {
    id: s.id,
    employeeId: s.employeeId,
    employeeName: s.employee.name,
    avatar: s.employee.avatar || "",
    imageUrl: s.imageUrl,
    timestamp: s.timestamp.toISOString(),
    app: s.appName,
    windowTitle: s.windowTitle,
    department: s.employee.department,
  };
}

export async function getScreenshots(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      employeeId,
      department,
      date,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const companyId = req.admin?.companyId;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;

    if (employeeId) {
      where.employeeId = employeeId;
    } else if (department) {
      where.employee = { department, ...(companyId ? { companyId } : {}) };
    }

    if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.timestamp = { gte: start, lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const screenshots = await prisma.screenshot.findMany({
      where,
      include: {
        employee: { select: { name: true, avatar: true, department: true } },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: Number(limit),
    });

    res.json(screenshots.map(formatScreenshot));
  } catch (err) {
    next(err);
  }
}
