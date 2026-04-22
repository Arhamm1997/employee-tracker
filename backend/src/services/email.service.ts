import nodemailer from "nodemailer";
import logger from "../lib/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BRAND = "MonitorHub";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://app.monitorhub.live";
const FROM = process.env.SMTP_FROM || `MonitorHub <noreply@monitorhub.live>`;

// ─── Base Template ────────────────────────────────────────────────────────────
// Clean, professional email template — no hardcoded CTA, no wrong subtitle.
// Each send function provides its own body content (including buttons).

function baseTemplate(opts: {
  title: string;
  subtitle?: string;
  accentColor?: string;
  body: string;
}): string {
  const accent = opts.accentColor || "#6366f1";
  const subtitle = opts.subtitle || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header bar -->
        <tr>
          <td style="background:${accent};padding:28px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:rgba(255,255,255,0.18);border-radius:10px;text-align:center;vertical-align:middle;">
                  <span style="font-size:20px;line-height:36px;">&#128248;</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">${BRAND}</p>
                  ${subtitle ? `<p style="margin:2px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">${subtitle}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 24px;color:#0f172a;font-size:22px;font-weight:700;letter-spacing:-0.4px;">${opts.title}</h1>
            ${opts.body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              This email was sent by <strong style="color:#64748b;">${BRAND}</strong>.<br>
              If you did not expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Reusable HTML snippets ───────────────────────────────────────────────────

function ctaButton(label: string, url: string, color = "#6366f1"): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:32px auto;">
  <tr>
    <td style="background:${color};border-radius:10px;">
      <a href="${url}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 36px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">${label} &rarr;</a>
    </td>
  </tr>
</table>`;
}

function infoRow(label: string, value: string, bg = "#ffffff"): string {
  return `
<tr style="background:${bg};">
  <td style="padding:12px 16px;border:1px solid #e2e8f0;color:#475569;font-size:13px;font-weight:600;width:40%;">${label}</td>
  <td style="padding:12px 16px;border:1px solid #e2e8f0;border-left:none;color:#1e293b;font-size:13px;">${value}</td>
</tr>`;
}

function infoTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;margin:16px 0;">${rows}</table>`;
}

function alertBox(content: string, type: "error" | "warning" | "success" | "info" = "info"): string {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    error:   { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626" },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706" },
    success: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a" },
    info:    { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb" },
  };
  const c = colors[type];
  return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:14px 18px;margin:16px 0;color:${c.text};font-size:13px;line-height:1.6;">${content}</div>`;
}

function fallbackLink(url: string): string {
  return `<p style="color:#94a3b8;font-size:12px;margin-top:4px;line-height:1.6;">If the button doesn&rsquo;t work, copy and paste this link:<br><a href="${url}" style="color:#6366f1;word-break:break-all;">${url}</a></p>`;
}

// ─── Alert Email ──────────────────────────────────────────────────────────────

