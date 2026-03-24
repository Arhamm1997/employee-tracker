import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getScreenshots } from "../controllers/screenshot.controller";
import { checkFeature } from "../middleware/featureCheck";

const router = Router();

router.use(authenticate);
router.get("/", checkFeature("screenshots"), getScreenshots);

export default router;
