import prisma from "./prisma";

export interface SeatInfo {
  seats: {
    used: number;
    limit: number;      // -1 = unlimited
    remaining: number;  // -1 = unlimited
    percentage: number; // 0–100; always 0 when unlimited
  };
  canAddEmployee: boolean;
  isUnlimited: boolean;
  planFeatures: {
    screenshotsEnabled: boolean;
    browserHistoryEnabled: boolean;
    usbMonitoringEnabled: boolean;
    alertsEnabled: boolean;
    advancedReports: boolean;
  };
}

/**
 * Returns seat usage and plan feature flags for a company.
 * Throws if the company has no active subscription or the plan is missing.
 */
export async function getSeatInfo(companyId: string): Promise<SeatInfo> {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  const plan = subscription?.plan ?? null;
  const maxSeats = plan?.maxSeats ?? 0; // 0 = no plan → no seats allowed
  const isUnlimited = maxSeats === -1;

  const used = await prisma.employee.count({
    where: { companyId, isActive: true },
  });

  const remaining = isUnlimited ? -1 : Math.max(0, maxSeats - used);
  const percentage = isUnlimited || maxSeats === 0
    ? 0
    : Math.min(100, Math.round((used / maxSeats) * 100));

  return {
    seats: { used, limit: maxSeats, remaining, percentage },
    canAddEmployee: isUnlimited || remaining > 0,
    isUnlimited,
    planFeatures: {
      screenshotsEnabled:    plan?.screenshotsEnabled    ?? false,
      browserHistoryEnabled: plan?.browserHistoryEnabled ?? false,
      usbMonitoringEnabled:  plan?.usbMonitoringEnabled  ?? false,
      alertsEnabled:         plan?.alertsEnabled         ?? false,
      advancedReports:       plan?.advancedReports       ?? false,
    },
  };
}

/**
 * Quick boolean check — use this before creating an employee.
 */
export async function canAddEmployee(companyId: string): Promise<boolean> {
  const info = await getSeatInfo(companyId);
  return info.canAddEmployee;
}
