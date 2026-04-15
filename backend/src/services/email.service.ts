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

const COMPANY = process.env.COMPANY_NAME || "Company";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const FROM = process.env.SMTP_FROM || `Employee Monitor <noreply@company.com>`;

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #1e1e2e; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; }
    .header span { color: #a78bfa; font-size: 13px; }
    .body { padding: 32px; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 16px; margin: 16px 0; }
    .alert-box.medium { background: #fffbeb; border-color: #f59e0b; }
    .alert-box.low { background: #f0fdf4; border-color: #22c55e; }
    .field { margin: 8px 0; }
    .field strong { color: #374151; display: inline-block; width: 120px; }
    .field span { color: #6b7280; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; margin-top: 24px; }
    .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${COMPANY} — Employee Monitor</h1>
      <span>Security Alert Notification</span>
    </div>
    <div class="body">
      <h2 style="color:#111827;margin-top:0;">${title}</h2>
      ${body}
      <a href="${DASHBOARD_URL}" class="btn">View in Dashboard →</a>
    </div>
    <div class="footer">
      This is an automated alert from ${COMPANY} Employee Monitor System.<br>
      © ${new Date().getFullYear()} ${COMPANY}. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

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

  const severityClass = severity === "high" ? "" : severity === "medium" ? "medium" : "low";
  const severityLabel =
    severity === "high" ? "🔴 HIGH" : severity === "medium" ? "🟡 MEDIUM" : "🟢 LOW";

  const body = `
    <div class="alert-box ${severityClass}">
      <strong>Alert:</strong> ${message}
    </div>
    <div class="field"><strong>Employee:</strong> <span>${employeeName}</span></div>
    <div class="field"><strong>Department:</strong> <span>${department}</span></div>
    <div class="field"><strong>Alert Type:</strong> <span>${alertType.replace(/_/g, " ").toUpperCase()}</span></div>
    <div class="field"><strong>Severity:</strong> <span>${severityLabel}</span></div>
    <div class="field"><strong>Timestamp:</strong> <span>${timestamp.toLocaleString()}</span></div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to: to.join(", "),
      subject: `[${severityLabel}] ${alertType.replace(/_/g, " ")} — ${employeeName}`,
      html: baseTemplate(`Security Alert: ${alertType.replace(/_/g, " ")}`, body),
    });
    logger.info(`Alert email sent to ${to.join(", ")} for ${employeeName}`);
  } catch (err) {
    logger.error("Failed to send alert email:", err);
  }
}

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

  const body = `
    <p style="color:#6b7280;">Here is your daily workforce monitoring summary for <strong>${new Date().toLocaleDateString()}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Total Employees</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;">${stats.totalEmployees}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Online Today</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#22c55e;">${stats.online}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Idle</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#f59e0b;">${stats.idle}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Offline</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#ef4444;">${stats.offline}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Avg Productivity</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;"><strong>${stats.avgProductivity}%</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Alerts Today</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#ef4444;">${stats.alertsToday}</td>
      </tr>
      ${
        stats.topEmployee
          ? `<tr style="background:#f9fafb;"><td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;">Top Performer</td><td style="padding:10px 16px;border:1px solid #e5e7eb;">${stats.topEmployee.name} (${stats.topEmployee.productivity}%)</td></tr>`
          : ""
      }
    </table>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to: to.join(", "),
      subject: `Daily Workforce Summary — ${new Date().toLocaleDateString()} | ${COMPANY}`,
      html: baseTemplate("Daily Workforce Summary", body),
    });
    logger.info("Daily summary email sent");
  } catch (err) {
    logger.error("Failed to send daily summary email:", err);
  }
}

// ─── Company Signup Emails ────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  companyName: string,
  verificationUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Please click the button below to verify your email address.
      This link will expire in <strong>24 hours</strong>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Verify Email →
      </a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color:#6366f1;word-break:break-all;">${verificationUrl}</a>
    </p>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Verify your email address — EmployeeMonitor",
      html: baseTemplate("Email Verification", body),
    });
    logger.info(`Verification email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send verification email:", err);
  }
}

export async function sendWelcomeEmail(
  to: string,
  companyName: string,
  selectPlanUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Congratulations! Your account has been successfully verified.
      Select a plan to start monitoring your employees.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${selectPlanUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Select a Plan →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Welcome! Your account has been verified — EmployeeMonitor",
      html: baseTemplate("Account Verified!", body),
    });
    logger.info(`Welcome email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send welcome email:", err);
  }
}

