import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSuperAdmin } from "../middleware/role.middleware";
import {
  downloadBackup,
  resetCompleteApp,
  logFrontendError,
  downloadErrorReport,
} from "../controllers/system.controller";

const router = Router();

// Frontend error reporting — auth optional (token may not exist on login page)
router.post("/frontend-error", logFrontendError);

router.use(authenticate);

router.get("/backup", downloadBackup);
router.post("/reset-complete-app", requireSuperAdmin, resetCompleteApp);

// Error report downloads — superadmin only
router.get("/download-errors", requireSuperAdmin, downloadErrorReport);

export default router;
