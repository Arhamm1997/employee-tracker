import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { verifySlackSignature } from "../lib/slack-utils";
import * as slackService from "../services/slack.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { handleIncomingSlackMessage } from "../services/slack.service";

// ─── Company: Get OAuth URL ────────────────────────────────────────────────────

export async function getOAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.admin!.companyId!;
  // Use a state token to prevent CSRF
  const state = crypto.randomBytes(16).toString("hex") + "_" + companyId;
  const url = slackService.getSlackOAuthUrl(state);
  res.json({ url });
}

// ─── Company: OAuth Callback (Slack redirects here) ───────────────────────────

export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  if (error || !code || !state) {
    res.redirect(`${frontendUrl}/dashboard/settings?tab=integrations&slack=error`);
    return;
  }

  // Extract companyId from state (format: <random>_<companyId>)
  const parts = state.split("_");
  const companyId = parts[parts.length - 1];

  if (!companyId) {
    res.redirect(`${frontendUrl}/dashboard/settings?tab=integrations&slack=error`);
    return;
  }

  try {
    const { teamName } = await slackService.exchangeOAuthCode(code, companyId);
    res.redirect(`${frontendUrl}/dashboard/settings?tab=integrations&slack=success&team=${encodeURIComponent(teamName)}`);
  } catch (err) {
    logger.error("Slack OAuth callback error:", err);
    res.redirect(`${frontendUrl}/dashboard/settings?tab=integrations&slack=error`);
  }
}

// ─── Company: Get integration status ──────────────────────────────────────────

export async function getIntegrationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const integration = await prisma.slackIntegration.findUnique({
      where: { companyId },
      select: { id: true, teamId: true, teamName: true, botUserId: true, isActive: true, installedAt: true },
    });

    if (!integration || !integration.isActive) {
      res.json({ connected: false });
      return;
    }

    res.json({ connected: true, integration });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Disconnect ───────────────────────────────────────────────────────

export async function disconnectIntegration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    await slackService.disconnectSlack(companyId);
    res.json({ success: true, message: "Slack workspace disconnected" });
  } catch (err) {
    next(err);
  }
}

// ─── Company: List channels ────────────────────────────────────────────────────

export async function listChannels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const channels = await slackService.listSlackChannels(companyId);
    res.json({ channels });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Update Slack settings ───────────────────────────────────────────

export async function updateSlackSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const body = req.body as {
      slackEnabled?: boolean;
      slackChannelId?: string;
      slackAlertTypes?: string[];
      slackThreadReplies?: boolean;
    };

    const existing = await prisma.settings.findFirst({ where: { companyId } });

    const data: Record<string, unknown> = {};
    if (body.slackEnabled !== undefined) data.slackEnabled = body.slackEnabled;
    if (body.slackChannelId !== undefined) data.slackChannelId = body.slackChannelId;
    if (body.slackAlertTypes !== undefined) data.slackAlertTypes = body.slackAlertTypes;
    if (body.slackThreadReplies !== undefined) data.slackThreadReplies = body.slackThreadReplies;

    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.settings.create({
        data: {
          companyId,
          blockedSites: [],
          productiveApps: [],
          nonProductiveApps: [],
          neutralApps: [],
          alertEmails: [],
          slackAlertTypes: [],
          ...data,
        },
      });
    }

    res.json({ success: true, message: "Slack settings updated" });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Get Slack settings ──────────────────────────────────────────────

export async function getSlackSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const settings = await prisma.settings.findFirst({
      where: { companyId },
      select: { slackEnabled: true, slackChannelId: true, slackAlertTypes: true, slackThreadReplies: true },
    });

    res.json({
      slackEnabled: settings?.slackEnabled ?? false,
      slackChannelId: settings?.slackChannelId ?? null,
      slackAlertTypes: settings?.slackAlertTypes ?? [],
      slackThreadReplies: settings?.slackThreadReplies ?? true,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Send test alert ──────────────────────────────────────────────────

export async function sendTestAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { channelId } = req.body as { channelId?: string };

    const settings = await prisma.settings.findFirst({ where: { companyId } });
    const targetChannel = channelId || settings?.slackChannelId;

    if (!targetChannel) {
      res.status(400).json({ message: "No channel configured. Please select a channel first." });
      return;
    }

    await slackService.sendTestAlert(companyId, targetChannel);
    res.json({ success: true, message: "Test alert sent to Slack!" });
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(400).json({ message: err.message });
    } else {
      next(err);
    }
  }
}

