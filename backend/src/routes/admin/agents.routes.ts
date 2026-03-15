import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import logger from "../../lib/logger";

const router = Router();
router.use(requireAdmin);

// ── GET /admin/agents/stats ───────────────────────────────────────────────────
router.get("/stats", async (_req: AdminRequest, res: Response) => {
  try {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const [total, online, idle] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.employee.count({ where: { isActive: true, lastSeenAt: { gte: twoMinsAgo } } }),
      prisma.employee.count({
        where: { isActive: true, lastSeenAt: { gte: fifteenMinsAgo, lt: twoMinsAgo } },
      }),
    ]);

    const offline = Math.max(0, total - online - idle);

    return res.json({ success: true, data: { total, online, offline, idle } });
  } catch (err) {
    logger.error("Agent stats error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch agent stats" });
  }
});

// ── GET /admin/agents ─────────────────────────────────────────────────────────
router.get("/", async (req: AdminRequest, res: Response) => {
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const skip = (page - 1) * pageSize;
  const status = req.query.status as string | undefined;

  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = { isActive: true };
    if (status === "online") {
      where.lastSeenAt = { gte: twoMinsAgo };
    } else if (status === "idle") {
      where.lastSeenAt = { gte: fifteenMinsAgo, lt: twoMinsAgo };
    } else if (status === "offline") {
      where = {
        isActive: true,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: fifteenMinsAgo } }],
      };
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          employeeCode: true,
          name: true,
          department: true,
          lastSeenAt: true,
          agentVersion: true,
        },
      }),
      prisma.employee.count({ where }),
    ]);

    const data = employees.map((e) => {
      let agentStatus: "online" | "offline" | "idle";
      if (!e.lastSeenAt || e.lastSeenAt < fifteenMinsAgo) {
        agentStatus = "offline";
      } else if (e.lastSeenAt >= twoMinsAgo) {
        agentStatus = "online";
      } else {
        agentStatus = "idle";
      }

      return {
        id: e.id,
        machineId: e.employeeCode,
        companyName: e.department,
        employeeName: e.name,
        status: agentStatus,
        lastSeen: e.lastSeenAt?.toISOString() ?? new Date(0).toISOString(),
        ipAddress: "—",
        version: e.agentVersion ?? "—",
        os: "Windows",
      };
    });

    return res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    logger.error("Agent list error", { err });
    return res.status(500).json({ success: false, error: "Failed to fetch agents" });
  }
});

export default router;
