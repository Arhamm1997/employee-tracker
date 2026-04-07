import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth";
import {
  adminCreateChangelog,
  adminListChangelog,
  adminUpdateChangelog,
  adminPublishChangelog,
  adminDeleteChangelog,
} from "../../controllers/changelog.controller";

const router = Router();

router.use(requireAdmin);

// GET  /admin/changelog         — list all entries
router.get("/", adminListChangelog);

// POST /admin/changelog         — create new entry
router.post("/", adminCreateChangelog);

// PUT  /admin/changelog/:id     — update entry
router.put("/:id", adminUpdateChangelog);

// PATCH /admin/changelog/:id/publish — publish or unpublish
router.patch("/:id/publish", adminPublishChangelog);

// DELETE /admin/changelog/:id   — delete entry
router.delete("/:id", adminDeleteChangelog);

export default router;
