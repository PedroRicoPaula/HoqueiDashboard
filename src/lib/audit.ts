import { prisma } from './prisma'
import { getClientIp } from './rateLimit'
import { getUserFromRequest } from './auth'
import type { Prisma } from '@prisma/client'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAIL' | 'LOGOUT' | 'CHANGE_PASSWORD' | 'CHANGE_PERMISSIONS' | 'PASSWORD_RESET' | 'PASSWORD_RESET_REQUEST' | 'UPDATE_CLUB_LOGO' | 'REMOVE_CLUB_LOGO' | 'REGISTER' | 'SUBSCRIPTION_ACTIVATED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CANCELLED' | 'CREATE_FREE_CLUB' | 'CHANGE_CLUB_STATUS' | 'DELETE_CLUB'

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
    // Resolve clubId from JWT so each entry is scoped to the right tenant.
    // Falls back to null for unauthenticated events (LOGIN_FAIL, PASSWORD_RESET_REQUEST).
    let clubId: string | undefined
    try {
      const tokenUser = await getUserFromRequest(req)
      clubId = tokenUser?.clubId ?? undefined
    } catch { /* no valid token — unauthenticated event */ }

    await prisma.auditLog.create({
      data: {
        clubId: clubId ?? undefined,
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
