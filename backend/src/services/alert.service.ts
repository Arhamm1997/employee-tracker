import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { broadcast, broadcastAlertCount } from "../lib/websocket";
import { sendAlertEmail } from "./email.service";
import { sendAlertToSlack } from "./slack.service";
import logger from "../lib/logger";

interface CreateAlertOptions {
  employeeId: string;
  type: string;
  message: string;
  severity: string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
}

export async function createAlert(opts: CreateAlertOptions) {
  const { employeeId, type, message, severity, metadata, sendEmail = true } = opts;

  try {
    // Fetch employee (with companyId) + settings in parallel
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { name: true, department: true, companyId: true },
    });

    if (!employee) return null;

    const companyId = employee.companyId;
    const settings = await prisma.settings.findFirst({
      where: companyId ? { companyId } : {},
      select: {
        alertEmails: true,
        alertOnBlockedSite: true,
        alertOnIdle: true,
        alertOnUsb: true,
        alertOnAfterHours: true,
        alertOnNewSoftware: true,
        slackEnabled: true,
        slackChannelId: true,
        slackAlertTypes: true,
      },
    });

    const alert = await prisma.alert.create({
      data: {
        employeeId,
        companyId,
        type,
        message,
        severity,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        isRead: false,
        emailSent: false,
      },
    });

    // Emit real-time events
    broadcast("new-alert", {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      employeeId,
      employeeName: employee.name,
      message,
      timestamp: alert.timestamp.toISOString(),
      read: false,
    });

    await broadcastAlertCount();

    // Send email based on alert type settings
    if (sendEmail && settings && settings.alertEmails.length > 0) {
      let shouldEmail = false;

      switch (type) {
        case "blocked_site":    shouldEmail = settings.alertOnBlockedSite; break;
        case "idle_long":       shouldEmail = settings.alertOnIdle; break;
        case "usb_connected":   shouldEmail = settings.alertOnUsb; break;
        case "after_hours":     shouldEmail = settings.alertOnAfterHours; break;
        case "new_software":    shouldEmail = settings.alertOnNewSoftware; break;
        default:                shouldEmail = true;
      }

      if (shouldEmail) {
        sendAlertEmail(
          settings.alertEmails,
          type,
          employee.name,
          employee.department,
          message,
          severity,
          alert.timestamp
        ).then(() => {
          prisma.alert.update({
            where: { id: alert.id },
            data: { emailSent: true },
          }).catch(() => {});
        });
      }
    }

    // Send to Slack (non-blocking)
    if (companyId && settings?.slackEnabled && settings?.slackChannelId) {
      sendAlertToSlack({
        alertId: alert.id,
        companyId,
        alertType: type,
        employeeName: employee.name,
        department: employee.department,
        message,
        severity,
        timestamp: alert.timestamp,
      }).catch((err) => logger.error("Slack alert send error:", err));
    }

    return alert;
  } catch (err) {
    logger.error("Failed to create alert:", err);
    return null;
  }
}

export async function checkBlockedSite(
  employeeId: string,
  windowTitle: string,
  blockedSites: string[]
): Promise<boolean> {
  const lowerTitle = windowTitle.toLowerCase();
  for (const site of blockedSites) {
    const domain = site.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    const domainName = domain.split(".")[0];

    if (lowerTitle.includes(domain) || (domainName.length > 3 && lowerTitle.includes(domainName))) {
      await createAlert({
        employeeId,
        type: "blocked_site",
        message: `Employee visited blocked site: ${site}`,
        severity: "high",
        metadata: { url: site, windowTitle },
      });
      return true;
    }
  }
  return false;
}

export async function checkAfterHours(
  employeeId: string,
  workStartTime: string,
  workEndTime: string
): Promise<boolean> {
  const now = new Date();
  const [startH, startM] = workStartTime.split(":").map(Number);
  const [endH, endM] = workEndTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const isAfterHours = endMinutes < startMinutes
    ? currentMinutes < startMinutes && currentMinutes > endMinutes
    : currentMinutes < startMinutes || currentMinutes > endMinutes;

  if (isAfterHours) {
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await createAlert({
      employeeId,
      type: "after_hours",
      message: `Employee is working after hours (${timeStr})`,
      severity: "low",
      metadata: { time: timeStr },
    });
    return true;
  }
  return false;
}