export async function sendAlertEmail(
  to: string[],
  alertType: string,
  employeeName: string,
  department: string,
  message: string,
  severity: string,
  timestamp: Date
): Promise<void> {
  if (!to.length || !process.env.SMTP_USER) return;

  const severityColor = severity === "high" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#22c55e";
  const severityLabel = severity === "high" ? "🔴 HIGH" : severity === "medium" ? "🟡 MEDIUM" : "🟢 LOW";
  const typeLabel = alertType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">A new security alert has been triggered on your account.</p>
    ${alertBox(`<strong>${message}</strong>`, severity === "high" ? "error" : severity === "medium" ? "warning" : "success")}
    ${infoTable(
      infoRow("Employee", employeeName) +
      infoRow("Department", department, "#f8fafc") +
      infoRow("Alert Type", typeLabel) +
      infoRow("Severity", `<span style="color:${severityColor};font-weight:700;">${severityLabel}</span>`, "#f8fafc") +
      infoRow("Time", timestamp.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))
    )}
    ${ctaButton("View in Dashboard", DASHBOARD_URL, severityColor)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: to.join(", "),
      subject: `[${severityLabel}] ${typeLabel} — ${employeeName}`,
      html: baseTemplate({
        title: `Security Alert: ${typeLabel}`,
        subtitle: "Security Alert Notification",
        accentColor: severityColor,
        body,
      }),
    });
    logger.info(`Alert email sent to ${to.join(", ")} for ${employeeName}`);
  } catch (err) {
    logger.error("Failed to send alert email:", err);
  }
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export async function sendDailySummaryEmail(
  to: string[],
  stats: {
    totalEmployees: number;
    online: number;
    idle: number;
    offline: number;
    avgProductivity: number;
    alertsToday: number;
    topEmployee?: { name: string; productivity: number };
  }
): Promise<void> {
  if (!to.length || !process.env.SMTP_USER) return;

  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">Here is your daily workforce monitoring summary for <strong>${dateStr}</strong>.</p>
    ${infoTable(
      infoRow("Total Employees", String(stats.totalEmployees)) +
      infoRow("Online Today", `<span style="color:#16a34a;font-weight:600;">${stats.online}</span>`, "#f8fafc") +
      infoRow("Idle", `<span style="color:#d97706;font-weight:600;">${stats.idle}</span>`) +
      infoRow("Offline", `<span style="color:#dc2626;font-weight:600;">${stats.offline}</span>`, "#f8fafc") +
      infoRow("Avg Productivity", `<strong style="color:#6366f1;">${stats.avgProductivity}%</strong>`) +
      infoRow("Alerts Today", `<span style="color:#dc2626;font-weight:600;">${stats.alertsToday}</span>`, "#f8fafc") +
      (stats.topEmployee ? infoRow("Top Performer", `${stats.topEmployee.name} &mdash; <strong>${stats.topEmployee.productivity}%</strong>`) : "")
    )}
    ${ctaButton("View Full Report", DASHBOARD_URL)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: to.join(", "),
      subject: `Daily Summary — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} | ${BRAND}`,
      html: baseTemplate({ title: "Daily Workforce Summary", subtitle: "Automated daily report", body }),
    });
    logger.info("Daily summary email sent");
  } catch (err) {
    logger.error("Failed to send daily summary email:", err);
  }
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  companyName: string,
  verificationUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 24px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Thanks for signing up! Please verify your email address to activate your account.
      This link will expire in <strong>24 hours</strong>.
    </p>
    ${ctaButton("Verify Email Address", verificationUrl)}
    ${fallbackLink(verificationUrl)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Verify your email address — ${BRAND}`,
      html: baseTemplate({
        title: "Confirm your email",
        subtitle: "Account verification",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Verification email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send verification email:", err);
  }
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  companyName: string,
  selectPlanUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.7;">
      Welcome to ${BRAND}, <strong style="color:#0f172a;">${companyName}</strong>!
    </p>
    ${alertBox("✅ Your email has been verified successfully. Choose a plan to start monitoring.", "success")}
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 8px;">
      Get started in minutes — pick the plan that fits your team size.
    </p>
    ${ctaButton("Choose a Plan", selectPlanUrl, "#16a34a")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Welcome to ${BRAND} — Your account is ready!`,
      html: baseTemplate({
        title: "Welcome aboard! 🎉",
        subtitle: "Your account is verified",
        accentColor: "#16a34a",
        body,
      }),
    });
    logger.info(`Welcome email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send welcome email:", err);
  }
}

// ─── Plan Confirmation ────────────────────────────────────────────────────────

export async function sendPlanConfirmationEmail(
  to: string,
  companyName: string,
  planName: string,
  maxSeats: number,
  validUntil: Date,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const dateStr = validUntil.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your subscription is now active. Here are your plan details:
    </p>
    ${infoTable(
      infoRow("Plan", `<strong style="color:#6366f1;">${planName}</strong>`) +
      infoRow("Seats", maxSeats === -1 ? "Unlimited" : String(maxSeats), "#f8fafc") +
      infoRow("Valid Until", dateStr)
    )}
    ${ctaButton("Open Dashboard", dashboardUrl, "#6366f1")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your ${planName} plan is active — ${BRAND}`,
      html: baseTemplate({
        title: "Subscription Activated ✅",
        subtitle: "Plan confirmation",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Plan confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send plan confirmation email:", err);
  }
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  adminName: string,
  resetUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${adminName}</strong>,<br><br>
      We received a request to reset your password. Click the button below to set a new one.
      This link expires in <strong>1 hour</strong>.
    </p>
    ${alertBox("If you did not request a password reset, please ignore this email — your password will remain unchanged.", "warning")}
    ${ctaButton("Reset My Password", resetUrl, "#f59e0b")}
    ${fallbackLink(resetUrl)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Reset your password — ${BRAND}`,
      html: baseTemplate({
        title: "Password Reset Request",
        subtitle: "Security notification",
        accentColor: "#f59e0b",
        body,
      }),
    });
    logger.info(`Password reset email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send password reset email:", err);
  }
}

// ─── Subscription Cancelled ───────────────────────────────────────────────────

export async function sendCancellationEmail(
  to: string,
  companyName: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your subscription has been cancelled and your dashboard access has been deactivated.
    </p>
    ${alertBox("If you believe this was a mistake or would like to reactivate your account, please contact our support team.", "error")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your subscription has been cancelled — ${BRAND}`,
      html: baseTemplate({
        title: "Subscription Cancelled",
        subtitle: "Account update",
        accentColor: "#ef4444",
        body,
      }),
    });
    logger.info(`Cancellation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send cancellation email:", err);
  }
}

// ─── Expiry Warning ───────────────────────────────────────────────────────────

export async function sendExpiryWarningEmail(
  to: string,
  companyName: string,
  planName: string,
  expiryDate: Date,
  renewUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const dateStr = expiryDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your <strong>${planName}</strong> subscription expires on <strong>${dateStr}</strong>.
      Renew now to avoid any interruption to your monitoring service.
    </p>
    ${alertBox("⚠️ Dashboard access will be blocked after expiry. Renew before that date to keep your data uninterrupted.", "warning")}
    ${ctaButton("Renew Subscription", renewUrl, "#f59e0b")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `⚠️ Your subscription expires on ${dateStr} — ${BRAND}`,
      html: baseTemplate({
        title: "Subscription Expiring Soon",
        subtitle: "Renewal reminder",
        accentColor: "#f59e0b",
        body,
      }),
    });
    logger.info(`Expiry warning email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send expiry warning email:", err);
  }
}

// ─── Subscription Expired ─────────────────────────────────────────────────────

export async function sendExpiryNotificationEmail(
  to: string,
  companyName: string,
  renewUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your subscription has expired and dashboard access has been suspended.
    </p>
    ${alertBox("🔴 Your account is currently inactive. Renew your subscription to restore access.", "error")}
    ${ctaButton("Renew Now", renewUrl, "#ef4444")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your subscription has expired — ${BRAND}`,
      html: baseTemplate({
        title: "Subscription Expired",
        subtitle: "Action required",
        accentColor: "#ef4444",
        body,
      }),
    });
    logger.info(`Expiry notification email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send expiry notification email:", err);
  }
}

// ─── Plan Upgrade ─────────────────────────────────────────────────────────────

export async function sendUpgradeConfirmationEmail(
  to: string,
  companyName: string,
  oldPlanName: string,
  newPlanName: string,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your plan has been upgraded successfully. You now have access to all features included in your new plan.
    </p>
    ${infoTable(
      infoRow("Previous Plan", oldPlanName) +
      infoRow("New Plan", `<strong style="color:#16a34a;">${newPlanName}</strong>`, "#f0fdf4")
    )}
    ${ctaButton("Explore New Features", dashboardUrl, "#16a34a")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Plan upgraded to ${newPlanName} — ${BRAND}`,
      html: baseTemplate({
        title: "Plan Upgraded ✅",
        subtitle: "Subscription update",
        accentColor: "#16a34a",
        body,
      }),
    });
    logger.info(`Upgrade confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send upgrade confirmation email:", err);
  }
}

// ─── Plan Downgrade ───────────────────────────────────────────────────────────

export async function sendDowngradeConfirmationEmail(
  to: string,
  companyName: string,
  oldPlanName: string,
  newPlanName: string,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Your subscription plan has been changed. Some features may no longer be available.
    </p>
    ${infoTable(
      infoRow("Previous Plan", oldPlanName) +
      infoRow("New Plan", `<strong>${newPlanName}</strong>`, "#f8fafc")
    )}
    ${ctaButton("View Dashboard", dashboardUrl)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your plan has been changed to ${newPlanName} — ${BRAND}`,
      html: baseTemplate({
        title: "Plan Changed",
        subtitle: "Subscription update",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Downgrade confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send downgrade confirmation email:", err);
  }
}

// ─── Invoice Created ──────────────────────────────────────────────────────────

export async function sendInvoiceCreatedEmail(
  to: string,
  companyName: string,
  invoiceNumber: string,
  planName: string,
  amount: number,
  paymentSettings: {
    easypaisaNumber: string;
    nayapayNumber: string;
    bankIban: string;
    bankTitle: string;
    whatsappNumber: string;
  },
  invoiceUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const amountStr = amount.toLocaleString("en-PK");

  const paymentRows = [
    paymentSettings.easypaisaNumber ? infoRow("Easypaisa", paymentSettings.easypaisaNumber, "#fffbeb") : "",
    paymentSettings.nayapayNumber   ? infoRow("NayaPay",   paymentSettings.nayapayNumber)              : "",
    paymentSettings.bankIban        ? infoRow("Bank IBAN", `${paymentSettings.bankIban}<br>${paymentSettings.bankTitle}`, "#f8fafc") : "",
  ].join("");

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      An invoice has been generated for your subscription. Please complete payment using one of the methods below.
    </p>
    ${infoTable(
      infoRow("Invoice #", `<strong style="color:#6366f1;">${invoiceNumber}</strong>`) +
      infoRow("Plan", planName, "#f8fafc") +
      infoRow("Amount", `<strong style="font-size:18px;color:#0f172a;">PKR ${amountStr}</strong>`)
    )}
    <h3 style="color:#0f172a;margin:24px 0 8px;font-size:15px;">Payment Methods</h3>
    ${infoTable(paymentRows)}
    ${paymentSettings.whatsappNumber ? alertBox(`After payment, please send your receipt and Invoice ID <strong>${invoiceNumber}</strong> to <strong>${paymentSettings.whatsappNumber}</strong> on WhatsApp.`, "info") : ""}
    ${ctaButton("View Invoice", invoiceUrl)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Invoice ${invoiceNumber} — Payment Required | ${BRAND}`,
      html: baseTemplate({
        title: `Invoice ${invoiceNumber}`,
        subtitle: "Payment request",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Invoice created email sent to ${to} for ${invoiceNumber}`);
  } catch (err) {
    logger.error("Failed to send invoice created email:", err);
  }
}

