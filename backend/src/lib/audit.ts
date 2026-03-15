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
        changes: context.changes ?? null,
        ip_address: context.ipAddress ?? null,
      },
    });
  } catch (error) {
    logger.error("Failed to write audit log", { error });
  }
}