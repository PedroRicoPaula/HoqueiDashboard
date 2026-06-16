'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, Handshake, Package, AlertTriangle, Plane, Euro, TrendingUp, TrendingDown, ClipboardCheck, Shirt, RefreshCw, HardHat } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { AGE_GROUP_LABELS, MATERIAL_STATE_LABELS, MATERIAL_STATE_COLORS } from '@/lib/constants'

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

function RevenueChart({ revenue }: { revenue: Revenue }) {
  const categories = [
    { label: 'Mensalidades', value: revenue.athleteFees, color: 'bg-blue-500' },
    { label: 'Quotas Sócios', value: revenue.memberQuotas, color: 'bg-emerald-500' },
    { label: 'Patrocinadores', value: revenue.sponsors, color: 'bg-purple-500' },
  ]
  const total = categories.reduce((s, c) => s + c.value, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Sem receitas registadas</p>
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
              <span className="text-sm font-semibold tabular-nums">{cat.value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
              <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">Total</span>
          <span className="text-sm font-bold tabular-nums text-primary">{total.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
          <span className="w-12" />
        </div>
      </div>
    </div>
  )
}

function ExpensesChart({ expenses }: { expenses: Expenses }) {
  const categories = [
    { label: 'Materiais hóquei', value: expenses.materialsClubCost, color: 'bg-orange-500' },
    { label: 'Têxteis', value: expenses.textilesClubCost, color: 'bg-rose-500' },
    { label: 'Salários direção', value: expenses.directionSalaries, color: 'bg-violet-500' },
  ]
  const total = categories.reduce((s, c) => s + c.value, 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Sem despesas registadas</p>
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
              <span className="text-sm font-semibold tabular-nums">{cat.value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
              <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">Total</span>
          <span className="text-sm font-bold tabular-nums text-destructive">{total.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
          <span className="w-12" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
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
              Atualizado às {format(lastUpdated, 'HH:mm', { locale: pt })}
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
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atletas</p>
                <p className="text-3xl font-bold">{stats?.counts.athletes ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sócios</p>
                <p className="text-3xl font-bold">{stats?.counts.members ?? 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Patrocinadores</p>
                <p className="text-3xl font-bold">{stats?.counts.sponsors ?? 0}</p>
              </div>
              <Handshake className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Materiais</p>
                <p className="text-3xl font-bold">{stats?.counts.materials ?? 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Treinos (30d)</p>
                <p className="text-3xl font-bold">{stats?.attendance?.sessionsLast30Days ?? 0}</p>
                {(stats?.attendance?.presencesLast30Days ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">{stats?.attendance?.presencesLast30Days} presenças</p>
                )}
              </div>
              <ClipboardCheck className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Têxteis Atrib.</p>
                <p className="text-3xl font-bold">{stats?.textiles?.assignedCount ?? 0}</p>
                {(stats?.textiles?.clubCost ?? 0) > 0 && (
                  <p className="text-xs text-orange-600">{(stats?.textiles?.clubCost ?? 0).toFixed(0)}€ clube</p>
                )}
              </div>
              <Shirt className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Receitas
              {stats?.revenue && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  Mensalidades: época {stats.revenue.seasonLabel} · Quotas: ano {new Date().getFullYear()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenue ? (
              <RevenueChart revenue={stats.revenue} />
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Mensalidades (época {stats?.revenue?.seasonLabel})</p>
                  <p className="text-xl font-bold text-blue-600">
                    {(stats?.revenue.athleteFees ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
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
                  <p className="text-xs text-muted-foreground">Quotas sócios ({new Date().getFullYear()})</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {(stats?.revenue.memberQuotas ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
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
                  <p className="text-xs text-muted-foreground">Patrocinadores (ativos)</p>
                  <p className="text-xl font-bold text-purple-600">
                    {(stats?.revenue.sponsors ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
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
              Despesas
              {stats?.expenses && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  Materiais: acumulado · Salários direção: {stats.expenses.year}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.expenses ? (
              <ExpensesChart expenses={stats.expenses} />
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-sm bg-orange-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Materiais hóquei (acumulado)</p>
                  <p className="text-xl font-bold text-orange-600">
                    {(stats?.expenses.materialsClubCost ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                  {(stats?.materialCosts.savedByAthletes ?? 0) > 0 && (
                    <p className="text-xs text-green-600">
                      -{(stats?.materialCosts.savedByAthletes ?? 0).toFixed(0)}€ pago por atletas
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
                  <p className="text-xs text-muted-foreground">Têxteis (acumulado)</p>
                  <p className="text-xl font-bold text-rose-600">
                    {(stats?.expenses.textilesClubCost ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                  </p>
                  {(stats?.textiles.savedByAthletes ?? 0) > 0 && (
                    <p className="text-xs text-green-600">
                      -{(stats?.textiles.savedByAthletes ?? 0).toFixed(0)}€ pago por atletas
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
                  <p className="text-xs text-muted-foreground">Salários direção ({stats?.expenses.year})</p>
                  <p className="text-xl font-bold text-violet-600">
                    {(stats?.expenses.directionSalaries ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
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
                    <p className="text-xs text-muted-foreground mb-1">Total Receitas</p>
                    <p className="text-lg font-bold text-primary">
                      {totalRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Despesas</p>
                    <p className="text-lg font-bold text-destructive">
                      {totalExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Saldo Líquido</p>
                    <p className={`text-xl font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isPositive ? '+' : ''}{balance.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                ⚠ Receitas e despesas usam períodos diferentes — este saldo é indicativo, não contabilístico
              </p>
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Athletes by Age Group */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atletas por Escalão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.athletesByAgeGroup ?? []).map((item) => (
                <div key={item.ageGroup} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {AGE_GROUP_LABELS[item.ageGroup] ?? item.ageGroup}
                  </span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
              {(stats?.athletesByAgeGroup ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Materials by State + Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materiais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {(stats?.materialsByState ?? []).map((item) => (
                <div key={item.state} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MATERIAL_STATE_COLORS[item.state] ?? 'bg-gray-100 text-gray-800'}`}>
                    {MATERIAL_STATE_LABELS[item.state] ?? item.state}
                  </span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
              {(stats?.materialsByState ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
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
                      <p className="font-medium text-red-800">Mensalidades em Atraso</p>
                      <p className="text-sm text-red-600">
                        {stats?.athletesWithLatePayments} atleta(s) com pagamentos em falta → ver em Fees
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
                      <p className="font-medium text-amber-800">Quotas de Sócios em Atraso</p>
                      <p className="text-sm text-amber-600">{stats?.lateQuotas} quota(s) por regularizar → ver Sócios</p>
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
                      <p className="font-medium text-orange-800">Contratos a Expirar</p>
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
                <p className="text-sm text-emerald-700 font-medium">Tudo em ordem!</p>
                <p className="text-xs text-emerald-600">Sem alertas pendentes.</p>
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
              Próximas Viagens
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
                    {format(new Date(travel.departureDate), "d 'de' MMMM", { locale: pt })}
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
