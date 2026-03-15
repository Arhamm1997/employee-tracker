import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "./auth.middleware";

type Feature = "browserHistory" | "usbMonitoring" | "alerts" | "keylog" | "fileActivity" | "printLogs";

const featurePlanField: Record<Feature, "browserHistoryEnabled" | "usbMonitoringEnabled" | "alertsEnabled" | "keylogEnabled" | "fileActivityEnabled" | "printLogsEnabled"> = {
  browserHistory: "browserHistoryEnabled",
  usbMonitoring: "usbMonitoringEnabled",
  alerts: "alertsEnabled",
  keylog: "keylogEnabled",
  fileActivity: "fileActivityEnabled",
  printLogs: "printLogsEnabled",
};

const featureMessages: Record<Feature, string> = {
  browserHistory: "Browser history monitoring is not included in your current plan. Please upgrade.",
  usbMonitoring: "USB monitoring is not included in your current plan. Please upgrade.",
  alerts: "Alerts are not included in your current plan. Please upgrade.",
  keylog: "Keystroke logging is not included in your current plan. Please upgrade.",
  fileActivity: "File activity monitoring is not included in your current plan. Please upgrade.",
  printLogs: "Print log monitoring is not included in your current plan. Please upgrade.",
};

export function checkFeature(feature: Feature) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const companyId = req.admin?.companyId;

    // Platform admins (no companyId) bypass feature gating
    if (!companyId) {
      next();
      return;
    }

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      });

      if (!subscription || !subscription.plan) {
        res.status(403).json({
          message: "No active subscription plan found",
          code: "NO_PLAN",
        });
        return;
      }

      const planField = featurePlanField[feature];
      if (!subscription.plan[planField]) {
        res.status(403).json({
          message: featureMessages[feature],
          code: "FEATURE_NOT_IN_PLAN",
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
