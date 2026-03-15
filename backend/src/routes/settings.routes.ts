import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSuperAdmin } from "../middleware/role.middleware";
import { getSettings, updateSettings } from "../controllers/settings.controller";

const router = Router();

router.use(authenticate);
router.get("/", getSettings);
router.put("/", requireSuperAdmin, updateSettings); // Only super_admin can change settings

export default router;
