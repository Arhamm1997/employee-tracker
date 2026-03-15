import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { hashPassword, comparePassword } from "../lib/bcrypt";
import { signUserJwt } from "../lib/jwt";
import { logError } from "../lib/logger";
import { getSeatInfo } from "../lib/seatManagement";
import { authenticate as authMiddleware, AuthRequest as AuthedRequest } from "../middleware/auth.middleware";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Company already exists",
        code: "COMPANY_EXISTS",
      });
    }

    const passwordHash = await hashPassword(password);

    const freePlan = await prisma.plan.findUnique({
      where: { slug: "free" },
    });

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const company = await prisma.company.create({
      data: {
        name,
        email,
        password_hash: passwordHash,
        plan_id: freePlan?.id ?? null,
        subscription_status: "trial",
        is_trial: true,
        trial_start: new Date(),
        trial_end: trialEnd,
        current_admin_count: 1,
      },
    });

    const user = await prisma.user.create({
      data: {
        company_id: company.id,
        email,
        password_hash: passwordHash,
        full_name: name,
        role: "admin",
      },
    });

    const token = signUserJwt({
      type: "user",
      company_id: company.id,
      user_id: user.id,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    logError(error, "auth_register");
    return res.status(500).json({
      success: false,
      error: "Failed to register company",
      code: "REGISTER_FAILED",
    });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;

    const company = await prisma.company.findUnique({
      where: { email },
      include: { plan: true },
    });

    if (!company) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    const user = await prisma.user.findFirst({
      where: { company_id: company.id, email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    const token = signUserJwt({
      type: "user",
      company_id: company.id,
      user_id: user.id,
      role: user.role,
    });

    return res.json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    logError(error, "auth_login");
    return res.status(500).json({
      success: false,
      error: "Failed to login",
      code: "LOGIN_FAILED",
    });
  }
});

router.get("/me", authMiddleware, async (req: AuthedRequest, res: Response) => {
  try {
    if (!req.company || !req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.company.id },
      include: { plan: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
        code: "COMPANY_NOT_FOUND",
      });
    }

    const seatInfo = await getSeatInfo(company.id);

    return res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
          subscription_status: company.subscription_status,
          is_trial: company.is_trial,
          trial_end: company.trial_end,
          plan: company.plan
            ? {
                id: company.plan.id,
                name: company.plan.name,
                slug: company.plan.slug,
                price_pkr: company.plan.price_pkr,
              }
            : null,
        },
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        },
        seats: seatInfo,
      },
    });
  } catch (error) {
    logError(error, "auth_me");
    return res.status(500).json({
      success: false,
      error: "Failed to load profile",
      code: "ME_FAILED",
    });
  }
});

export default router;

