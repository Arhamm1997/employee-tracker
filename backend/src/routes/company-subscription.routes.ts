import { Router } from "express";
import { authenticateCompany, requireEmailVerified } from "../middleware/companyAuth.middleware";
import { selectPlan } from "../controllers/companySubscription.controller";

const router = Router();

router.post("/select", authenticateCompany, requireEmailVerified, selectPlan);

export default router;
