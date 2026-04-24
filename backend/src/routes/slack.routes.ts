import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getOAuthUrl,
  handleOAuthCallback,
  getIntegrationStatus,
  disconnectIntegration,
  listChannels,
  updateSlackSettings,
  getSlackSettings,
  sendTestAlert,
  sendDirectMessage,
  markMessageRead,
  getAlertSlackMessages,
  replyToAlertThread,
  sendAlertToSlackManually,
  handleWebhook,
  getSlackConversations,
  getSlackEmployeeMessages,
} from "../controllers/slack.controller";

const router = Router();

// ── Public: Slack webhook (no auth — Slack calls this) ────────────────────────
router.post("/webhook", (req: Request, res: Response, next: NextFunction) => {
  handleWebhook(req, res).catch(next);
});

// ── Public: OAuth callback (Slack redirects here after authorization) ─────────
router.get("/callback", (req: Request, res: Response, next: NextFunction) => {
  handleOAuthCallback(req, res).catch(next);
});

// ── All routes below require company admin authentication ──────────────────────
router.use(authenticate);

// OAuth
router.get("/auth-url", (req, res, next) => {
  getOAuthUrl(req, res).catch(next);
});

// Integration status
router.get("/integration", (req, res, next) => {
  getIntegrationStatus(req, res, next);
});

router.delete("/integration", (req, res, next) => {
  disconnectIntegration(req, res, next);
});

// Channels
router.get("/channels", (req, res, next) => {
  listChannels(req, res, next);
});

// Settings
router.get("/settings", (req, res, next) => {
  getSlackSettings(req, res, next);
});

router.put("/settings", (req, res, next) => {
  updateSlackSettings(req, res, next);
});

// Test alert
router.post("/test-alert", (req, res, next) => {
  sendTestAlert(req, res, next);
});

// Direct messages
router.post("/message/employee/:employeeId", (req, res, next) => {
  sendDirectMessage(req, res, next);
});

router.post("/message/read/:messageId", (req, res, next) => {
  markMessageRead(req, res, next);
});

// Alert Slack messages
router.get("/alert/:alertId/messages", (req, res, next) => {
  getAlertSlackMessages(req, res, next);
});

// Reply to alert Slack thread
router.post("/alert/:alertId/reply", (req, res, next) => {
  replyToAlertThread(req, res, next);
});

// Manually send alert to Slack
router.post("/alert/:alertId/send", (req, res, next) => {
  sendAlertToSlackManually(req, res, next);
});

// Slack DM conversations (for Messages page)
router.get("/conversations", (req, res, next) => {
  getSlackConversations(req, res, next);
});

router.get("/conversations/:employeeId", (req, res, next) => {
  getSlackEmployeeMessages(req, res, next);
});

export default router;
