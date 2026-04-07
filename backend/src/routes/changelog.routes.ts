import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getChangelog,
  markChangelogRead,
  markAllChangelogRead,
} from "../controllers/changelog.controller";

const router = Router();

router.use(authenticate);

// GET  /changelog            — get published entries with read status
router.get("/", getChangelog);

// POST /changelog/:id/read   — mark one entry as read
router.post("/:id/read", markChangelogRead);

// POST /changelog/read-all   — mark all as read
router.post("/read-all", markAllChangelogRead);

export default router;
