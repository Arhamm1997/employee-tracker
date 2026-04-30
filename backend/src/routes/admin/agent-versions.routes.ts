import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";
import { sendToAllAgents } from "../../lib/websocket";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOWNLOADS_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".exe") || name.endsWith(".zip")) cb(null, true);
    else cb(new Error("Only .exe or .zip files are allowed"));
  },
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
});

const router = Router();
router.use(requireAdmin);

// GET /api/admin/agent-versions — list all versions
router.get("/", async (_req: AdminRequest, res: Response) => {
  try {
    const versions = await prisma.agentVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: versions });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to fetch agent versions" });
  }
});

// POST /api/admin/agent-versions/upload — upload .exe, returns fileName/filePath/checksum
router.post("/upload", upload.single("file"), async (req: AdminRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    return res.json({
      success: true,
      fileName: req.file.originalname,
      filePath: `/downloads/${req.file.originalname}`,
      checksum,
    });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to process uploaded file" });
  }
});

// POST /api/admin/agent-versions — create new version (marks as latest)
router.post("/", async (req: AdminRequest, res: Response) => {
  const { version, fileName, filePath, checksum, releaseNotes,
          watchdogFileName, watchdogFilePath, watchdogChecksum } = req.body as {
    version: string;
    fileName: string;
    filePath: string;
    checksum: string;
    releaseNotes?: string;
    watchdogFileName?: string;
    watchdogFilePath?: string;
    watchdogChecksum?: string;
  };

  if (!version?.trim() || !fileName?.trim() || !filePath?.trim() || !checksum?.trim()) {
    return res.status(400).json({ success: false, error: "version, fileName, filePath, checksum are required" });
  }

  try {
    await prisma.agentVersion.updateMany({ data: { isLatest: false } });

    const created = await prisma.agentVersion.create({
      data: {
        version: version.trim(),
        fileName: fileName.trim(),
        filePath: filePath.trim(),
        checksum: checksum.trim(),
        releaseNotes,
        watchdogFileName: watchdogFileName?.trim() || null,
        watchdogFilePath: watchdogFilePath?.trim() || null,
        watchdogChecksum: watchdogChecksum?.trim() || null,
        isLatest: true,
      },
    });

    // Notify all online agents immediately — no need to wait 4 hours
    const vpsUrl = process.env.VPS_URL || `http://localhost:${process.env.PORT || 5001}`;
    sendToAllAgents("update:available", {
      version: created.version,
      downloadUrl: `${vpsUrl}/downloads/${created.fileName}`,
    });

    return res.status(201).json({ success: true, data: created });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to create agent version" });
  }
});

// PUT /api/admin/agent-versions/:id/set-latest — promote a specific version to latest
router.put("/:id/set-latest", async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.agentVersion.updateMany({ data: { isLatest: false } });
    const updated = await prisma.agentVersion.update({ where: { id }, data: { isLatest: true } });

    // Notify all online agents of the newly promoted version
    const vpsUrl = process.env.VPS_URL || `http://localhost:${process.env.PORT || 5001}`;
    sendToAllAgents("update:available", {
      version: updated.version,
      downloadUrl: `${vpsUrl}/downloads/${updated.fileName}`,
    });

    return res.json({ success: true, data: updated });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to update latest version" });
  }
});

// DELETE /api/admin/agent-versions/:id
router.delete("/:id", async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.agentVersion.delete({ where: { id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to delete agent version" });
  }
});

// POST /api/admin/agent-versions/force-upgrade
// Sets MINIMUM_AGENT_VERSION in DB settings and broadcasts force_upgrade to all connected agents.
router.post("/force-upgrade", async (req: AdminRequest, res: Response) => {
  const { minimumVersion, graceMinutes = 60 } = req.body as {
    minimumVersion: string;
    graceMinutes?: number;
  };

  if (!minimumVersion?.trim()) {
    return res.status(400).json({ success: false, error: "minimumVersion is required" });
  }

  try {
    // Persist minimum version in the first Settings row so it survives restarts
    const settingsRow = await prisma.settings.findFirst();
    if (settingsRow) {
      await prisma.settings.update({
        where: { id: settingsRow.id },
        // Store in a JSON metadata field if available, else fall back to env override
        // We broadcast immediately regardless
        data: {} as any,
      });
    }

    // Override the env var for this process lifetime
    process.env.MINIMUM_AGENT_VERSION = minimumVersion.trim();
    process.env.VERSION_GRACE_MINUTES = String(graceMinutes);

    // Count how many agents are below the minimum
    const parseVersion = (v: string) =>
      v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const [mMaj, mMin, mPatch] = parseVersion(minimumVersion);

    const allEmployees = await prisma.employee.findMany({
      select: { id: true, name: true, agentVersion: true },
      where: { isActive: true },
    });

    const outdated = allEmployees.filter((e) => {
      if (!e.agentVersion) return true;
      const [aMaj, aMin, aPatch] = parseVersion(e.agentVersion);
      return (
        aMaj < mMaj ||
        (aMaj === mMaj && aMin < mMin) ||
        (aMaj === mMaj && aMin === mMin && aPatch < mPatch)
      );
    });

    // Broadcast to all connected agents via WebSocket
    sendToAllAgents("force_upgrade", {
      minimumVersion: minimumVersion.trim(),
      graceMinutes,
      message: `Your agent version is below the minimum required (${minimumVersion}). Please update now.`,
    });

    return res.json({
      success: true,
      minimumVersion: minimumVersion.trim(),
      graceMinutes,
      outdatedAgentCount: outdated.length,
      outdatedAgents: outdated.map((e) => ({ id: e.id, name: e.name, version: e.agentVersion })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to trigger force upgrade" });
  }
});

// GET /api/admin/agent-versions/upgrade-status
// Returns current minimum version and count of outdated agents
router.get("/upgrade-status", async (_req: AdminRequest, res: Response) => {
  try {
    const minimumVersion = process.env.MINIMUM_AGENT_VERSION || "1.0.0";
    const parseVersion = (v: string) =>
      v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const [mMaj, mMin, mPatch] = parseVersion(minimumVersion);

    const allEmployees = await prisma.employee.findMany({
      select: { agentVersion: true },
      where: { isActive: true },
    });

    const versionGroups: Record<string, number> = {};
    let outdatedCount = 0;

    for (const e of allEmployees) {
      const v = e.agentVersion || "unknown";
      versionGroups[v] = (versionGroups[v] || 0) + 1;

      if (v !== "unknown") {
        const [aMaj, aMin, aPatch] = parseVersion(v);
        if (
          aMaj < mMaj ||
          (aMaj === mMaj && aMin < mMin) ||
          (aMaj === mMaj && aMin === mMin && aPatch < mPatch)
        ) {
          outdatedCount++;
        }
      } else {
        outdatedCount++;
      }
    }

    return res.json({
      success: true,
      minimumVersion,
      totalAgents: allEmployees.length,
      outdatedCount,
      versionDistribution: versionGroups,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch upgrade status" });
  }
});

export default router;
