// Lógica de mensalidades partilhada entre /api/fees, /api/dashboard/stats e
// /api/reports/{financial,athletes} — existia duplicada e a divergir entre estes
// ficheiros (o relatório Financeiro ignorava Season.defaultAthleteMonthlyFee,
// discountPercent, e contava meses futuros como "em falta"). Uma única fonte de
// verdade evita voltar a divergir.

export function computeSeasonMonths(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = []
  const d = new Date(startDate)
  d.setDate(1)
  const end = new Date(endDate)
  while (d <= end) {
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

export function computeEffectiveFee(
  athleteMonthlyFee: number,
  discountPercent: number | null | undefined,
  seasonDefaultFee: number | null | undefined,
): number {
  const base = seasonDefaultFee != null ? seasonDefaultFee : athleteMonthlyFee
  if (!base || base <= 0) return 0
  const discount = discountPercent ?? 0
  return parseFloat((base * (1 - discount / 100)).toFixed(2))
}

export function isMonthPast(month: number, year: number, now: Date = new Date()): boolean {
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  return year < currentYear || (year === currentYear && month < currentMonth)
}

export function getCurrentSeasonStart(now: Date = new Date()): number {
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9 ? year : year - 1
}
