'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, Handshake, Package, AlertTriangle, Plane, Euro, TrendingUp, TrendingDown, ClipboardCheck, Shirt, RefreshCw, HardHat } from 'lucide-react'
import { format } from 'date-fns'
import { MATERIAL_STATE_COLORS } from '@/lib/constants'
import { useDashT } from '@/hooks/useDashT'
import { useDashLabels } from '@/hooks/useDashLabels'
import { useAuthStore } from '@/store/authStore'
import { getDateLocale, getNumberLocale } from '@/lib/date-locale'

interface Revenue {
  seasonLabel: string
  athleteFees: number
  memberQuotas: number
  sponsors: number
}

interface MaterialCosts {
  total: number
  savedByAthletes: number
  clubCost: number
}

interface AttendanceSummary {
  sessionsLast30Days: number
  presencesLast30Days: number
}

interface TextileSummary {
  assignedCount: number
  savedByAthletes: number
  clubCost: number
}

interface Expenses {
  year: number
  materialsClubCost: number
  textilesClubCost: number
  directionSalaries: number
}

interface DashboardStats {
  counts: {
    athletes: number
    members: number
    sponsors: number
    materials: number
  }
  athletesByAgeGroup: { ageGroup: string; count: number }[]
  materialsByState: { state: string; count: number }[]
  upcomingTravels: { id: string; opponent: string; departureDate: string; transport?: string }[]
  expiringSponsors: { id: string; name: string; contractEnd: string }[]
  lateQuotas: number
  athletesWithLatePayments: number
  revenue: Revenue
  materialCosts: MaterialCosts
  attendance: AttendanceSummary
  textiles: TextileSummary
  expenses: Expenses
}

