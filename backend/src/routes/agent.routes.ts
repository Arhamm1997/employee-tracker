import { Router, Request, Response } from "express";
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
import prisma from "../lib/prisma";

const router = Router();

// Agent routes: 120 req/min (increased for live screen frames)
const agentLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: "Too many requests from this agent" },
});

router.use(agentLimit);

// ── Public: latest version check (no auth — called before token registration) ─
router.get("/latest-version", async (_req: Request, res: Response) => {
  try {
    const latest = await prisma.agentVersion.findFirst({
      where: { isLatest: true },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      res.json({ version: null, downloadUrl: null, checksum: null });
      return;
    }
    const vpsUrl = process.env.VPS_URL || `http://localhost:${process.env.PORT || 5001}`;
    res.json({
      version: latest.version,
      downloadUrl: `${vpsUrl}${latest.filePath}`,
      checksum: latest.checksum,
      releaseNotes: latest.releaseNotes ?? null,
    });
  } catch {
    res.status(500).json({ version: null, downloadUrl: null, checksum: null });
  }
});

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
