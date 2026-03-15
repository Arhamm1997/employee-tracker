import { Router } from "express";
import authRoutes from "./auth.routes";
import analyticsRoutes from "./analytics.routes";
import customersRoutes from "./customers.routes";
import systemRoutes from "./system.routes";
import dashboardRoutes from "./dashboard.routes";
import agentsRoutes from "./agents.routes";
import logsRoutes from "./logs.routes";
import plansRoutes from "./plans.routes";
import subscriptionsRoutes from "./subscriptions.routes";
import revenueRoutes from "./revenue.routes";
import usersRoutes from "./users.routes";
import ticketsRoutes from "./tickets.routes";
import agentVersionsRoutes from "./agent-versions.routes";
import invoicesRoutes from "./invoices.routes";
import paymentSettingsRoutes from "./payment-settings.routes";

const router = Router();

// Auth — no middleware (login/verify handled inside)
router.use("/auth", authRoutes);

// All routes below are protected via requireAdmin inside each file
router.use("/dashboard", dashboardRoutes);
router.use("/customers", customersRoutes);
router.use("/plans", plansRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/revenue", revenueRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/agents", agentsRoutes);
router.use("/logs", logsRoutes);
router.use("/system", systemRoutes);
router.use("/users", usersRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/agent-versions", agentVersionsRoutes);

// Phase 7 & 8: Billing / Offline Payment
router.use("/invoices", invoicesRoutes);
router.use("/payment-settings", paymentSettingsRoutes);

export default router;
