import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useSubscription, hasFeature } from "../../lib/subscription-context";

interface FeatureGateProps {
  featureName: string;
  children: React.ReactNode;
  /** Content to render when feature is unavailable. Defaults to null. */
  fallback?: React.ReactNode;
}

/**
 * Inline feature gate — renders children only when featureName is enabled.
 * Shows nothing (or fallback) while plan is loading.
 */
export function FeatureGate({ featureName, children, fallback = null }: FeatureGateProps) {
  const { seatInfo, loading } = useSubscription();
  if (loading) return null;
  return hasFeature(seatInfo, featureName) ? <>{children}</> : <>{fallback}</>;
}

interface FeatureRouteProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * Route-level feature gate — redirects to /dashboard with a toast when the
 * feature is not available. Shows a spinner while the plan is loading.
 */
export function FeatureRoute({ featureName, children }: FeatureRouteProps) {
  const { seatInfo, loading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !hasFeature(seatInfo, featureName)) {
      toast.info("Upgrade your plan to access this feature.");
      navigate("/dashboard", { replace: true });
    }
  }, [loading, seatInfo, featureName, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasFeature(seatInfo, featureName)) return null;
  return <>{children}</>;
}

/**
 * HOC that wraps a page component with FeatureRoute.
 * Use at module level (not inside render) so the component reference is stable.
 *
 * Example:
 *   const ReportsGated = withFeatureGate("advancedReports", ReportsPage);
 *   { path: "dashboard/reports", Component: ReportsGated }
 */
export function withFeatureGate<P extends object>(
  featureName: string,
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  function FeatureGatedComponent(props: P) {
    return (
      <FeatureRoute featureName={featureName}>
        <Component {...props} />
      </FeatureRoute>
    );
  }
  FeatureGatedComponent.displayName = `FeatureGated(${Component.displayName ?? Component.name})`;
  return FeatureGatedComponent;
}