export async function sendPlanConfirmationEmail(
  to: string,
  companyName: string,
  planName: string,
  maxSeats: number,
  validUntil: Date,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Your plan has been successfully activated. Here are your subscription details:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${planName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Seats</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${maxSeats === -1 ? "Unlimited" : maxSeats}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Valid Until</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${validUntil.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${dashboardUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Open Dashboard →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your plan is active — ${planName} | EmployeeMonitor`,
      html: baseTemplate("Plan Confirmation", body),
    });
    logger.info(`Plan confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send plan confirmation email:", err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  adminName: string,
  resetUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${adminName}</strong>,<br><br>
      We received a request to reset your password. Click the button below to set a new password.
      This link will expire in <strong>1 hour</strong>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Reset Password →
      </a>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
      If you did not request a password reset, please ignore this email. Your password will not be changed.
    </p>
    <p style="color:#9ca3af;font-size:12px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
    </p>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Password Reset Request — MonitorHub",
      html: baseTemplate("Reset Your Password", body),
    });
    logger.info(`Password reset email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send password reset email:", err);
  }
}

export async function sendCancellationEmail(
  to: string,
  companyName: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Your subscription has been cancelled. Your account access will be discontinued.
    </p>
    <div class="alert-box">
      If you believe this was a mistake or would like to reactivate your account,
      please contact our support team immediately.
    </div>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Thank you for using ${COMPANY} Employee Monitor.
    </p>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your subscription has been cancelled — ${COMPANY}`,
      html: baseTemplate("Subscription Cancelled", body),
    });
    logger.info(`Cancellation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send cancellation email:", err);
  }
}

// ─── Subscription Lifecycle Emails ───────────────────────────────────────────

export async function sendExpiryWarningEmail(
  to: string,
  companyName: string,
  planName: string,
  expiryDate: Date,
  renewUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const dateStr = expiryDate.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Your <strong>${planName}</strong> subscription will expire on <strong>${dateStr}</strong>.
      Please renew now to maintain uninterrupted service.
    </p>
    <div class="alert-box medium">
      ⚠️ Your subscription will expire in a few days. Dashboard access will be blocked after expiry.
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${renewUrl}" class="btn" style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Renew Now →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `⚠️ Subscription Expires on ${dateStr} — ${COMPANY}`,
      html: baseTemplate("Subscription Expiry Warning", body),
    });
    logger.info(`Expiry warning email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send expiry warning email:", err);
  }
}

export async function sendExpiryNotificationEmail(
  to: string,
  companyName: string,
  renewUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Your subscription has expired. Dashboard access has been blocked.
    </p>
    <div class="alert-box">
      Please renew your subscription to resume service.
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${renewUrl}" class="btn" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Renew Now →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Your Subscription Has Expired — ${COMPANY}`,
      html: baseTemplate("Subscription Expired", body),
    });
    logger.info(`Expiry notification email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send expiry notification email:", err);
  }
}

export async function sendUpgradeConfirmationEmail(
  to: string,
  companyName: string,
  oldPlanName: string,
  newPlanName: string,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Aapka plan successfully upgrade ho gaya hai!
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Previous Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${oldPlanName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">New Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#10b981;font-weight:600;">${newPlanName}</td>
      </tr>
    </table>
    <p style="color:#6b7280;">New features are now available. Go to your dashboard to start using them.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${dashboardUrl}" class="btn" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        View Dashboard →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Plan upgrade successful — ${newPlanName} | ${COMPANY}`,
      html: baseTemplate("Plan Upgrade Confirmed ✅", body),
    });
    logger.info(`Upgrade confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send upgrade confirmation email:", err);
  }
}

export async function sendDowngradeConfirmationEmail(
  to: string,
  companyName: string,
  oldPlanName: string,
  newPlanName: string,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Aapka plan change ho gaya hai.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Previous Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${oldPlanName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">New Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#374151;">${newPlanName}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${dashboardUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        View Dashboard →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Plan downgrade successful — ${newPlanName} | ${COMPANY}`,
      html: baseTemplate("Plan Change Confirmed", body),
    });
    logger.info(`Downgrade confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send downgrade confirmation email:", err);
  }
}

// ─── Offline Payment Emails ───────────────────────────────────────────────────

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

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Your invoice has been generated. Please make payment using one of the methods below.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Invoice #</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6366f1;font-weight:600;">${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${planName}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Amount</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#374151;font-size:18px;font-weight:700;">PKR ${amountStr}</td>
      </tr>
    </table>
    <h3 style="color:#374151;margin-top:24px;">Payment Methods:</h3>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">
      ${paymentSettings.easypaisaNumber ? `
      <tr style="background:#fef3c7;">
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Easypaisa</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#6b7280;">${paymentSettings.easypaisaNumber}</td>
      </tr>` : ""}
      ${paymentSettings.nayapayNumber ? `
      <tr>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">NayaPay</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#6b7280;">${paymentSettings.nayapayNumber}</td>
      </tr>` : ""}
      ${paymentSettings.bankIban ? `
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Bank Transfer</td>
        <td style="padding:10px 16px;border:1px solid #e5e7eb;color:#6b7280;">IBAN: ${paymentSettings.bankIban}<br>${paymentSettings.bankTitle}</td>
      </tr>` : ""}
    </table>
    ${paymentSettings.whatsappNumber ? `
    <div class="alert-box medium" style="background:#fef3c7;border-color:#f59e0b;">
      <strong>After Payment:</strong><br>
      Please send the payment screenshot and Invoice ID to: <strong>${paymentSettings.whatsappNumber}</strong> on WhatsApp
    </div>` : ""}
    <div style="text-align:center;margin:32px 0;">
      <a href="${invoiceUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        View Invoice →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Invoice ${invoiceNumber} — Payment Details | ${COMPANY}`,
      html: baseTemplate(`Invoice ${invoiceNumber}`, body),
    });
    logger.info(`Invoice created email sent to ${to} for ${invoiceNumber}`);
  } catch (err) {
    logger.error("Failed to send invoice created email:", err);
  }
}

