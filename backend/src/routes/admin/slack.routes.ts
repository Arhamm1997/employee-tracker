import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth";
import {
  adminGetAllIntegrations,
  adminForceDisconnect,
  adminTogglePlanSlack,
  adminGetPlansSlackStatus,
} from "../../controllers/slack.controller";

const router = Router();

// All admin Slack routes require master admin authentication
router.use(requireAdmin);

// GET /admin/slack/integrations — list all companies' Slack integrations
router.get("/integrations", adminGetAllIntegrations);

// DELETE /admin/slack/integration/:integrationId — force disconnect
router.delete("/integration/:integrationId", adminForceDisconnect);

// GET /admin/slack/plans — get all plans with slack enabled status
router.get("/plans", adminGetPlansSlackStatus);

// PUT /admin/slack/plan/:planId — toggle slack feature for a plan
router.put("/plan/:planId", adminTogglePlanSlack);

export default router;
