import { Router, Request, Response } from "express";
import adminMasterRoutes from "./admin/index";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import agentRoutes from "./agent.routes";
import alertRoutes from "./alert.routes";
import dashboardRoutes from "./dashboard.routes";
import employeeRoutes from "./employee.routes";
import reportRoutes from "./report.routes";
import screenshotRoutes from "./screenshot.routes";
import settingsRoutes from "./settings.routes";
import systemRoutes from "./system.routes";
import companyAuthRoutes from "./company-auth.routes";
import plansRoutes from "./plans.routes";
import companySubscriptionRoutes from "./company-subscription.routes";
import subscriptionRoutes from "./subscription.routes";
import paymentRoutes from "./payment.routes";
import cronRoutes from "./cron.routes";
import upgradeRequestRoutes from "./upgrade-request.routes";
import supportTicketRoutes from "./support-ticket.routes";
import { authenticate } from "../middleware/auth.middleware";
import prisma from "../lib/prisma";

const router = Router();

// ── Public: latest agent version (no auth) ────────────────────────────────────
router.get("/agent/latest-version", async (_req: Request, res: Response) => {
  try {
    const latest = await prisma.agentVersion.findFirst({ where: { isLatest: true } });
    if (!latest) {
      res.status(404).json({ message: "No agent version published yet" });
      return;
    }
    const vpsUrl = process.env.VPS_URL || "http://localhost:5001";
    res.json({
      version: latest.version,
      downloadUrl: `${vpsUrl}/downloads/${latest.fileName}`,
      checksum: latest.checksum,
      watchdogDownloadUrl: latest.watchdogFileName
        ? `${vpsUrl}/downloads/${latest.watchdogFileName}`
        : null,
      watchdogChecksum: latest.watchdogChecksum ?? null,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch latest version" });
  }
});

// ── Company: download agent config for employee ───────────────────────────────
router.get("/agent/download/:employeeId", authenticate, async (req: Request, res: Response) => {
  const authReq = req as import("../middleware/auth.middleware").AuthRequest;
  const companyId = authReq.admin?.companyId;
  const { employeeId } = req.params;

  try {
    const [employee, latest, settings] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, ...(companyId ? { companyId } : {}) },
        select: { id: true, employeeCode: true, agentToken: true },
      }),
      prisma.agentVersion.findFirst({ where: { isLatest: true } }),
      prisma.settings.findFirst({ where: companyId ? { companyId } : {} }),
    ]);

    if (!employee) {
      res.status(404).json({ message: "Employee not found" });
      return;
    }

    const vpsUrl = process.env.VPS_URL || "http://localhost:5001";

    res.json({
      downloadUrl: latest ? `${vpsUrl}/downloads/${latest.fileName}` : null,
      checksum: latest?.checksum ?? null,
      version: latest?.version ?? null,
      config: {
        employeeCode: employee.employeeCode,
        agentToken: employee.agentToken,
        serverUrl: vpsUrl,
        screenshotInterval: settings?.screenshotInterval ?? 10,
        screenshotQuality: settings?.screenshotQuality ?? 60,
        idleThreshold: settings?.idleThreshold ?? 5,
        screenshotsEnabled: settings?.screenshotsEnabled ?? true,
        browserHistoryEnabled: settings?.browserHistoryEnabled ?? true,
        usbMonitoringEnabled: settings?.usbMonitoringEnabled ?? true,
        clipboardEnabled: settings?.clipboardEnabled ?? false,
        blockedSites: settings?.blockedSites ?? [],
      },
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch download info" });
  }
});

// ── Master Admin Panel routes (2FA protected) ─────────────────────────────────
router.use("/admin", adminMasterRoutes);