export async function sendScreenshotUploadConfirmationEmail(
  to: string,
  companyName: string,
  invoiceNumber: string,
  invoiceUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      We have received your payment screenshot. We will verify it within <strong>24 hours</strong>.
    </p>
    <div class="alert-box low">
      Invoice ID: <strong>${invoiceNumber}</strong> — Verification is pending.
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${invoiceUrl}" class="btn" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Check Status →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `Payment Screenshot Received — ${invoiceNumber} | ${COMPANY}`,
      html: baseTemplate("Payment Screenshot Received", body),
    });
    logger.info(`Screenshot upload confirmation email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send screenshot upload confirmation email:", err);
  }
}

export async function sendPaymentApprovedEmail(
  to: string,
  companyName: string,
  planName: string,
  validUntil: Date,
  dashboardUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const dateStr = validUntil.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Congratulations, <strong>${companyName}</strong>!<br><br>
      Your payment has been verified. Your subscription is now active.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f0fdf4;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#10b981;font-weight:600;">${planName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Valid Until</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${dateStr}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${dashboardUrl}" class="btn" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Open Dashboard →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `✅ Payment Verified — Your Subscription is Active | ${COMPANY}`,
      html: baseTemplate("Payment Verified ✅", body),
    });
    logger.info(`Payment approved email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send payment approved email:", err);
  }
}

export async function sendPaymentRejectedEmail(
  to: string,
  companyName: string,
  rejectionReason: string,
  invoiceUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      Hello <strong>${companyName}</strong>,<br><br>
      Unfortunately, we could not verify your payment.
    </p>
    <div class="alert-box">
      <strong>Reason:</strong> ${rejectionReason}
    </div>
    <p style="color:#6b7280;margin-top:16px;">
      Please make the payment again and send us the screenshot.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${invoiceUrl}" class="btn" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        View Invoice →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `❌ Payment Could Not Be Verified — ${COMPANY}`,
      html: baseTemplate("Payment Rejected ❌", body),
    });
    logger.info(`Payment rejected email sent to ${to}`);
  } catch (err) {
    logger.error("Failed to send payment rejected email:", err);
  }
}

// ─── Master Admin Notification Emails ────────────────────────────────────────

export async function sendAdminNewSignupNotification(
  to: string,
  companyName: string,
  companyEmail: string,
  adminUrl: string
): Promise<void> {
  if (!process.env.SMTP_USER) return;

  const body = `
    <p style="color:#6b7280;margin-bottom:24px;">
      A new company has just signed up on <strong>${COMPANY}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Company</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${companyName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Email</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${companyEmail}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Time</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${new Date().toLocaleString()}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${adminUrl}/admin/customers" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        View in Admin Panel →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `🆕 New Signup: ${companyName} — ${COMPANY}`,
      html: baseTemplate("New Company Signup", body),
    });
    logger.info(`Admin new signup notification sent for ${companyName}`);
  } catch (err) {
    logger.error("Failed to send admin new signup notification:", err);
  }
}

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
    <p style="color:#6b7280;margin-bottom:24px;">
      A new payment invoice has been created and is awaiting your approval.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr style="background:#fef3c7;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Invoice #</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#d97706;font-weight:700;">${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Company</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${companyName} (${companyEmail})</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Plan</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#6b7280;">${planName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Amount</td>
        <td style="padding:12px 16px;border:1px solid #e5e7eb;color:#374151;font-size:18px;font-weight:700;">PKR ${amountStr}</td>
      </tr>
    </table>
    <div class="alert-box medium">
      ⏳ This invoice is pending approval. Please review and approve or reject it.
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${adminUrl}/admin/invoices" style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Review Invoice →
      </a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `💰 New Invoice ${invoiceNumber} — PKR ${amountStr} | ${COMPANY}`,
      html: baseTemplate(`New Invoice: ${invoiceNumber}`, body),
    });
    logger.info(`Admin new invoice notification sent for ${invoiceNumber}`);
  } catch (err) {
    logger.error("Failed to send admin new invoice notification:", err);
  }
}

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