// ─── Company: Send DM to employee ─────────────────────────────────────────────

export async function sendDirectMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { employeeId } = req.params;
    const { message } = req.body as { message: string };

    if (!message?.trim()) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { email: true, name: true },
    });

    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const result = await slackService.sendDirectMessageToEmployee({
      companyId,
      employeeEmail: employee.email,
      employeeId,
      message: message.trim(),
    });

    res.json({ success: true, slackTs: result.slackTs, slackUserId: result.slackUserId });
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(400).json({ message: err.message });
    } else {
      next(err);
    }
  }
}

// ─── Company: Mark Slack message as read ─────────────────────────────────────

export async function markMessageRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messageId } = req.params;
    const companyId = req.admin!.companyId!;

    // Verify it belongs to this company's integration
    const integration = await prisma.slackIntegration.findUnique({ where: { companyId } });
    if (!integration) {
      res.status(404).json({ message: "No Slack integration found" });
      return;
    }

    await prisma.slackMessage.updateMany({
      where: { id: messageId, integrationId: integration.id },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Reply to an alert's Slack thread ────────────────────────────────

export async function replyToAlertThread(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { alertId } = req.params;
    const { message } = req.body as { message?: string };

    if (!message?.trim()) {
      res.status(400).json({ message: "Message cannot be empty" });
      return;
    }

    await slackService.replyToAlertThread({ companyId, alertId, message: message.trim() });
    res.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(400).json({ message: err.message });
    } else {
      next(err);
    }
  }
}

// ─── Company: Get Slack messages for an alert ─────────────────────────────────

export async function getAlertSlackMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { alertId } = req.params;

    const integration = await prisma.slackIntegration.findUnique({ where: { companyId } });
    if (!integration) {
      res.json({ messages: [] });
      return;
    }

    const messages = await prisma.slackMessage.findMany({
      where: { integrationId: integration.id, alertId },
      orderBy: { createdAt: "asc" },
    });

    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

// ─── Webhook: Handle incoming events from Slack ────────────────────────────────

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
  const signature = req.headers["x-slack-signature"] as string || "";
  const timestamp = req.headers["x-slack-request-timestamp"] as string || "";
  const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);

  // Verify Slack signature
  if (signingSecret && !verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = req.body as SlackWebhookPayload;

  // Slack URL verification challenge
  if (payload.type === "url_verification") {
    res.json({ challenge: payload.challenge });
    return;
  }

  // Acknowledge immediately — process async
  res.json({ ok: true });

  if (payload.type === "event_callback") {
    const event = payload.event;

    // Only process messages that are NOT from bots (to avoid loops)
    if (event?.type === "message" && !event.bot_id && !event.subtype) {
      handleIncomingSlackMessage({
        teamId: payload.team_id,
        channelId: event.channel,
        slackUserId: event.user,
        slackUserName: event.username || event.user,
        text: event.text || "",
        ts: event.ts,
        threadTs: event.thread_ts,
      }).catch((err) => logger.error("Webhook message processing error:", err));
    }
  }
}

interface SlackWebhookPayload {
  type: string;
  challenge?: string;
  team_id: string;
  event?: {
    type: string;
    channel: string;
    user: string;
    username?: string;
    text?: string;
    ts: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
  };
}

// ─── Admin: Get all Slack integrations (master admin) ─────────────────────────

