import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, hashPassword } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, password } = parsed.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email já em uso' }, { status: 409 })
    }

    const hashed = await hashPassword(password)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        permissions: {
          create: { viewAthletes: true, viewMembers: true, viewTraining: true, viewTravel: true },
        },
      },
      include: { permissions: true },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'User', newUser.id, { name: newUser.name, email: newUser.email })
    return NextResponse.json(
      { id: newUser.id, name: newUser.name, email: newUser.email, permissions: newUser.permissions },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Admin users POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
