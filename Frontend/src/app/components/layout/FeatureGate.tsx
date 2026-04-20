import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Lock } from "lucide-react";
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
 * HOC that wraps a page component with FeatureRoute (redirects on no access).
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

/**
 * HOC that shows a locked upgrade prompt instead of redirecting when a feature
 * is not available. Better UX than withFeatureGate for nav-visible pages.
 */
export function withFeatureGateUpgrade<P extends object>(
  featureName: string,
  Component: React.ComponentType<P>,
  featureTitle: string,
  featureDescription: string,
): React.ComponentType<P> {
  function FeatureGateUpgradeComponent(props: P) {
    const { seatInfo, loading } = useSubscription();
    const navigate = useNavigate();

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
        </div>
      );
    }

    if (!hasFeature(seatInfo, featureName)) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-16 h-16 rounded-full bg-[#6366f1]/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-[#6366f1]" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{featureTitle}</h2>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">{featureDescription}</p>
          <button
            onClick={() => navigate("/dashboard/billing")}
            className="px-6 py-2.5 bg-[#6366f1] text-white rounded-lg font-medium hover:bg-[#5558e6] transition-colors"
          >
            Upgrade Plan
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  }
  FeatureGateUpgradeComponent.displayName = `FeatureGateUpgrade(${Component.displayName ?? Component.name})`;
  return FeatureGateUpgradeComponent;
}
