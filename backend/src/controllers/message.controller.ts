import { Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { broadcast } from "../lib/websocket";
// broadcast(type, data) — sends { type, data } to all connected WS clients

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sendSchema = z.object({
  employeeId: z.string().min(1),
  content: z.string().min(1, "Message cannot be empty").max(5000),
});

const replySchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertCompanyId(req: AuthRequest, res: Response): string | null {
  const id = req.admin?.companyId ?? null;
  if (!id) {
    res.status(403).json({ message: "Company context required" });
    return null;
  }
  return id;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /api/messages/conversations — list all conversations for this company/admin */
export async function getConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = assertCompanyId(req, res);
    if (!companyId) return;
    const adminId = req.admin!.id;
    const { q } = req.query as Record<string, string>;

    const conversations = await prisma.conversation.findMany({
      where: {
        companyId,
        adminId,
        ...(q ? {
          // filter by employee name via a subquery join
        } : {}),
      },
      orderBy: { lastSentAt: "desc" },
      include: {
        messages: {
          where: { isRead: false, senderRole: "employee" },
          select: { id: true },
        },
      },
    });

    // Fetch employee details for each conversation
    const employeeIds = conversations.map(c => c.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, email: true, department: true, avatar: true, lastSeenAt: true },
    });
    const empMap = new Map(employees.map(e => [e.id, e]));

    const result = conversations
      .filter(c => {
        if (!q) return true;
        const emp = empMap.get(c.employeeId);
        if (!emp) return false;
        const search = q.toLowerCase();
        return emp.name.toLowerCase().includes(search) || emp.email.toLowerCase().includes(search);
      })
      .map(c => {
        const emp = empMap.get(c.employeeId);
        return {
          id: c.id,
          employee: emp ?? null,
          lastMessage: c.lastMessage,
          lastSentAt: c.lastSentAt,
          unreadCount: c.messages.length,
          createdAt: c.createdAt,
        };
      });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** GET /api/messages/:conversationId — get a conversation with recent messages */
export async function getConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = assertCompanyId(req, res);
    if (!companyId) return;
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId, adminId: req.admin!.id },
    });
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const PAGE_SIZE = 50;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip: (pageNum - 1) * PAGE_SIZE,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    const employee = await prisma.employee.findUnique({
      where: { id: conversation.employeeId },
      select: { id: true, name: true, email: true, department: true, avatar: true, lastSeenAt: true },
    });

    res.json({
      conversation: {
        id: conversation.id,
        employee,
        lastMessage: conversation.lastMessage,
        lastSentAt: conversation.lastSentAt,
        createdAt: conversation.createdAt,
      },
      messages: messages.reverse(), // chronological order
      total,
      page: pageNum,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/messages — send a new message (creates conversation if needed) */
export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = assertCompanyId(req, res);
    if (!companyId) return;

    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Validation error" });
      return;
    }
    const { employeeId, content } = parsed.data;
    const adminId = req.admin!.id;
    const adminName = req.admin!.name;

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true },
    });
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    // Upsert conversation
    const conversation = await prisma.conversation.upsert({
      where: { adminId_employeeId: { adminId, employeeId } },
      create: { companyId, adminId, employeeId, lastMessage: content, lastSentAt: new Date() },
      update: { lastMessage: content, lastSentAt: new Date() },
    });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderRole: "admin",
        senderId: adminId,
        senderName: adminName,
        content,
      },
    });

    // Broadcast via WebSocket to any connected client subscribed to this conversation
    broadcast("new_message", {
      conversationId: conversation.id,
      message: {
        id: message.id,
        senderRole: message.senderRole,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt,
      },
      employeeId,
      employeeName: employee.name,
    });

    res.status(201).json({ message, conversation });
  } catch (err) {
    next(err);
  }
}

/** POST /api/messages/:conversationId/reply — reply in an existing conversation */
export async function replyMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = assertCompanyId(req, res);
    if (!companyId) return;
    const { conversationId } = req.params;

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Validation error" });
      return;
    }
    const { content } = parsed.data;
    const adminId = req.admin!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId, adminId },
    });
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderRole: "admin",
          senderId: adminId,
          senderName: req.admin!.name,
          content,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: content, lastSentAt: new Date() },
      }),
    ]);

    broadcast("new_message", {
      conversationId,
      message: {
        id: message.id,
        senderRole: message.senderRole,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt,
      },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/messages/:conversationId/read — mark all unread messages in a conversation as read */
export async function markConversationRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = assertCompanyId(req, res);
    if (!companyId) return;
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId, adminId: req.admin!.id },
    });
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    await prisma.message.updateMany({
      where: { conversationId, isRead: false, senderRole: "employee" },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
