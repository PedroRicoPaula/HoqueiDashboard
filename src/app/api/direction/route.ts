import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createDirectionSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const members = await db.directionMember.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(members)
  } catch (error) {
    logger.error('Direction GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()

    if (Array.isArray(body)) {
      const results: unknown[] = []
      const errors: { name: string; error: unknown }[] = []
      let updated = 0
      for (const item of body) {
        const parsed = createDirectionSchema.safeParse(item)
        if (!parsed.success) { errors.push({ name: item.name ?? 'unknown', error: parsed.error.flatten() }); continue }
        try {
          // Reimportar o mesmo CSV (ex: federação actualizou o plantel) não pode duplicar
          // pessoas — junta aos cargos já existentes em vez de criar outra linha.
          const existing = await db.directionMember.findFirst({
            where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
          })
          if (existing) {
            const mergedRoles = Array.from(new Set([...(existing as { roles: string[] }).roles, ...parsed.data.roles]))
            const member = await db.directionMember.update({
              where: { id: (existing as { id: string }).id },
              data: { roles: mergedRoles },
            })
            await logAudit(req, user.id, user.email, 'UPDATE', 'DirectionMember', (member as { id: string }).id, { name: (member as { name: string }).name, roles: mergedRoles, import: true })
            updated++
          } else {
            const member = await db.directionMember.create({ data: { ...parsed.data, clubId: ctx.clubId } })
            await logAudit(req, user.id, user.email, 'CREATE', 'DirectionMember', (member as { id: string }).id, { name: (member as { name: string }).name, import: true })
          }
          results.push(item)
        } catch (e) {
          errors.push({ name: item.name ?? 'unknown', error: String(e) })
        }
      }
      return NextResponse.json({ created: results.length - updated, updated, errors })
    }

    const parsed = createDirectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const member = await db.directionMember.create({ data: { ...parsed.data, clubId: ctx.clubId } })

    await logAudit(req, user.id, user.email, 'CREATE', 'DirectionMember', (member as { id: string }).id, { name: (member as { name: string }).name })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    logger.error('Direction POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
