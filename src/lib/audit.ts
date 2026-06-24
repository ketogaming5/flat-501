import { prisma } from "./db";

// Mirror of the AuditAction enum from prisma/schema.prisma.
// Defined here so this file compiles without a generated Prisma client.
export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "PASSWORD_RESET"
  | "ADJUSTMENT_CREATED"
  | "ADJUSTMENT_UPDATED"
  | "ADJUSTMENT_DELETED"
  | "EXPENSE_CREATED"
  | "SETTLEMENT_CREATED";

export async function writeAuditLog(params: {
  action: AuditAction;
  actorId: string;
  targetId?: string;
  details?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      actorId: params.actorId,
      targetId: params.targetId,
      details: params.details,
    },
  });
}
