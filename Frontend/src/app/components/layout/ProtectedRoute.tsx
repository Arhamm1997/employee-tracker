import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-types";
import { useSocket } from "../../lib/socket-context";

export function ProtectedRoute() {
  const { isAuthenticated, loading, logout } = useAuth();
  const { connectionStatus } = useSocket();
  const navigate = useNavigate();

  // Backend is confirmed offline (not just initially checking)
  const backendOffline =
    connectionStatus.backend === "disconnected" &&
    !connectionStatus.backendChecking;

  // If backend goes offline while the user is logged in → force logout.
  // Use a 10s delay so transient WS drops / server restarts don't trigger this.
  useEffect(() => {
    if (!loading && isAuthenticated && backendOffline) {
      const timer = setTimeout(() => {
        logout();
        navigate("/login", {
          state: { reason: "backend_offline" },
          replace: true,
        });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated, backendOffline, logout, navigate]);

  // Wait for auth to finish checking localStorage before deciding
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
