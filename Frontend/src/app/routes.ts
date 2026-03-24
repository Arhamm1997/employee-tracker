import { createBrowserRouter, redirect } from "react-router";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { Setup2FAPage } from "./pages/Setup2FAPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";
import { ScreenshotsPage } from "./pages/ScreenshotsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminsPage } from "./pages/AdminsPage";
import { LiveScreenPage } from "./pages/LiveScreenPage";
import { BillingPage } from "./pages/BillingPage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { PaymentPage } from "./pages/PaymentPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { withFeatureGate } from "./components/layout/FeatureGate";

// Feature-gated page wrappers (defined at module level for stable component refs)
// Keys must match what /api/subscription/info returns in plan.features
const ScreenshotsGated = withFeatureGate("screenshots", ScreenshotsPage);
const AlertsGated = withFeatureGate("alerts", AlertsPage);
const ReportsGated = withFeatureGate("advanced_reports", ReportsPage);
const LiveScreenGated = withFeatureGate("live_screen", LiveScreenPage);

const PORTAL_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_PORTAL_URL || "http://localhost:3001";

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", Component: LoginPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/signup", Component: SignupPage },
  { path: "/verify-email", Component: VerifyEmailPage },
  // Redirect select-plan to company-portal (onboarding handled there)
  { path: "/select-plan", loader: () => { window.location.href = `${PORTAL_URL}/select-plan`; return redirect("/login"); } },
  { path: "/payment/:invoiceId", Component: PaymentPage },

  {
    // Standalone page — handles its own auth check to avoid ProtectedRoute's
    // backend-offline logout which races with SocketProvider initialization
    path: "live-screen/:id",
    Component: LiveScreenGated,
  },
  {
    // ProtectedRoute checks auth — redirects to /login if not authenticated
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: DashboardLayout,
        children: [
          { index: true, loader: () => { throw new Response(null, { status: 302, headers: { Location: "/dashboard" } }); } },
          { path: "dashboard", Component: DashboardPage },
          { path: "dashboard/employees", Component: EmployeesPage },
          { path: "dashboard/employees/:id", Component: EmployeeDetailPage },
          { path: "dashboard/screenshots", Component: ScreenshotsGated },
          { path: "dashboard/alerts", Component: AlertsGated },
          { path: "dashboard/reports", Component: ReportsGated },
          { path: "dashboard/settings", Component: SettingsPage },
          { path: "dashboard/admins", Component: AdminsPage },
          { path: "dashboard/billing", Component: BillingPage },
        ],
      },
      // 2FA setup is inside ProtectedRoute (requires auth) but outside DashboardLayout
      { path: "/setup-2fa", Component: Setup2FAPage },
    ],
  },

  // 404 catch-all
  { path: "*", Component: NotFoundPage },
]);
