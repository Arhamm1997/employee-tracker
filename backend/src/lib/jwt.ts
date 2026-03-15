import jwt from "jsonwebtoken";

interface UserJwtPayload {
  type: "user";
  company_id: string;
  user_id: string;
  role: string;
}

interface AdminJwtPayload {
  type: "admin";
  admin_id: string;
  email: string;
  role: string;
  is_admin: true;
}

interface CompanyTokenPayload {
  type: "company_token";
  company_id: string;
}

type AnyPayload = UserJwtPayload | AdminJwtPayload | CompanyTokenPayload;

const USER_EXPIRES_IN = "7d";
const ADMIN_EXPIRES_IN = "2h";

function getSecret(envKey: "JWT_SECRET" | "ADMIN_JWT_SECRET"): string {
  const secret = process.env[envKey];
  if (!secret) {
    throw new Error(`${envKey} is not set`);
  }
  return secret;
}

export function signUserJwt(payload: UserJwtPayload): string {
  return jwt.sign(payload, getSecret("JWT_SECRET"), {
    expiresIn: USER_EXPIRES_IN,
  });
}

export function signAdminJwt(payload: AdminJwtPayload): string {
  return jwt.sign(payload, getSecret("ADMIN_JWT_SECRET"), {
    expiresIn: ADMIN_EXPIRES_IN,
  });
}

export function signCompanyToken(payload: CompanyTokenPayload): string {
  return jwt.sign(payload, getSecret("JWT_SECRET"), {
    expiresIn: USER_EXPIRES_IN,
  });
}

export function verifyUserJwt(token: string): UserJwtPayload {
  const decoded = jwt.verify(token, getSecret("JWT_SECRET"));
  if (typeof decoded === "string" || decoded.type !== "user") {
    throw new Error("Invalid user token");
  }
  return decoded as UserJwtPayload;
}

export function verifyAdminJwt(token: string): AdminJwtPayload {
  const decoded = jwt.verify(token, getSecret("ADMIN_JWT_SECRET"));
  if (typeof decoded === "string" || decoded.type !== "admin" || !decoded.is_admin) {
    throw new Error("Invalid admin token");
  }
  return decoded as AdminJwtPayload;
}

export function verifyCompanyToken(token: string): CompanyTokenPayload {
  const decoded = jwt.verify(token, getSecret("JWT_SECRET"));
  if (typeof decoded === "string" || decoded.type !== "company_token") {
    throw new Error("Invalid company token");
  }
  return decoded as CompanyTokenPayload;
}

export type { UserJwtPayload, AdminJwtPayload, CompanyTokenPayload, AnyPayload };

