import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SeatInfo } from "../types/subscription";
import { apiGetSubscriptionInfo } from "./api";
import { useAuth } from "./auth-types";

interface SubscriptionContextType {
  seatInfo: SeatInfo | null;
  loading: boolean;
  error: string | null;
  refreshSeatInfo: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

// Plan hierarchy for downgrade detection (lower number = lower tier)
const PLAN_HIERARCHY: Record<string, number> = {
  "free": 0,
  "professional": 1,
  "enterprise": 2,
};

function getPlanTier(planName: string | undefined): number {
  if (!planName) return 0;
  const lower = planName.toLowerCase();
  for (const [key, tier] of Object.entries(PLAN_HIERARCHY)) {
    if (lower.includes(key)) return tier;
  }
  return 0;
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousPlanName, setPreviousPlanName] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading, logout } = useAuth();

  const refreshSeatInfo = async () => {
    if (!isAuthenticated) {
      setSeatInfo(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiGetSubscriptionInfo();
      const newPlanName = response.subscription?.plan?.name;

      // Detect any plan change (upgrade or downgrade) → force re-login
      if (previousPlanName && newPlanName && previousPlanName !== newPlanName) {
        setSeatInfo(response.subscription);
        setError(null);
        setLoading(false);
        // Give UI a moment to update before logging out
        setTimeout(() => {
          logout();
        }, 1500);
        return;
      }

      setSeatInfo(response.subscription);
      setPreviousPlanName(newPlanName || null);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch subscription";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void refreshSeatInfo();
      // Set initial plan name after first load
      setImmediate(() => {
        if (seatInfo?.plan?.name) {
          setPreviousPlanName(seatInfo.plan.name);
        }
      });
    }
  }, [isAuthenticated, authLoading]);

  // Poll every 30s to detect plan changes in real-time
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    const interval = setInterval(() => { void refreshSeatInfo(); }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading]);

  return (
    <SubscriptionContext.Provider
      value={{ seatInfo, loading, error, refreshSeatInfo }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}

// Features shown by default when backend is offline / seatInfo hasn't loaded
const SAFE_DEFAULT_FEATURES = new Set([
  "screenshots",
  "browserHistory",
  "usbMonitoring",
  "alerts",
  "shutdown",
]);

/**
 * Returns true if the given feature is enabled in the current plan.
 * Uses safe defaults (basic features visible) when seatInfo is null.
 */
export function hasFeature(seatInfo: SeatInfo | null, featureName: string): boolean {
  if (!seatInfo) return SAFE_DEFAULT_FEATURES.has(featureName);
  const features = (seatInfo.plan?.features ?? seatInfo.features ?? {}) as Record<string, boolean | undefined>;
  return features[featureName] === true;
}

