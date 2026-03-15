import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSuperAdmin } from "../middleware/role.middleware";
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  toggleAdmin,
  createAdminValidation,
} from "../controllers/admin.controller";
import {
  getAgentUpdates,
  createAgentUpdate,
} from "../controllers/agent.controller";

const router = Router();

router.use(authenticate);

// Admin management (super_admin only for mutations)
router.get("/", getAdmins);
router.post("/", requireSuperAdmin, createAdminValidation, createAdmin);
router.put("/:id/toggle", requireSuperAdmin, toggleAdmin);
router.put("/:id", requireSuperAdmin, updateAdmin);
router.delete("/:id", requireSuperAdmin, deleteAdmin);

export default router;
