import { NextFunction, Request, Response } from "express";
import { verifyAdminJwt } from "../lib/jwt";
import logger from "../lib/logger";

export interface AdminInfo {
  id: string;
  email: string;
  role: string;
}

export interface AdminRequest extends Request {
  admin?: AdminInfo;
}

export async function adminAuthMiddleware(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
    }

    const token = authHeader.slice("Bearer ".length);
    const payload = verifyAdminJwt(token);

    req.admin = {
      id: payload.admin_id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.error("adminAuthMiddleware error", { error });
    return res.status(401).json({
      success: false,
      error: "Invalid or expired admin token",
      code: "ADMIN_INVALID_TOKEN",
    });
  }
}