// ─── Payment Screenshot Received ─────────────────────────────────────────────

export async function sendScreenshotUploadConfirmationEmail(
  to: string,
  companyName: string,
  invoiceNumber: string,
  invoiceUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      We have received your payment screenshot for invoice <strong>${invoiceNumber}</strong>.
      Our team will verify it within <strong>24 hours</strong>.
    </p>
    ${alertBox("⏳ Payment verification is pending. You will receive a confirmation email once it is approved.", "info")}
    ${ctaButton("Check Invoice Status", invoiceUrl)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Payment screenshot received — ${invoiceNumber} | ${BRAND}`,
      html: baseTemplate({
        title: "Payment Screenshot Received",
        subtitle: "Payment verification pending",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Screenshot upload confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send screenshot upload confirmation email:", err);
  }
}

// ─── Payment Approved ─────────────────────────────────────────────────────────

export async function sendPaymentApprovedEmail(
  to: string,
  companyName: string,
  planName: string,
  validUntil: Date,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const dateStr = validUntil.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Great news, <strong style="color:#0f172a;">${companyName}</strong>!<br><br>
      Your payment has been verified and your subscription is now active.
    </p>
    ${infoTable(
      infoRow("Plan", `<strong style="color:#16a34a;">${planName}</strong>`) +
      infoRow("Valid Until", dateStr, "#f0fdf4")
    )}
    ${ctaButton("Open Dashboard", dashboardUrl, "#16a34a")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `✅ Payment verified — Subscription active | ${BRAND}`,
      html: baseTemplate({
        title: "Payment Verified ✅",
        subtitle: "Your subscription is now active",
        accentColor: "#16a34a",
        body,
      }),
    });
    logger.info(`Payment approved email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send payment approved email:", err);
  }
}

