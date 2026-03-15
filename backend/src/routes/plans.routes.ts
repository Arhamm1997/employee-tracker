import { Router } from "express";
import { getPlans } from "../controllers/plans.controller";

const router = Router();

// Public — no auth required
router.get("/", getPlans);

export default router;
