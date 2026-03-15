import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getDashboard, getDashboardStats } from "../controllers/dashboard.controller";

const router = Router();

router.use(authenticate);

router.get("/", getDashboard);
router.get("/stats", getDashboardStats);

export default router;
