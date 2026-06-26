import { getUserFromRequest } from './auth'
import { getTenantClient } from './prisma-tenant'
import { NextResponse } from 'next/server'

export type DbHandler = Awaited<ReturnType<typeof getDbForRequest>>

/**
 * Returns authenticated user + tenant-scoped Prisma client.
 * Use this in all dashboard API routes instead of the global `prisma`.
 */
export async function getDbForRequest(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null

  const clubId = user.clubId
  if (!clubId) return null

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { status: true } })
  if (!club || club.status === 'CANCELLED' || club.status === 'SUSPENDED') return null

  const db = getTenantClient(clubId)
  return { user, db, clubId }
}

/** Shortcut: returns 401 if unauthenticated, or passes ctx to handler */
export async function withAuth(
  req: Request,
  handler: (ctx: { user: Awaited<ReturnType<typeof getUserFromRequest>> & object; db: ReturnType<typeof getTenantClient>; clubId: string }) => Promise<NextResponse>
): Promise<NextResponse> {
  const ctx = await getDbForRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return handler(ctx as Parameters<typeof handler>[0])
}
