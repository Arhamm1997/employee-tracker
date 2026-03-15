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

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

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
      setSeatInfo(response.subscription);
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
    }
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
  "screenshotsEnabled",
  "browserHistoryEnabled",
  "usbMonitoringEnabled",
  "alertsEnabled",
  "shutdownEnabled",
]);

/**
 * Returns true if the given feature is enabled in the current plan.
 * Uses safe defaults (basic features visible) when seatInfo is null.
 */
export function hasFeature(seatInfo: SeatInfo | null, featureName: string): boolean {
  if (!seatInfo) return SAFE_DEFAULT_FEATURES.has(featureName);
  const features = (seatInfo.features ?? seatInfo.plan?.features ?? {}) as Record<string, boolean | undefined>;
  return features[featureName] === true;
}

