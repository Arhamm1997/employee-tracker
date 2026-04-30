import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateAgent } from "../middleware/agentAuth.middleware";
import {
  verifyAgent,
  heartbeat,
  heartbeatValidation,
  uploadScreenshot,
  screenshotUpload,
  saveBrowserHistory,
  saveUsbEvent,
  reportNewSoftware,
  saveClipboard,
  checkUpdate,
  reportShutdown,
  getPendingCommand,
  saveKeylog,
  saveFileActivity,
  savePrintLog,
  receiveLiveScreenFrame,
} from "../controllers/agent.controller";
import { logAgentError } from "../controllers/system.controller";
import { checkAgentFeature } from "../middleware/agentFeature.middleware";

const router = Router();

// Agent routes: 120 req/min (increased for live screen frames)
const agentLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: "Too many requests from this agent" },
});

router.use(agentLimit);
router.use(authenticateAgent);

router.get("/verify", verifyAgent);
router.post("/heartbeat", heartbeatValidation, heartbeat);
router.post("/screenshot", checkAgentFeature("screenshots"), screenshotUpload.single("screenshot"), uploadScreenshot);
router.post("/browser-history", checkAgentFeature("browserHistory"), saveBrowserHistory); // ✅ plan check
router.post("/usb-event", checkAgentFeature("usbMonitoring"), saveUsbEvent); // ✅ plan check
router.post("/new-software", reportNewSoftware);
router.post("/clipboard", saveClipboard);
router.get("/check-update", checkUpdate);
router.post("/shutdown", reportShutdown);
router.get("/command", getPendingCommand);
router.post("/keylog", checkAgentFeature("keylog"), saveKeylog);
router.post("/file-activity", checkAgentFeature("fileActivity"), saveFileActivity);
router.post("/print-log", checkAgentFeature("printLogs"), savePrintLog);
router.post("/live-frame", screenshotUpload.single("frame"), receiveLiveScreenFrame);
router.post("/error-report", logAgentError);

export default router;