function RevenueChart({ revenue, t, numLocale }: { revenue: Revenue; t: ReturnType<typeof useDashT>; numLocale: string }) {
  const categories = [
    { label: t('dashboard.monthlyFees'), value: revenue.athleteFees, color: 'bg-blue-500' },
    { label: t('dashboard.memberQuotas'), value: revenue.memberQuotas, color: 'bg-emerald-500' },
    { label: t('dashboard.sponsors'), value: revenue.sponsors, color: 'bg-purple-500' },
  ]
  const total = categories.reduce((s, c) => s + c.value, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noRevenue')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-full overflow-hidden h-4">
        {categories.map((cat) => {
          const pct = total > 0 ? (cat.value / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={cat.label}
              className={`${cat.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${cat.label}: ${cat.value.toFixed(2)}€ (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>
      <div className="space-y-2">
        {categories.map((cat) => {
          const pct = total > 0 ? (cat.value / total) * 100 : 0
          return (
            <div key={cat.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${cat.color}`} />
              <span className="text-sm flex-1">{cat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{cat.value.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
              <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">{t('common.total')}</span>
          <span className="text-sm font-bold tabular-nums text-primary">{total.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
          <span className="w-12" />
        </div>
      </div>
    </div>
  )
}

function ExpensesChart({ expenses, t, numLocale }: { expenses: Expenses; t: ReturnType<typeof useDashT>; numLocale: string }) {
  const categories = [
    { label: t('dashboard.hockeyMaterials'), value: expenses.materialsClubCost, color: 'bg-orange-500' },
    { label: t('dashboard.textiles'), value: expenses.textilesClubCost, color: 'bg-rose-500' },
    { label: t('dashboard.directionSalaries'), value: expenses.directionSalaries, color: 'bg-violet-500' },
  ]
  const total = categories.reduce((s, c) => s + c.value, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">{t('dashboard.noExpenses')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-full overflow-hidden h-4">
        {categories.map((cat) => {
          const pct = total > 0 ? (cat.value / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div
              key={cat.label}
              className={`${cat.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${cat.label}: ${cat.value.toFixed(2)}€ (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>
      <div className="space-y-2">
        {categories.map((cat) => {
          const pct = total > 0 ? (cat.value / total) * 100 : 0
          return (
            <div key={cat.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${cat.color}`} />
              <span className="text-sm flex-1">{cat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{cat.value.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
              <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">{t('common.total')}</span>
          <span className="text-sm font-bold tabular-nums text-destructive">{total.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
          <span className="w-12" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const t = useDashT()
  const labels = useDashLabels()
  const lang = useAuthStore((s) => s.clubLanguage)
  const dateLocale = getDateLocale(lang)
  const numLocale = getNumberLocale(lang)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        setStats(await res.json())
        setLastUpdated(new Date())
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-48 bg-gray-200 rounded-lg" />
          <div className="h-48 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {t('dashboard.updatedAt')} {format(lastUpdated, 'HH:mm', { locale: dateLocale })}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStats(true)}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Link href="/athletes">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('nav.athletes')}</p>
                  <p className="text-3xl font-bold">{stats?.counts.athletes ?? 0}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/members">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('nav.members')}</p>
                  <p className="text-3xl font-bold">{stats?.counts.members ?? 0}</p>
                </div>
                <UserCheck className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sponsors">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('nav.sponsors')}</p>
                  <p className="text-3xl font-bold">{stats?.counts.sponsors ?? 0}</p>
                </div>
                <Handshake className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/materials">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('nav.materials')}</p>
                  <p className="text-3xl font-bold">{stats?.counts.materials ?? 0}</p>
                </div>
                <Package className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/attendance">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.trainings30d')}</p>
                  <p className="text-3xl font-bold">{stats?.attendance?.sessionsLast30Days ?? 0}</p>
                  {(stats?.attendance?.presencesLast30Days ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">{stats?.attendance?.presencesLast30Days} {t('dashboard.presences')}</p>
                  )}
                </div>
                <ClipboardCheck className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/textiles">
          <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.textilesAssigned')}</p>
                  <p className="text-3xl font-bold">{stats?.textiles?.assignedCount ?? 0}</p>
                  {(stats?.textiles?.clubCost ?? 0) > 0 && (
                    <p className="text-xs text-orange-600">{(stats?.textiles?.clubCost ?? 0).toFixed(0)}€ {t('dashboard.club')}</p>
                  )}
                </div>
                <Shirt className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('dashboard.revenue')}
              {stats?.revenue && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {t('dashboard.monthlyFees')}: {t('dashboard.season')} {stats.revenue.seasonLabel} · {t('dashboard.memberQuotas')}: {new Date().getFullYear()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenue ? (
              <RevenueChart revenue={stats.revenue} t={t} numLocale={numLocale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.monthlyFees')} ({t('dashboard.season')} {stats?.revenue?.seasonLabel})</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(stats?.revenue.athleteFees ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
                <Euro className="h-5 w-5 text-blue-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-emerald-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.memberQuotas')} ({new Date().getFullYear()})</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {(stats?.revenue.memberQuotas ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
                <Euro className="h-5 w-5 text-emerald-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-purple-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.sponsors')} ({t('common.active')})</p>
                  <p className="text-xl font-bold text-purple-600">
                    {(stats?.revenue.sponsors ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
                <Euro className="h-5 w-5 text-purple-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expenses Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              {t('dashboard.expenses')}
              {stats?.expenses && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {t('dashboard.hockeyMaterials')}: {t('dashboard.accumulated')} · {t('dashboard.directionSalaries')}: {stats.expenses.year}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.expenses ? (
              <ExpensesChart expenses={stats.expenses} t={t} numLocale={numLocale} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-orange-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.hockeyMaterials')} ({t('dashboard.accumulated')})</p>
                  <p className="text-xl font-bold text-orange-600">
                    {(stats?.expenses.materialsClubCost ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                  {(stats?.materialCosts.savedByAthletes ?? 0) > 0 && (
                    <p className="text-xs text-green-600">
                      -{(stats?.materialCosts.savedByAthletes ?? 0).toFixed(0)}€ {t('dashboard.paidByAthletes')}
                    </p>
                  )}
                </div>
                <Package className="h-5 w-5 text-orange-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-rose-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.textiles')} ({t('dashboard.accumulated')})</p>
                  <p className="text-xl font-bold text-rose-600">
                    {(stats?.expenses.textilesClubCost ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                  {(stats?.textiles.savedByAthletes ?? 0) > 0 && (
                    <p className="text-xs text-green-600">
                      -{(stats?.textiles.savedByAthletes ?? 0).toFixed(0)}€ {t('dashboard.paidByAthletes')}
                    </p>
                  )}
                </div>
                <Shirt className="h-5 w-5 text-rose-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-violet-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t('dashboard.directionSalaries')} ({stats?.expenses.year})</p>
                  <p className="text-xl font-bold text-violet-600">
                    {(stats?.expenses.directionSalaries ?? 0).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                </div>
                <HardHat className="h-5 w-5 text-violet-400 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Net Balance */}
      {stats?.revenue && stats?.expenses && (() => {
        const totalRevenue = stats.revenue.athleteFees + stats.revenue.memberQuotas + stats.revenue.sponsors
        const totalExpenses = stats.expenses.materialsClubCost + stats.expenses.textilesClubCost + stats.expenses.directionSalaries
        const balance = totalRevenue - totalExpenses
        const isPositive = balance >= 0
        return (
          <Card className={isPositive ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'}>
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.totalRevenue')}</p>
                    <p className="text-lg font-bold text-primary">
                      {totalRevenue.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.totalExpenses')}</p>
                    <p className="text-lg font-bold text-destructive">
                      {totalExpenses.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('dashboard.netBalance')}</p>
                    <p className={`text-xl font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPositive ? '+' : ''}{balance.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                ⚠ {t('dashboard.balanceDisclaimer')}
              </p>
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Athletes by Age Group */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.athletesByGroup')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.athletesByAgeGroup ?? []).map((item) => (
                <div key={item.ageGroup} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {labels.ageGroups[item.ageGroup] ?? item.ageGroup}
                  </span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
              {(stats?.athletesByAgeGroup ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('common.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Materials by State + Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('nav.materials')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {(stats?.materialsByState ?? []).map((item) => (
                <div key={item.state} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MATERIAL_STATE_COLORS[item.state] ?? 'bg-gray-100 text-gray-800'}`}>
                    {labels.materialStates[item.state] ?? item.state}
                  </span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
              {(stats?.materialsByState ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('common.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <div className="space-y-4">
          {(stats?.athletesWithLatePayments ?? 0) > 0 && (
            <Link href="/fees?filter=late">
              <Card className="border-red-200 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-800">{t('dashboard.lateFeesAlert')}</p>
                      <p className="text-sm text-red-600">
                        {stats?.athletesWithLatePayments} {t('dashboard.athletesWithMissingPayments')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {(stats?.lateQuotas ?? 0) > 0 && (
            <Link href="/members?filter=late">
              <Card className="border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800">{t('dashboard.lateQuotasAlert')}</p>
                      <p className="text-sm text-amber-600">{stats?.lateQuotas} {t('dashboard.quotasPending')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {(stats?.expiringSponsors ?? []).length > 0 && (
            <Link href="/sponsors?status=expiring">
              <Card className="border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-orange-800">{t('dashboard.expiringContracts')}</p>
                      {stats?.expiringSponsors.map((s) => (
                        <p key={s.id} className="text-sm text-orange-600">
                          {s.name} — {format(new Date(s.contractEnd), 'dd/MM/yyyy')}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {(stats?.athletesWithLatePayments ?? 0) === 0 &&
            (stats?.lateQuotas ?? 0) === 0 &&
            (stats?.expiringSponsors ?? []).length === 0 && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4">
                <p className="text-sm text-emerald-700 font-medium">{t('dashboard.allClear')}</p>
                <p className="text-xs text-emerald-600">{t('dashboard.noAlerts')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Upcoming Travels */}
      {(stats?.upcomingTravels ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plane className="h-4 w-4" />
              {t('dashboard.upcomingTravels')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.upcomingTravels.map((travel) => (
                <div key={travel.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{travel.opponent}</p>
                    <p className="text-xs text-muted-foreground">{travel.transport}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(travel.departureDate), "d MMMM", { locale: dateLocale })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
