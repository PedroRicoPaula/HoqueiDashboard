import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { computeAttendanceStats } from '@/lib/attendanceStats'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup')

    const stats = await computeAttendanceStats(db, ageGroup)
    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Attendance stats GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
