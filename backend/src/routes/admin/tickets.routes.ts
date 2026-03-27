import { Router, Response } from "express";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import prisma from "../../lib/prisma";

const router = Router();
router.use(requireAdmin);

function formatTicket(t: {
  id: string;
  companyId: string;
  company: { name: string };
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies: Array<{
    id: string;
    ticketId: string;
    adminId: string | null;
    companyId: string | null;
    message: string;
    isInternal: boolean;
    createdAt: Date;
  }>;
}) {
  return {
    id: t.id,
    customerId: t.companyId,
    companyName: t.company.name,
    subject: t.subject,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assignedTo: t.assignedTo ?? undefined,
    replies: t.replies.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      adminId: r.adminId ?? undefined,
      companyId: r.companyId ?? undefined,
      message: r.message,
      isInternal: r.isInternal,
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// ── GET /admin/tickets ────────────────────────────────────────────────────────
router.get("/", async (req: AdminRequest, res: Response) => {
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const { priority, status } = req.query as Record<string, string>;

  const where: Record<string, string> = {};
  if (priority && priority !== "all") where.priority = priority;
  if (status && status !== "all") where.status = status;

  try {
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { company: { select: { name: true } }, replies: true },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        data: tickets.map(formatTicket),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("tickets list error", err);
    return res.status(500).json({ success: false, error: "Failed to fetch tickets" });
  }
});

// ── GET /admin/tickets/:id ────────────────────────────────────────────────────
router.get("/:id", async (req: AdminRequest, res: Response) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { company: { select: { name: true } }, replies: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
    return res.json({ success: true, data: formatTicket(ticket) });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch ticket" });
  }
});

// ── POST /admin/tickets/:id/reply ─────────────────────────────────────────────
router.post("/:id/reply", async (req: AdminRequest, res: Response) => {
  const { message, isInternal } = req.body as { message?: string; isInternal?: boolean };
  if (!message) return res.status(400).json({ success: false, error: "message is required" });

  try {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });

    const reply = await prisma.ticketReply.create({
      data: {
        ticketId: req.params.id,
        adminId: req.admin?.id ?? null,
        message,
        isInternal: isInternal ?? false,
      },
    });

    // Auto move to in_progress if open
    if (ticket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: req.params.id },
        data: { status: "in_progress" },
      });
    }

    return res.json({ success: true, data: reply });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to send reply" });
  }
});

// ── POST /admin/tickets/:id/assign ────────────────────────────────────────────
router.post("/:id/assign", async (req: AdminRequest, res: Response) => {
  const { adminId } = req.body as { adminId?: string };
  try {
    await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { assignedTo: adminId === "unassigned" ? null : (adminId ?? null) },
    });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to assign ticket" });
  }
});

// ── PATCH /admin/tickets/:id/status ──────────────────────────────────────────
router.patch("/:id/status", async (req: AdminRequest, res: Response) => {
  const { status } = req.body as { status?: string };
  if (!status) return res.status(400).json({ success: false, error: "status is required" });
  try {
    await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

export default router;
