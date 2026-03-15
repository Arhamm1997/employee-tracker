import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export const requireSuperAdmin = requireRole("super_admin");
