import https from "https";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { encryptToken, decryptToken, buildAlertBlocks } from "../lib/slack-utils";
import { broadcast } from "../lib/websocket";

// ─── Slack API helpers ─────────────────────────────────────────────────────────

function slackApiCall(
  method: string,
  token: string,
  params: Record<string, unknown>
): Promise<SlackApiResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const options: https.RequestOptions = {
      hostname: "slack.com",
      path: `/api/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data) as SlackApiResponse;
          resolve(parsed);
        } catch {
          reject(new Error("Invalid JSON from Slack API"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("Slack API request timed out"));
    });
    req.write(body);
    req.end();
  });
}

function slackGetCall(
  method: string,
  token: string,
  params: Record<string, string> = {}
): Promise<SlackApiResponse> {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(params).toString();
    const path = `/api/${method}${qs ? "?" + qs : ""}`;
    const options: https.RequestOptions = {
      hostname: "slack.com",
      path,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as SlackApiResponse);
        } catch {
          reject(new Error("Invalid JSON from Slack API"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("Slack API GET timed out"));
    });
    req.end();
  });
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  message?: { ts?: string };
  channel?: string | { id?: string };
  team?: { id: string; name: string } | string;
  user_id?: string;
  user?: { id: string; name?: string; profile?: { email?: string } };
  channels?: SlackChannelRaw[];
  members?: string[] | Array<{ id: string; deleted?: boolean; profile?: { email?: string } }>;
  permalink?: string;
}

interface SlackChannelRaw {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  is_member: boolean;
}

// ─── OAuth ─────────────────────────────────────────────────────────────────────

export function getSlackOAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.SLACK_REDIRECT_URI || "");
  const scopes = "chat:write,channels:read,channels:history,groups:read,groups:history,users:read,users:read.email,team:read,im:write,im:read,im:history,mpim:read";
  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
}

export async function exchangeOAuthCode(
  code: string,
  companyId: string
): Promise<{ teamName: string; teamId: string }> {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const clientSecret = process.env.SLACK_CLIENT_SECRET!;
  const redirectUri = process.env.SLACK_REDIRECT_URI!;

  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString();

  const response = await new Promise<SlackOAuthResponse>((resolve, reject) => {
    const reqBody = body;
    const options: https.RequestOptions = {
      hostname: "slack.com",
      path: "/api/oauth.v2.access",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(reqBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as SlackOAuthResponse);
        } catch {
          reject(new Error("Invalid JSON from Slack OAuth"));
        }
      });
    });

    req.on("error", reject);
    req.write(reqBody);
    req.end();
  });

  if (!response.ok) {
    throw new Error(`Slack OAuth failed: ${response.error}`);
  }

  const encryptedToken = encryptToken(response.access_token);

  await prisma.slackIntegration.upsert({
    where: { companyId },
    create: {
      companyId,
      teamId: response.team.id,
      teamName: response.team.name,
      botUserId: response.bot_user_id,
      botAccessToken: encryptedToken,
      isActive: true,
    },
    update: {
      teamId: response.team.id,
      teamName: response.team.name,
      botUserId: response.bot_user_id,
      botAccessToken: encryptedToken,
      isActive: true,
    },
  });

  logger.info(`Slack connected for company ${companyId}: workspace ${response.team.name}`);
  return { teamName: response.team.name, teamId: response.team.id };
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  bot_user_id: string;
  team: { id: string; name: string };
}

// ─── Channels ──────────────────────────────────────────────────────────────────

export interface SlackChannelInfo {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export async function listSlackChannels(companyId: string): Promise<SlackChannelInfo[]> {
  const integration = await getActiveIntegration(companyId);
  const token = decryptToken(integration.botAccessToken);

  const [pubResp, privResp] = await Promise.all([
    slackGetCall("conversations.list", token, { types: "public_channel", limit: "200", exclude_archived: "true" }),
    slackGetCall("conversations.list", token, { types: "private_channel", limit: "200", exclude_archived: "true" }),
  ]);

  const channels: SlackChannelInfo[] = [];

  for (const ch of (pubResp.channels || []) as SlackChannelRaw[]) {
    if (!ch.is_archived) channels.push({ id: ch.id, name: ch.name, isPrivate: false, isMember: ch.is_member });
  }
  for (const ch of (privResp.channels || []) as SlackChannelRaw[]) {
    if (!ch.is_archived) channels.push({ id: ch.id, name: ch.name, isPrivate: true, isMember: ch.is_member });
  }

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Send alert to Slack ───────────────────────────────────────────────────────

export async function sendAlertToSlack(opts: {
  alertId: string;
  companyId: string;
  alertType: string;
  employeeName: string;
  department: string;
  message: string;
  severity: string;
  timestamp: Date;
}): Promise<void> {
  try {
    const [integration, settings] = await Promise.all([
      prisma.slackIntegration.findUnique({ where: { companyId: opts.companyId } }),
      prisma.settings.findFirst({ where: { companyId: opts.companyId } }),
    ]);

    if (!integration?.isActive || !settings?.slackEnabled || !settings?.slackChannelId) return;

    // Check if this alert type is in the allowed list (empty list = all types)
    if (settings.slackAlertTypes.length > 0 && !settings.slackAlertTypes.includes(opts.alertType)) return;

    const token = decryptToken(integration.botAccessToken);
    const { blocks, text } = buildAlertBlocks(
      opts.alertType,
      opts.employeeName,
      opts.department,
      opts.message,
      opts.severity,
      opts.timestamp
    );

    const resp = await slackApiCall("chat.postMessage", token, {
      channel: settings.slackChannelId,
      text,
      blocks,
    });

    if (!resp.ok) {
      logger.warn(`Slack send failed for company ${opts.companyId}: ${resp.error}`);
      return;
    }

    const slackTs = resp.ts!;
    const threadTs = settings.slackThreadReplies ? slackTs : undefined;

    // Store the Slack message record
    const slackMsg = await prisma.slackMessage.create({
      data: {
        integrationId: integration.id,
        alertId: opts.alertId,
        channelId: settings.slackChannelId,
        slackTs,
        slackThreadTs: threadTs,
        direction: "outbound",
        content: opts.message,
      },
    });

    // Update alert with slack timestamps
    await prisma.alert.update({
      where: { id: opts.alertId },
      data: { slackTs, slackThreadTs: threadTs },
    });

    // Broadcast to frontend
    broadcast("slackMessage:new", {
      id: slackMsg.id,
      alertId: opts.alertId,
      direction: "outbound",
      content: opts.message,
      slackTs,
      createdAt: slackMsg.createdAt.toISOString(),
    });

    logger.debug(`Slack alert sent for company ${opts.companyId}, alertId=${opts.alertId}, ts=${slackTs}`);
  } catch (err) {
    logger.error("sendAlertToSlack error:", err);
  }
}

// ─── Resolve Slack user display name from user ID ─────────────────────────────

async function resolveSlackUserName(token: string, userId: string, fallback: string): Promise<string> {
  // If fallback already looks like a real name (not a Slack user ID), use it
  if (fallback && !/^U[A-Z0-9]{8,}$/.test(fallback)) return fallback;
  try {
    const resp = await slackGetCall("users.info", token, { user: userId });
    if (resp.ok && resp.user) {
      const u = resp.user as { real_name?: string; name?: string; profile?: { display_name?: string } };
      return u.profile?.display_name || u.real_name || u.name || fallback;
    }
  } catch {
    // ignore — return fallback
  }
  return fallback;
}

// ─── Handle incoming Slack message (webhook) ───────────────────────────────────

export async function handleIncomingSlackMessage(opts: {
  teamId: string;
  channelId: string;
  slackUserId: string;
  slackUserName: string;
  text: string;
  ts: string;
  threadTs?: string;
}): Promise<void> {
  try {
    const integration = await prisma.slackIntegration.findFirst({
      where: { teamId: opts.teamId, isActive: true },
    });

    if (!integration) return;

    // Resolve real display name (webhook only sends user ID in slackUserName)
    const token = decryptToken(integration.botAccessToken);
    const resolvedName = await resolveSlackUserName(token, opts.slackUserId, opts.slackUserName);

    // Find which alert this thread belongs to
    let alertId: string | undefined;
    if (opts.threadTs) {
      const parentMsg = await prisma.slackMessage.findFirst({
        where: { integrationId: integration.id, slackTs: opts.threadTs, direction: "outbound" },
        select: { alertId: true },
      });
      alertId = parentMsg?.alertId ?? undefined;
    }

    // Try to link to an employee by matching slackUserId from previous outbound DMs
    let linkedEmployeeId: string | undefined;
    if (!alertId) {
      const prev = await prisma.slackMessage.findFirst({
        where: { integrationId: integration.id, slackUserId: opts.slackUserId, employeeId: { not: null } },
        select: { employeeId: true },
        orderBy: { createdAt: "desc" },
      });
      linkedEmployeeId = prev?.employeeId ?? undefined;
    }

    const slackMsg = await prisma.slackMessage.create({
      data: {
        integrationId: integration.id,
        alertId,
        channelId: opts.channelId,
        slackTs: opts.ts,
        slackThreadTs: opts.threadTs,
        direction: "inbound",
        content: opts.text,
        slackUserId: opts.slackUserId,
        slackUserName: resolvedName,
        isRead: false,
        ...(linkedEmployeeId ? { employeeId: linkedEmployeeId } : {}),
      },
    });

    // Broadcast to frontend dashboards
    broadcast("slackMessage:new", {
      id: slackMsg.id,
      alertId,
      direction: "inbound",
      content: opts.text,
      slackUserId: opts.slackUserId,
      slackUserName: resolvedName,
      slackTs: opts.ts,
      slackThreadTs: opts.threadTs,
      createdAt: slackMsg.createdAt.toISOString(),
    });

    logger.debug(`Incoming Slack message from ${resolvedName} in team ${opts.teamId}`);
  } catch (err) {
    logger.error("handleIncomingSlackMessage error:", err);
  }
}

// ─── Send direct message to employee via Slack ─────────────────────────────────

export async function sendDirectMessageToEmployee(opts: {
  companyId: string;
  employeeEmail: string;
  employeeId?: string;
  message: string;
}): Promise<{ slackTs: string; slackUserId: string }> {
  const integration = await getActiveIntegration(opts.companyId);
  const token = decryptToken(integration.botAccessToken);

  // Look up user by email (primary), then fall back to users.list scan
  let slackUserId: string | undefined;

  const lookupResp = await slackGetCall("users.lookupByEmail", token, { email: opts.employeeEmail });
  if (lookupResp.ok && lookupResp.user) {
    slackUserId = (lookupResp.user as { id: string }).id;
  } else {
    // Fallback: scan all workspace members for a case-insensitive email match
    const listResp = await slackGetCall("users.list", token, { limit: "1000" });
    if (listResp.ok && Array.isArray(listResp.members)) {
      const needle = opts.employeeEmail.toLowerCase();
      const match = (listResp.members as Array<{ id: string; profile?: { email?: string }; deleted?: boolean }>)
        .find((m) => !m.deleted && m.profile?.email?.toLowerCase() === needle);
      if (match) slackUserId = match.id;
    }
  }

  if (!slackUserId) {
    throw new Error(
      `Employee ${opts.employeeEmail} not found in Slack workspace. ` +
      `Make sure their Slack account email matches exactly.`
    );
  }

  // Open DM channel
  const dmResp = await slackApiCall("conversations.open", token, { users: slackUserId });
  if (!dmResp.ok) throw new Error(`Failed to open DM: ${dmResp.error}`);

  const dmChannel = typeof dmResp.channel === "string" ? dmResp.channel : (dmResp.channel as { id?: string })?.id;
  if (!dmChannel) throw new Error("Could not determine DM channel ID");

  // Send message
  const msgResp = await slackApiCall("chat.postMessage", token, {
    channel: dmChannel,
    text: opts.message,
  });

  if (!msgResp.ok) throw new Error(`Failed to send DM: ${msgResp.error}`);

  const slackTs = msgResp.ts!;

  // Store the message
  const slackMsg = await prisma.slackMessage.create({
    data: {
      integrationId: integration.id,
      channelId: dmChannel,
      slackTs,
      direction: "outbound",
      content: opts.message,
      slackUserId,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
    },
  });

  broadcast("slackMessage:new", {
    id: slackMsg.id,
    direction: "outbound",
    content: opts.message,
    slackUserId,
    slackTs,
    createdAt: slackMsg.createdAt.toISOString(),
  });

  return { slackTs, slackUserId };
}

// ─── Reply to an alert thread ─────────────────────────────────────────────────

export async function replyToAlertThread(opts: {
  companyId: string;
  alertId: string;
  message: string;
}): Promise<void> {
  const integration = await getActiveIntegration(opts.companyId);
  const token = decryptToken(integration.botAccessToken);

  // Get the alert's Slack thread timestamp
  const alert = await prisma.alert.findUnique({
    where: { id: opts.alertId },
    select: { slackTs: true, slackThreadTs: true },
  });

  if (!alert?.slackTs) throw new Error("This alert was not sent to Slack or has no thread");

  const settings = await prisma.settings.findFirst({ where: { companyId: opts.companyId } });
  if (!settings?.slackChannelId) throw new Error("No Slack channel configured");

  const threadTs = alert.slackThreadTs || alert.slackTs;

  const resp = await slackApiCall("chat.postMessage", token, {
    channel: settings.slackChannelId,
    text: opts.message,
    thread_ts: threadTs,
  });

  if (!resp.ok) throw new Error(`Failed to send reply: ${resp.error}`);

  const slackMsg = await prisma.slackMessage.create({
    data: {
      integrationId: integration.id,
      alertId: opts.alertId,
      channelId: settings.slackChannelId,
      slackTs: resp.ts!,
      slackThreadTs: threadTs,
      direction: "outbound",
      content: opts.message,
    },
  });

  broadcast("slackMessage:new", {
    id: slackMsg.id,
    alertId: opts.alertId,
    direction: "outbound",
    content: opts.message,
    slackTs: resp.ts!,
    slackThreadTs: threadTs,
    createdAt: slackMsg.createdAt.toISOString(),
  });
}

// ─── Test connection ───────────────────────────────────────────────────────────

export async function testSlackConnection(companyId: string): Promise<{ ok: boolean; teamName?: string }> {
  try {
    const integration = await getActiveIntegration(companyId);
    const token = decryptToken(integration.botAccessToken);
    const resp = await slackGetCall("auth.test", token);
    const teamName = typeof resp.team === "string" ? resp.team : resp.team?.name;
    return { ok: resp.ok, teamName };
  } catch {
    return { ok: false };
  }
}

export async function sendTestAlert(companyId: string, channelId: string): Promise<void> {
  const integration = await getActiveIntegration(companyId);
  const token = decryptToken(integration.botAccessToken);

  const resp = await slackApiCall("chat.postMessage", token, {
    channel: channelId,
    text: "✅ Test alert from Employee Monitor — Slack integration is working!",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Test Alert*\nYour Slack integration is configured correctly. You will receive employee monitoring alerts here.",
        },
      },
    ],
  });

  if (!resp.ok) throw new Error(`Test alert failed: ${resp.error}`);
}

// ─── Disconnect ────────────────────────────────────────────────────────────────

export async function disconnectSlack(companyId: string): Promise<void> {
  await prisma.slackIntegration.updateMany({
    where: { companyId },
    data: { isActive: false },
  });

  // Also disable slack in settings
  await prisma.settings.updateMany({
    where: { companyId },
    data: { slackEnabled: false },
  });

  logger.info(`Slack disconnected for company ${companyId}`);
}

// ─── Internal helper ───────────────────────────────────────────────────────────

async function getActiveIntegration(companyId: string) {
  const integration = await prisma.slackIntegration.findUnique({ where: { companyId } });
  if (!integration || !integration.isActive) {
    throw new Error("No active Slack integration found for this company");
  }
  return integration;
}

export async function getIntegrationByTeamId(teamId: string) {
  return prisma.slackIntegration.findFirst({ where: { teamId, isActive: true } });
}
