import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSuperAdmin } from "../middleware/role.middleware";
import {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  deleteAlert,
} from "../controllers/alert.controller";

const router = Router();

router.use(authenticate);

router.get("/", getAlerts);
router.put("/read-all", requireSuperAdmin, markAllAlertsRead);
router.put("/:id/read", markAlertRead);
router.delete("/:id", requireSuperAdmin, deleteAlert);

export default router;
