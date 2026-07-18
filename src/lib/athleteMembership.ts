export interface SeasonWindow {
  startDate: Date
  endDate: Date
}

/**
 * Filtro Prisma para "atletas que pertenciam ao clube durante esta época".
 * `joinedAt`/`leftAt` nulos significam "sempre foi membro"/"ainda é membro" — um atleta
 * sem qualquer um dos dois definidos aparece em todas as épocas, tal como hoje.
 * Passar `null` (sem época seleccionada / "Todas as épocas") devolve `{}`, sem filtro.
 */
export function athleteMembershipWhere(season: SeasonWindow | null) {
  if (!season) return {}
  return {
    AND: [
      { OR: [{ joinedAt: null }, { joinedAt: { lte: season.endDate } }] },
      { OR: [{ leftAt: null }, { leftAt: { gte: season.startDate } }] },
    ],
  }
}

/** Mesma lógica que `athleteMembershipWhere`, avaliada em memória para um atleta já carregado. */
export function wasAthleteActiveInSeason(
  athlete: { joinedAt: Date | string | null; leftAt: Date | string | null },
  season: SeasonWindow
): boolean {
  const joinedAt = athlete.joinedAt ? new Date(athlete.joinedAt) : null
  const leftAt = athlete.leftAt ? new Date(athlete.leftAt) : null
  const joinedOk = !joinedAt || joinedAt <= season.endDate
  const leftOk = !leftAt || leftAt >= season.startDate
  return joinedOk && leftOk
}
