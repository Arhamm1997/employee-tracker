import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getScreenshots } from "../controllers/screenshot.controller";

const router = Router();

router.use(authenticate);
router.get("/", getScreenshots);

export default router;
