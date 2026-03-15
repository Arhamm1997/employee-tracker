import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import prisma from "../../lib/prisma";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOWNLOADS_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".exe")) cb(null, true);
    else cb(new Error("Only .exe files are allowed"));
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

export default router;
