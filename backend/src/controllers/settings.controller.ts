import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
const NUM_TO_DAY: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

function qualityToString(q: number): "low" | "medium" | "high" {
  if (q <= 40) return "low";
  if (q <= 70) return "medium";
  return "high";
}

function qualityToInt(q: string): number {
  if (q === "low") return 30;
  if (q === "high") return 85;
  return 60;
}

function dbToFrontend(s: {
  workStartTime: string;
  workEndTime: string;
  workDays: string[];
  timezone: string;
  screenshotInterval: number;
  screenshotQuality: number;
  idleThreshold: number;
  screenshotsEnabled: boolean;
  browserHistoryEnabled: boolean;
  usbMonitoringEnabled: boolean;
  clipboardEnabled: boolean;
  afterHoursEnabled: boolean;
  blockedSites: string[];
  productiveApps: string[];
  nonProductiveApps: string[];
  neutralApps: string[];
  alertEmails: string[];
  alertOnBlockedSite: boolean;
  alertOnIdle: boolean;
  alertOnUsb: boolean;
  alertOnAfterHours: boolean;
  alertOnNewSoftware: boolean;
  idleAlertThreshold: number;
  activityRetentionDays: number;
  screenshotRetentionDays: number;
  alertRetentionDays: number;
  maxEmployees: number;
  keylogEnabled: boolean;
  fileMonitorEnabled: boolean;
  printMonitorEnabled: boolean;
}) {
  return {
    workSchedule: {
      startTime: s.workStartTime,
      endTime: s.workEndTime,
      workDays: s.workDays.map((d) => DAY_MAP[d] ?? 1),
      timezone: s.timezone,
    },
    monitoring: {
      screenshotInterval: s.screenshotInterval,
      screenshotQuality: qualityToString(s.screenshotQuality),
      idleThreshold: s.idleThreshold,
      enableScreenshots: s.screenshotsEnabled,
      enableBrowserHistory: s.browserHistoryEnabled,
      enableUsb: s.usbMonitoringEnabled,
      enableClipboard: s.clipboardEnabled,
      enableAfterHours: s.afterHoursEnabled,
      enableKeylog: s.keylogEnabled,
      enableFileMonitor: s.fileMonitorEnabled,
      enablePrintMonitor: s.printMonitorEnabled,
    },
    blockedSites: s.blockedSites,
    appCategories: {
      productive: s.productiveApps,
      nonProductive: s.nonProductiveApps,
      neutral: s.neutralApps,
    },
    notifications: {
      emailAddresses: s.alertEmails,
      alertTypes: {
        blocked_site: s.alertOnBlockedSite,
        after_hours: s.alertOnAfterHours,
        usb_connected: s.alertOnUsb,
        idle_long: s.alertOnIdle,
        new_software: s.alertOnNewSoftware,
        low_activity: false,
      },
      idleThresholdMinutes: s.idleAlertThreshold,
    },
    dataRetention: {
      activityDays: s.activityRetentionDays,
      screenshotDays: s.screenshotRetentionDays,
      alertDays: s.alertRetentionDays,
    },
    maxEmployees: s.maxEmployees,
  };
}

