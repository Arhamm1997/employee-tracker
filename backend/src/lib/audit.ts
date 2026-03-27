import prisma from "./prisma";
import logger from "./logger";

export interface AuditContext {
  companyId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: unknown;
  ipAddress?: string;
}

export async function logAudit(context: AuditContext): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        company_id: context.companyId,
        user_id: context.userId,
        action: context.action,
        entity_type: context.entityType,
        entity_id: context.entityId,
        changes: context.changes ?? undefined,
        ip_address: context.ipAddress ?? null,
      },
    });
  } catch (error) {
    logger.error("Failed to write audit log", { error });
  }
}

export async function auditLog(params: {
  companyId: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: object;
  ip?: string;
}): Promise<void> {
  try {
    if (!params.companyId) return;
    await prisma.auditLog.create({
      data: {
        company_id: params.companyId,
        user_id: params.userId ?? null,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        changes: params.changes ?? undefined,
        ip_address: params.ip ?? null,
      },
    });
  } catch {
    // audit log failure must never crash the request
  }
}