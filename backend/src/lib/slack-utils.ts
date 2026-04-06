import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.SLACK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("SLACK_ENCRYPTION_KEY env var is not set");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) throw new Error("SLACK_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function verifySlackSignature(
  signingSecret: string,
  requestTimestamp: string,
  rawBody: string,
  slackSignature: string
): boolean {
  // Reject requests older than 5 minutes (replay attack prevention)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(requestTimestamp, 10)) > 300) return false;

  const baseString = `v0:${requestTimestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(baseString);
  const expected = "v0=" + hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(slackSignature));
  } catch {
    return false;
  }
}

export interface SlackAlertBlock {
  blocks: object[];
  text: string;
}

export function buildAlertBlocks(
  alertType: string,
  employeeName: string,
  department: string,
  message: string,
  severity: string,
  timestamp: Date
): SlackAlertBlock {
  const severityEmoji = severity === "high" ? "🔴" : severity === "medium" ? "🟡" : "🟢";
  const typeLabel: Record<string, string> = {
    blocked_site: "🚫 Blocked Site",
    idle_long: "💤 Long Idle",
    new_software: "💿 New Software",
    after_hours: "🌙 After Hours",
    usb_connected: "🔌 USB Connected",
    clipboard_sensitive: "📋 Clipboard Alert",
    low_activity: "📉 Low Activity",
  };

  const label = typeLabel[alertType] || `⚠️ ${alertType}`;
  const timeStr = timestamp.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return {
    text: `${severityEmoji} ${label}: ${message}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${severityEmoji} Employee Alert: ${label}`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Employee:*\n${employeeName}` },
          { type: "mrkdwn", text: `*Department:*\n${department}` },
          { type: "mrkdwn", text: `*Severity:*\n${severity.charAt(0).toUpperCase() + severity.slice(1)}` },
          { type: "mrkdwn", text: `*Time:*\n${timeStr}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Details:*\n${message}` },
      },
      { type: "divider" },
    ],
  };
}
