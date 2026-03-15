// agentFeature.middleware.ts
// Plan-based feature gating for agent ingestion endpoints.
// Only gates features that have corresponding fields in the Plan model.

import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AgentRequest } from "./agentAuth.middleware";

type AgentFeature = "browserHistory" | "usbMonitoring" | "keylog" | "fileActivity" | "printLogs";

const FEATURE_PLAN_FIELD: Record<AgentFeature, "browserHistoryEnabled" | "usbMonitoringEnabled" | "keylogEnabled" | "fileActivityEnabled" | "printLogsEnabled"> = {
  browserHistory: "browserHistoryEnabled",
  usbMonitoring:  "usbMonitoringEnabled",
  keylog:         "keylogEnabled",
  fileActivity:   "fileActivityEnabled",
  printLogs:      "printLogsEnabled",
};

export function checkAgentFeature(feature: AgentFeature) {
  return async (req: AgentRequest, res: Response, next: NextFunction): Promise<void> => {
    const companyId = req.employee?.companyId;
    if (!companyId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      });

      if (!subscription || subscription.status !== "ACTIVE") {
        // No active sub — drop silently (don't break the agent)
        res.status(402).json({ message: "No active subscription", drop: true });
        return;
      }

      const planField = FEATURE_PLAN_FIELD[feature];
      if (!subscription.plan[planField]) {
        res.status(403).json({ message: `Feature '${feature}' not in your plan`, drop: true });
        return;
      }

      next();
    } catch {
      // On DB error, let data through — don't break the agent
      next();
    }
  };
}