export async function getSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = req.admin?.companyId ?? null;
    const whereClause = companyId ? { companyId } : {};

    let settings = await prisma.settings.findFirst({ where: whereClause });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          companyId,
          blockedSites: [],
          productiveApps: [],
          nonProductiveApps: [],
          neutralApps: [],
          alertEmails: [],
        },
      });
    }

    res.json(dbToFrontend(settings));
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as {
      workSchedule?: {
        startTime?: string;
        endTime?: string;
        workDays?: number[];
        timezone?: string;
      };
      monitoring?: {
        screenshotInterval?: number;
        screenshotQuality?: string;
        idleThreshold?: number;
        enableScreenshots?: boolean;
        enableBrowserHistory?: boolean;
        enableUsb?: boolean;
        enableClipboard?: boolean;
        enableAfterHours?: boolean;
      };
      blockedSites?: string[];
      appCategories?: {
        productive?: string[];
        nonProductive?: string[];
        neutral?: string[];
      };
      notifications?: {
        emailAddresses?: string[];
        alertTypes?: {
          blocked_site?: boolean;
          after_hours?: boolean;
          usb_connected?: boolean;
          idle_long?: boolean;
          new_software?: boolean;
        };
        idleThresholdMinutes?: number;
      };
      dataRetention?: {
        activityDays?: number;
        screenshotDays?: number;
        alertDays?: number;
      };
    };

    const companyId = req.admin?.companyId ?? null;
    const updateData: Record<string, unknown> = {};

    if (body.workSchedule) {
      const ws = body.workSchedule;
      if (ws.startTime !== undefined) updateData.workStartTime = ws.startTime;
      if (ws.endTime !== undefined) updateData.workEndTime = ws.endTime;
      if (ws.workDays !== undefined)
        updateData.workDays = ws.workDays.map((n) => NUM_TO_DAY[n]).filter(Boolean);
      if (ws.timezone !== undefined) updateData.timezone = ws.timezone;
    }

    if (body.monitoring) {
      const m = body.monitoring;
      if (m.screenshotInterval !== undefined) updateData.screenshotInterval = m.screenshotInterval;
      if (m.screenshotQuality !== undefined)
        updateData.screenshotQuality = qualityToInt(m.screenshotQuality);
      if (m.idleThreshold !== undefined) updateData.idleThreshold = m.idleThreshold;
      if (m.enableScreenshots !== undefined) updateData.screenshotsEnabled = m.enableScreenshots;
      if (m.enableBrowserHistory !== undefined) updateData.browserHistoryEnabled = m.enableBrowserHistory;
      if (m.enableUsb !== undefined) updateData.usbMonitoringEnabled = m.enableUsb;
      if (m.enableClipboard !== undefined) updateData.clipboardEnabled = m.enableClipboard;
      if (m.enableAfterHours !== undefined) updateData.afterHoursEnabled = m.enableAfterHours;
      if ((m as any).enableKeylog !== undefined) updateData.keylogEnabled = (m as any).enableKeylog;
      if ((m as any).enableFileMonitor !== undefined) updateData.fileMonitorEnabled = (m as any).enableFileMonitor;
      if ((m as any).enablePrintMonitor !== undefined) updateData.printMonitorEnabled = (m as any).enablePrintMonitor;
    }

    if ((body as any).maxEmployees !== undefined) updateData.maxEmployees = (body as any).maxEmployees;
    if (body.blockedSites !== undefined) updateData.blockedSites = body.blockedSites;

    if (body.appCategories) {
      const ac = body.appCategories;
      if (ac.productive !== undefined) updateData.productiveApps = ac.productive;
      if (ac.nonProductive !== undefined) updateData.nonProductiveApps = ac.nonProductive;
      if (ac.neutral !== undefined) updateData.neutralApps = ac.neutral;
    }

    if (body.notifications) {
      const n = body.notifications;
      if (n.emailAddresses !== undefined) updateData.alertEmails = n.emailAddresses;
      if (n.idleThresholdMinutes !== undefined) updateData.idleAlertThreshold = n.idleThresholdMinutes;
      if (n.alertTypes) {
        const at = n.alertTypes;
        if (at.blocked_site !== undefined) updateData.alertOnBlockedSite = at.blocked_site;
        if (at.after_hours !== undefined) updateData.alertOnAfterHours = at.after_hours;
        if (at.usb_connected !== undefined) updateData.alertOnUsb = at.usb_connected;
        if (at.idle_long !== undefined) updateData.alertOnIdle = at.idle_long;
        if (at.new_software !== undefined) updateData.alertOnNewSoftware = at.new_software;
      }
    }

    if (body.dataRetention) {
      const dr = body.dataRetention;
      if (dr.activityDays !== undefined) updateData.activityRetentionDays = dr.activityDays;
      if (dr.screenshotDays !== undefined) updateData.screenshotRetentionDays = dr.screenshotDays;
      if (dr.alertDays !== undefined) updateData.alertRetentionDays = dr.alertDays;
    }

    const whereClause = companyId ? { companyId } : {};
    let existing = await prisma.settings.findFirst({ where: whereClause });

    let settings;
    if (existing) {
      settings = await prisma.settings.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          companyId,
          blockedSites: [],
          productiveApps: [],
          nonProductiveApps: [],
          neutralApps: [],
          alertEmails: [],
          ...updateData,
        },
      });
    }

    res.json(dbToFrontend(settings));
  } catch (err) {
    next(err);
  }
}