// ── Company Dashboard routes ──────────────────────────────────────────────────
router.use("/auth", authRoutes);
router.use("/admins", adminRoutes);
router.use("/agent", agentRoutes);
router.use("/alerts", alertRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/employees", employeeRoutes);
router.use("/reports", reportRoutes);
router.use("/screenshots", screenshotRoutes);
router.use("/settings", settingsRoutes);
router.use("/system", systemRoutes);

// ── Company Signup Flow ───────────────────────────────────────────────────────
router.use("/company/auth", companyAuthRoutes);
router.use("/plans", plansRoutes);
router.use("/company/subscription", companySubscriptionRoutes);

// ── Subscription / Seat Info (must be before router.use("/subscription") to avoid being shadowed) ──
router.get("/subscription/info", authenticate, async (req: Request, res: Response) => {
  try {
    const authReq = req as import("../middleware/auth.middleware").AuthRequest;
    const companyId = authReq.admin?.companyId;
    const cFilter = companyId ? { companyId } : {};

    const [settings, adminCount, employeeCount, subscription] = await Promise.all([
      prisma.settings.findFirst({ where: cFilter }),
      prisma.admin.count({ where: { isActive: true, ...cFilter } }),
      prisma.employee.count({ where: { isActive: true, ...cFilter } }),
      companyId
        ? prisma.subscription.findUnique({ where: { companyId }, include: { plan: true } })
        : null,
    ]);

    const maxEmployees = subscription?.plan?.maxSeats ?? settings?.maxEmployees ?? 10;
    const maxAdmins = subscription?.plan?.maxAdmins ?? 5;

    const info = {
      plan: {
        id: subscription?.plan?.id ?? "default",
        name: subscription?.plan?.name ?? "Standard",
        slug: "standard",
        price_pkr: 0,
        max_admins: maxAdmins,
        max_employees: maxEmployees === -1 ? 9999 : maxEmployees,
        features: {
          screenshots: subscription?.plan?.screenshotsEnabled ?? settings?.screenshotsEnabled ?? true,
          browserHistory: subscription?.plan?.browserHistoryEnabled ?? false,
          usbMonitoring: subscription?.plan?.usbMonitoringEnabled ?? false,
          alerts: subscription?.plan?.alertsEnabled ?? false,
          keylogger: subscription?.plan?.keylogEnabled ?? settings?.keylogEnabled ?? false,
          file_monitor: subscription?.plan?.fileActivityEnabled ?? settings?.fileMonitorEnabled ?? false,
          print_logs: subscription?.plan?.printLogsEnabled ?? false,
          advanced_reports: subscription?.plan?.advancedReports ?? false,
          live_screen: subscription?.plan?.livescreenEnabled ?? false,
          shutdown: subscription?.plan?.shutdownEnabled ?? false,
          lock: subscription?.plan?.lockEnabled ?? false,
        },
      },
      admin_seats: {
        used: adminCount,
        limit: maxAdmins === -1 ? -1 : maxAdmins,
        remaining: maxAdmins === -1 ? -1 : Math.max(0, maxAdmins - adminCount),
        percentage: maxAdmins === -1 ? 0 : Math.round((adminCount / maxAdmins) * 100),
      },
      employee_seats: {
        used: employeeCount,
        limit: maxEmployees === -1 ? -1 : maxEmployees,
        remaining: maxEmployees === -1 ? -1 : Math.max(0, maxEmployees - employeeCount),
        percentage: maxEmployees === -1 ? 0 : Math.round((employeeCount / maxEmployees) * 100),
      },
      can_add_admin: maxAdmins === -1 ? true : adminCount < maxAdmins,
      can_add_employee: maxEmployees === -1 ? true : employeeCount < maxEmployees,
    };

    return res.json({ subscription: info });
  } catch {
    return res.status(500).json({ message: "Failed to fetch subscription info" });
  }
});

// ── Subscription Lifecycle (Phase 7) ─────────────────────────────────────────
router.use("/subscription", subscriptionRoutes);

// ── Offline Payment (Phase 8) ─────────────────────────────────────────────────
router.use("/payment", paymentRoutes);

// ── Cron Jobs ─────────────────────────────────────────────────────────────────
router.use("/cron", cronRoutes);
router.use("/upgrade-request", upgradeRequestRoutes);
router.use("/support", supportTicketRoutes);

export default router;
