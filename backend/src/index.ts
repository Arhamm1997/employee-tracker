import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { v2 as cloudinary } from "cloudinary";
import cron from "node-cron";

import logger from "./lib/logger";
import prisma from "./lib/prisma";
import { initWebSocket, getConnectedClients } from "./lib/websocket";
import routes from "./routes/index";
import { startOfflineDetectionJob } from "./jobs/offlineDetection.job";
import { startDataCleanupJob } from "./jobs/dataCleanup.job";
import { verifyEmailConfig } from "./services/email.service";

// ─── Cloudinary Configuration ────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();

// ── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001", // Company Portal (Next.js)
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: origin not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-agent-token",
      "x-agent-version",
    ],
  })
);

// ── Request Logging ───────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.http(msg.trimEnd()) },
    skip: (_req, res) => process.env.NODE_ENV === "production" && res.statusCode < 400,
  })
);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // ✅ Required for httpOnly cookie auth

// ── Serve local screenshots ─────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ── Serve agent downloads ─────────────────────────────────────────────────────
app.use("/downloads", express.static(path.join(process.cwd(), "public", "downloads")));

// ── Ensure payment uploads directory exists ──────────────────────────────────
const paymentUploadsDir = path.join(process.cwd(), "public", "uploads", "payments");
if (!existsSync(paymentUploadsDir)) mkdirSync(paymentUploadsDir, { recursive: true });

// ── Global Rate Limiting (dashboard routes) ───────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  skip: (req) => req.path.startsWith("/api/agent"),
});
app.use("/api", globalLimit);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

// ── Connection Status (backend + agent health) ──────────────────────────────
app.get("/api/connection-status", async (_req, res) => {
  try {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const [onlineAgents, totalEmployees] = await Promise.all([
      prisma.employee.count({
        where: { isActive: true, lastSeenAt: { gte: twoMinsAgo } },
      }),
      prisma.employee.count({ where: { isActive: true } }),
    ]);

    res.json({
      backend: "connected",
      wsClients: getConnectedClients(),
      agentOnline: onlineAgents,
      agentTotal: totalEmployees,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Return 200 so the frontend doesn't treat this as a server crash.
    // The "backend: error" field signals degraded state without triggering
    // the frontend error-reporter loop that causes cascading 500s.
    res.json({
      backend: "error",
      wsClients: 0,
      agentOnline: 0,
      agentTotal: 0,
      timestamp: new Date().toISOString(),
    });
  }
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : "Internal server error";

  if (status >= 500) {
    logger.error(`${err.message}\n${err.stack}`);
  }

  res.status(status).json({ message });
});

// ─── HTTP Server + WebSocket ──────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

server.on("error", (err) => {
  logger.error(`Server error: ${err.message}\n${err.stack}`);
  process.exit(1);
});

initWebSocket(server);

// ─── Start ────────────────────────────────────────────────────────────────────

async function bootstrap() {
  verifyEmailConfig().catch(() => {});

  cron.schedule("*/4 * * * *", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      logger.warn("DB keepalive ping failed:", err);
    }
  });
  logger.info("DB keepalive job started (every 4 minutes)");

  startOfflineDetectionJob();
  startDataCleanupJob();

  // ── Daily subscription expiry check (runs at 02:00 AM) ─────────────────────
  cron.schedule("0 2 * * *", async () => {
    logger.info("Running daily subscription expiry check...");
    try {
      const PORTAL_URL = process.env.COMPANY_PORTAL_URL || "http://localhost:3001";
      const renewUrl = `${PORTAL_URL}/billing`;
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { sendExpiryWarningEmail, sendExpiryNotificationEmail } = await import(
        "./services/email.service"
      );

      const expiringSoon = await prisma.subscription.findMany({
        where: { status: "ACTIVE", currentPeriodEnd: { gt: now, lte: sevenDaysFromNow } },
        include: {
          company: { select: { email: true, name: true } },
          plan: { select: { name: true } },
        },
      });

      for (const sub of expiringSoon) {
        sendExpiryWarningEmail(
          sub.company.email,
          sub.company.name,
          sub.plan.name,
          sub.currentPeriodEnd,
          renewUrl
        ).catch(() => {});
      }

      const expired = await prisma.subscription.findMany({
        where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
        include: { company: { select: { email: true, name: true } } },
      });

      if (expired.length > 0) {
        await prisma.subscription.updateMany({
          where: { id: { in: expired.map((s) => s.id) } },
          data: { status: "EXPIRED" },
        });

        for (const sub of expired) {
          sendExpiryNotificationEmail(sub.company.email, sub.company.name, renewUrl).catch(
            () => {}
          );
        }
      }

      logger.info(
        `Subscription cron: ${expiringSoon.length} warnings sent, ${expired.length} expired`
      );
    } catch (err) {
      logger.error("Daily subscription cron error:", err);
    }
  });
  logger.info("Daily subscription expiry check scheduled (02:00 AM)");

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`
╔══════════════════════════════════════════════════╗
║         Employee Monitor API Server              ║
╠══════════════════════════════════════════════════╣
║  HTTP  → http://localhost:${PORT}                   ║
║  WS    → ws://localhost:${PORT}/ws                  ║
║  Env   → ${(process.env.NODE_ENV || "development").padEnd(10)}                     ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

// ── Unhandled Error Capture ───────────────────────────────────────────────────
process.on("unhandledRejection", (reason: unknown) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logger.error(`Unhandled promise rejection: ${msg}`);
});

process.on("uncaughtException", (err: Error) => {
  logger.error(`Uncaught exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

export default app;