import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface AgentRequest extends Request {
  employee?: {
    id: string;
    employeeCode: string;
    name: string;
    department: string;
    isActive: boolean;
    companyId: string | null;
  };
}

export async function authenticateAgent(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Accept either Authorization: Bearer <token> or x-agent-token header
  const bearer = req.headers.authorization;
  const headerToken = bearer?.startsWith("Bearer ") ? bearer.split(" ")[1] : undefined;
  const agentToken = (headerToken || (req.headers["x-agent-token"] as string | undefined))?.trim();

  if (!agentToken) {
    res.status(401).json({ message: "Agent token required" });
    return;
  }

  const secret = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Agent JWT secret is not configured" });
    return;
  }

  try {
    // Attempt JWT verification first (new behaviour)
    const decoded = jwt.verify(agentToken, secret) as {
      employeeId: string;
      companyId: string | null;
      agentId: string;
      type?: string;
    };

    if (decoded.type && decoded.type !== "agent") {
      throw new Error("Invalid token type");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        department: true,
        isActive: true,
        companyId: true,
      },
    });

    if (!employee) {
      res.status(401).json({ message: "Invalid agent token" });
      return;
    }

    if (!employee.isActive) {
      res.status(403).json({ message: "Employee account is disabled" });
      return;
    }

    req.employee = employee;
    next();
  } catch (err) {
    // Fallback to legacy token match (raw token stored in db)
    try {
      const employee = await prisma.employee.findUnique({
        where: { agentToken },
        select: {
          id: true,
          employeeCode: true,
          name: true,
          department: true,
          isActive: true,
          companyId: true,
        },
      });

      if (!employee) {
        res.status(401).json({ message: "Invalid agent token" });
        return;
      }

      if (!employee.isActive) {
        res.status(403).json({ message: "Employee account is disabled" });
        return;
      }

      req.employee = employee;
      next();
    } catch {
      res.status(500).json({ message: "Token verification failed" });
    }
  }
}
