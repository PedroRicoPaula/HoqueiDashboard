import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      permissions: user.permissions,
    })
  } catch (error) {
    logger.error('Me error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
