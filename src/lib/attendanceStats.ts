import type { TenantClient } from '@/lib/prisma-tenant'

export interface AthleteAttendanceStat {
  id: string
  number: number
  name: string
  ageGroup: string
  ownSessions: number
  ownPresent: number
  otherSessions: number
  otherPresent: number
  total: number
  totalPresent: number
}

// Uma query só (com include) em vez de 1 fetch por sessão — usado tanto pela tab
// Estatísticas de /attendance como pelo export XLSX, para não ter as duas lógicas
// a divergir (a versão antiga do export, por exemplo, contava sessões canceladas).
export async function computeAttendanceStats(
  db: TenantClient,
  ageGroup?: string | null,
): Promise<AthleteAttendanceStat[]> {
  const athletes = await db.athlete.findMany({
    where: ageGroup ? { ageGroup: ageGroup as never } : {},
    orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
    include: {
      attendanceRecords: {
        include: { session: { select: { primaryAgeGroup: true, cancelled: true, sessionType: true } } },
      },
    },
  }) as unknown as Array<{
    id: string; number: number; name: string; ageGroup: string
    attendanceRecords: Array<{
      present: boolean
      session: { primaryAgeGroup: string; cancelled: boolean; sessionType: string }
    }>
  }>

  return athletes.map((a) => {
    const records = a.attendanceRecords.filter((r) => !r.session.cancelled)
    // Sessões SPECIFIC (opcionais, ex: treino extra de guarda-redes) têm sempre
    // primaryAgeGroup fixo — sem esta exclusão, um atleta de outro escalão a participar
    // numa sessão específica opcional aparecia contado como "Outros Escalões", como se
    // tivesse ido a um treino alheio. Continuam a contar em total/totalPresent.
    const own = records.filter((r) => r.session.sessionType !== 'SPECIFIC' && r.session.primaryAgeGroup === a.ageGroup)
    const other = records.filter((r) => r.session.sessionType !== 'SPECIFIC' && r.session.primaryAgeGroup !== a.ageGroup)
    return {
      id: a.id, number: a.number, name: a.name, ageGroup: a.ageGroup,
      ownSessions: own.length, ownPresent: own.filter((r) => r.present).length,
      otherSessions: other.length, otherPresent: other.filter((r) => r.present).length,
      total: records.length, totalPresent: records.filter((r) => r.present).length,
    }
  })
}
