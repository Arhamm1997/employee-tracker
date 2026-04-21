import { Router } from "express";
import * as companyAuth from "../controllers/companyAuth.controller";

const router = Router();

router.post("/register", companyAuth.register);
router.get("/verify-email", companyAuth.verifyEmail);
router.post("/resend-verification", companyAuth.resendVerification);
router.post("/login", companyAuth.login);

export default router;
