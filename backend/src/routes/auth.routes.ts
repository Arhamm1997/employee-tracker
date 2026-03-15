import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  deleteMe,
  setup2FA,
  enable2FA,
  verify2FA,
  disable2FA,
  forgotPassword,
  resetPassword,
  loginValidation,
  changePasswordValidation,
} from "../controllers/auth.controller";

const router = Router();

// Auth
router.post("/login", loginValidation, login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
router.post("/change-password", authenticate, changePasswordValidation, changePassword);
router.delete("/me", authenticate, deleteMe);

// 2FA
router.post("/2fa/setup", authenticate, setup2FA);
router.post("/2fa/enable", authenticate, enable2FA);
router.post("/2fa/verify", verify2FA);
router.post("/2fa/disable", authenticate, disable2FA);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