export async function adminGetAllIntegrations(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const integrations = await prisma.slackIntegration.findMany({
      include: { company: { select: { id: true, name: true, email: true } } },
      orderBy: { installedAt: "desc" },
    });

    res.json({
      integrations: integrations.map((i) => ({
        id: i.id,
        companyId: i.companyId,
        companyName: i.company.name,
        companyEmail: i.company.email,
        teamId: i.teamId,
        teamName: i.teamName,
        isActive: i.isActive,
        installedAt: i.installedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Force disconnect a company's Slack ────────────────────────────────

export async function adminForceDisconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { integrationId } = req.params;
    const integration = await prisma.slackIntegration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      res.status(404).json({ message: "Integration not found" });
      return;
    }
    await slackService.disconnectSlack(integration.companyId);
    res.json({ success: true, message: "Slack integration disconnected" });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Toggle slack feature on a plan ────────────────────────────────────

export async function adminTogglePlanSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { planId } = req.params;
    const { enabled } = req.body as { enabled: boolean };

    await prisma.plan.update({ where: { id: planId }, data: { slackEnabled: enabled } });
    res.json({ success: true, message: `Slack ${enabled ? "enabled" : "disabled"} for plan` });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Get all plans with slack status ────────────────────────────────────

export async function adminGetPlansSlackStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plans = await prisma.plan.findMany({
      select: { id: true, name: true, slackEnabled: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ plans });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Get all Slack DM conversations (per employee) ───────────────────
// Returns list of employees who have Slack DM history, with last message + unread count

export async function getSlackConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { q } = req.query as Record<string, string>;

    const integration = await prisma.slackIntegration.findUnique({
      where: { companyId },
      select: { id: true, isActive: true },
    });

    if (!integration || !integration.isActive) {
      res.json({ connected: false, conversations: [] });
      return;
    }

    // Get all DM messages grouped by employeeId (only messages that have an employeeId)
    const grouped = await prisma.slackMessage.groupBy({
      by: ["employeeId"],
      where: {
        integrationId: integration.id,
        employeeId: { not: null },
      },
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: "desc" } },
    });

    if (grouped.length === 0) {
      res.json({ connected: true, conversations: [] });
      return;
    }

    // Fetch employee details
    const employeeIds = grouped.map(g => g.employeeId!).filter(Boolean);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, companyId },
      select: { id: true, name: true, email: true, department: true, avatar: true, lastSeenAt: true },
    });
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Fetch last message + unread count per employee
    const results = await Promise.all(
      grouped
        .filter(g => empMap.has(g.employeeId!))
        .map(async g => {
          const emp = empMap.get(g.employeeId!)!;

          // Apply search filter
          if (q) {
            const search = q.toLowerCase();
            if (!emp.name.toLowerCase().includes(search) && !emp.email.toLowerCase().includes(search)) {
              return null;
            }
          }

          const [lastMsg, unreadCount] = await Promise.all([
            prisma.slackMessage.findFirst({
              where: { integrationId: integration.id, employeeId: g.employeeId! },
              orderBy: { createdAt: "desc" },
              select: { content: true, direction: true, createdAt: true },
            }),
            prisma.slackMessage.count({
              where: { integrationId: integration.id, employeeId: g.employeeId!, direction: "inbound", isRead: false },
            }),
          ]);

          return {
            employee: emp,
            lastMessage: lastMsg?.content ?? null,
            lastMessageDirection: lastMsg?.direction ?? null,
            lastSentAt: lastMsg?.createdAt ?? null,
            unreadCount,
            totalMessages: g._count.id,
          };
        })
    );

    const filtered = results.filter(Boolean);
    res.json({ connected: true, conversations: filtered });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Get Slack DM messages with a specific employee ──────────────────

export async function getSlackEmployeeMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { employeeId } = req.params;
    const { page = "1" } = req.query as Record<string, string>;
    const PAGE_SIZE = 50;
    const pageNum = Math.max(1, Number(page));

    const integration = await prisma.slackIntegration.findUnique({
      where: { companyId },
      select: { id: true, isActive: true },
    });

    if (!integration || !integration.isActive) {
      res.status(400).json({ message: "Slack not connected" });
      return;
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, email: true, department: true, avatar: true, lastSeenAt: true },
    });
    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const [messages, total] = await Promise.all([
      prisma.slackMessage.findMany({
        where: { integrationId: integration.id, employeeId },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip: (pageNum - 1) * PAGE_SIZE,
        select: {
          id: true, direction: true, content: true, slackUserId: true,
          slackUserName: true, isRead: true, createdAt: true,
        },
      }),
      prisma.slackMessage.count({ where: { integrationId: integration.id, employeeId } }),
    ]);

    // Mark all inbound messages as read
    await prisma.slackMessage.updateMany({
      where: { integrationId: integration.id, employeeId, direction: "inbound", isRead: false },
      data: { isRead: true },
    });

    res.json({
      employee,
      messages: messages.reverse(), // chronological
      total,
      page: pageNum,
      pages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    next(err);
  }
}

