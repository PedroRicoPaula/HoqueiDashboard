import { prisma } from './prisma'
import { getClientIp } from './rateLimit'
import type { Prisma } from '@prisma/client'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAIL' | 'LOGOUT' | 'CHANGE_PASSWORD' | 'CHANGE_PERMISSIONS' | 'PASSWORD_RESET' | 'PASSWORD_RESET_REQUEST' | 'UPDATE_CLUB_LOGO' | 'REMOVE_CLUB_LOGO' | 'REGISTER' | 'SUBSCRIPTION_ACTIVATED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CANCELLED'

export async function logAudit(
  req: Request,
  userId: string | null,
  userEmail: string | null,
  action: AuditAction,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        userEmail,
        action,
        entity,
        entityId,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
        ip: getClientIp(req),
      },
    })
  } catch {
    // Audit log failures must never break the main request
  }
}