// ─── Payment Rejected ─────────────────────────────────────────────────────────

export async function sendPaymentRejectedEmail(
  to: string,
  companyName: string,
  rejectionReason: string,
  invoiceUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      Hello <strong style="color:#0f172a;">${companyName}</strong>,<br><br>
      Unfortunately, we were unable to verify your payment.
    </p>
    ${alertBox(`<strong>Reason:</strong> ${rejectionReason}`, "error")}
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:8px 0;">
      Please make the payment again and send us the screenshot. Contact support if you need assistance.
    </p>
    ${ctaButton("View Invoice", invoiceUrl, "#ef4444")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `❌ Payment could not be verified — ${BRAND}`,
      html: baseTemplate({
        title: "Payment Rejected",
        subtitle: "Action required",
        accentColor: "#ef4444",
        body,
      }),
    });
    logger.info(`Payment rejected email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send payment rejected email:", err);
  }
}

// ─── Admin: New Signup Notification ──────────────────────────────────────────

export async function sendAdminNewSignupNotification(
  to: string,
  companyName: string,
  companyEmail: string,
  adminUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      A new company has just signed up on <strong>${BRAND}</strong>.
    </p>
    ${infoTable(
      infoRow("Company", companyName) +
      infoRow("Email", companyEmail, "#f8fafc") +
      infoRow("Signed up", new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))
    )}
    ${ctaButton("View in Admin Panel", `${adminUrl}/admin/customers`)}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `🆕 New signup: ${companyName} — ${BRAND}`,
      html: baseTemplate({
        title: "New Company Signup",
        subtitle: "Admin notification",
        accentColor: "#6366f1",
        body,
      }),
    });
    logger.info(`Admin new signup notification sent for ${companyName}`);
  } catch (err) {
    logger.error("Failed to send admin new signup notification:", err);
  }
}

// ─── Admin: New Invoice Notification ─────────────────────────────────────────

export async function sendAdminNewInvoiceNotification(
  to: string,
  invoiceNumber: string,
  companyName: string,
  companyEmail: string,
  planName: string,
  amount: number,
  adminUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const amountStr = amount.toLocaleString("en-PK");

  const body = `
    <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.7;">
      A new payment invoice is awaiting your review and approval.
    </p>
    ${infoTable(
      infoRow("Invoice #", `<strong style="color:#d97706;">${invoiceNumber}</strong>`, "#fffbeb") +
      infoRow("Company", `${companyName} (${companyEmail})`) +
      infoRow("Plan", planName, "#f8fafc") +
      infoRow("Amount", `<strong style="font-size:18px;color:#0f172a;">PKR ${amountStr}</strong>`)
    )}
    ${alertBox("⏳ This invoice is awaiting your approval. Please review it promptly.", "warning")}
    ${ctaButton("Review Invoice", `${adminUrl}/admin/invoices`, "#f59e0b")}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `💰 New invoice ${invoiceNumber} — PKR ${amountStr} | ${BRAND}`,
      html: baseTemplate({
        title: `New Invoice: ${invoiceNumber}`,
        subtitle: "Admin notification",
        accentColor: "#f59e0b",
        body,
      }),
    });
    logger.info(`Admin new invoice notification sent for ${invoiceNumber}`);
  } catch (err) {
    logger.error("Failed to send admin new invoice notification:", err);
  }
}

// ─── SMTP Health Check ────────────────────────────────────────────────────────

export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    logger.info("SMTP connection verified");
    return true;
  } catch (err) {
    logger.warn("SMTP connection failed (emails will be skipped):", err);
    return false;
  }
}
