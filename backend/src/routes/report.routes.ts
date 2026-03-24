import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getReports } from "../controllers/report.controller";
import { checkFeature } from "../middleware/featureCheck";

const router = Router();

router.use(authenticate);
router.get("/", checkFeature("advancedReports"), getReports);

export default router;
