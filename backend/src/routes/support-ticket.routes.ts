import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";

const router = Router();
router.use(authenticate);

// POST /api/support/tickets — company submits ticket
router.post("/tickets", async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) return res.status(401).json({ message: "Unauthorized" });

  const { subject, description, priority } = req.body as {
    subject?: string;
    description?: string;
    priority?: string;
  };

  if (!subject || !description) {
    return res.status(400).json({ message: "subject and description are required" });
  }

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        companyId,
        subject,
        description,
        priority: priority ?? "medium",
      },
    });
    return res.json({ success: true, ticket });
  } catch (err) {
    console.error("create ticket error", err);
    return res.status(500).json({ message: "Failed to create ticket" });
  }
});

// GET /api/support/tickets — company views their own tickets
router.get("/tickets", async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        replies: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return res.json({ tickets });
  } catch {
    return res.status(500).json({ message: "Failed to fetch tickets" });
  }
});

// GET /api/support/tickets/:id — get single ticket with replies
router.get("/tickets/:id", async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        replies: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    return res.json({ ticket });
  } catch {
    return res.status(500).json({ message: "Failed to fetch ticket" });
  }
});

// POST /api/support/tickets/:id/reply — company replies to ticket
router.post("/tickets/:id/reply", async (req: AuthRequest, res: Response) => {
  const companyId = req.admin?.companyId;
  if (!companyId) return res.status(401).json({ message: "Unauthorized" });

  const { message } = req.body as { message?: string };
  if (!message) return res.status(400).json({ message: "message is required" });

  try {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id, companyId } });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const reply = await prisma.ticketReply.create({
      data: { ticketId: req.params.id, companyId, message, isInternal: false },
    });

    // Reopen if resolved/closed
    if (ticket.status === "resolved" || ticket.status === "closed") {
      await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status: "open" } });
    }

    return res.json({ success: true, reply });
  } catch {
    return res.status(500).json({ message: "Failed to send reply" });
  }
});

export default router;
