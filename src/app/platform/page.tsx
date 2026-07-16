import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Building2, Users, DollarSign, TrendingUp, Globe } from 'lucide-react'
import Stripe from 'stripe'
import { logger } from '@/lib/logger'
import PlatformClubs from './PlatformClubs'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  PENDING_PAYMENT: { label: 'Aguarda pagamento', color: 'bg-yellow-100 text-yellow-700' },
  PAST_DUE: { label: 'Pagamento em atraso', color: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500' },
  SUSPENDED: { label: 'Suspenso', color: 'bg-red-100 text-red-700' },
}

const FALLBACK_PRICE_MONTHLY = 59
const FALLBACK_PRICE_YEARLY_MONTHLY_EQUIV = 590 / 12

let priceCache: { monthly: number; yearlyMonthlyEquiv: number; fetchedAt: number } | null = null
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000

async function getPrices(): Promise<{ monthly: number; yearlyMonthlyEquiv: number }> {
  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
    return priceCache
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
    const [monthlyPrice, yearlyPrice] = await Promise.all([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_MONTHLY!),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_YEARLY!),
    ])
    const monthly = (monthlyPrice.unit_amount ?? FALLBACK_PRICE_MONTHLY * 100) / 100
    const yearly = (yearlyPrice.unit_amount ?? FALLBACK_PRICE_YEARLY_MONTHLY_EQUIV * 12 * 100) / 100
    priceCache = { monthly, yearlyMonthlyEquiv: yearly / 12, fetchedAt: Date.now() }
    return priceCache
  } catch (error) {
    logger.error('Failed to fetch Stripe prices for MRR calculation, using fallback:', error)
    return { monthly: FALLBACK_PRICE_MONTHLY, yearlyMonthlyEquiv: FALLBACK_PRICE_YEARLY_MONTHLY_EQUIV }
  }
}

export default async function PlatformPage() {
  const headersList = await headers()
  const req = new Request('http://localhost', { headers: headersList })
  const user = await getUserFromRequest(req)

  if (!user || !user.isSuperAdmin) redirect('/login')

  const [clubs, totalUsers, prices] = await Promise.all([
    prisma.club.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, athletes: true } } },
    }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
    getPrices(),
  ])

  const activeClubs = clubs.filter(c => c.status === 'ACTIVE')
  const paidActiveClubs = activeClubs.filter(c => !c.isFreeClub)
  const freeActiveClubs = activeClubs.filter(c => c.isFreeClub)
  const pastDueClubs = clubs.filter(c => c.status === 'PAST_DUE')

  // MRR excludes free clubs
  const monthlyActiveClubs = paidActiveClubs.filter(c =>
    c.stripePriceId === process.env.STRIPE_PRICE_MONTHLY || !c.stripePriceId
  )
  const yearlyActiveClubs = paidActiveClubs.filter(c =>
    c.stripePriceId === process.env.STRIPE_PRICE_YEARLY
  )
  const mrr = Math.round(
    monthlyActiveClubs.length * prices.monthly +
    yearlyActiveClubs.length * prices.yearlyMonthlyEquiv
  )
  const arr = mrr * 12

  // Country distribution (paid active only)
  const countryMap: Record<string, number> = {}
  for (const club of paidActiveClubs) {
    countryMap[club.country] = (countryMap[club.country] ?? 0) + 1
  }
  const countries = Object.entries(countryMap).sort((a, b) => b[1] - a[1])

  // Serialize clubs for client component (convert Date → string)
  const serializedClubs = clubs.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    country: c.country,
    language: c.language,
    status: c.status,
    isFreeClub: c.isFreeClub,
    statusChangedAt: c.statusChangedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: c._count,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão geral da plataforma</h1>
        <p className="text-gray-500 text-sm mt-1">Todos os clubes registados no HoqueiManager</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500">Clubes ativos</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{paidActiveClubs.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {clubs.length} total · {pastDueClubs.length} em atraso
            {freeActiveClubs.length > 0 && ` · ${freeActiveClubs.length} grátis`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500">Utilizadores</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-gray-500">MRR</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">€{mrr}</p>
          <p className="text-xs text-gray-400 mt-1">Mensal estimado</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500">ARR</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">€{arr.toLocaleString('pt-PT')}</p>
          <p className="text-xs text-gray-400 mt-1">Anual estimado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive clubs table */}
        <PlatformClubs initialClubs={serializedClubs} />

        {/* Sidebar stats */}
        <div className="space-y-4">
          {/* By status */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Por estado</h3>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => {
                const count = clubs.filter(c => c.status === key).length
                if (count === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By country */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Países (pagos ativos)</h3>
            </div>
            <div className="space-y-2">
              {countries.map(([country, count]) => (
                <div key={country} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 uppercase font-medium">{country}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {countries.length === 0 && <p className="text-sm text-gray-400">—</p>}
            </div>
          </div>

          {/* Revenue breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Faturação</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Plano mensal</span>
                <span className="font-medium">{monthlyActiveClubs.length} clubes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Plano anual</span>
                <span className="font-medium">{yearlyActiveClubs.length} clubes</span>
              </div>
              {freeActiveClubs.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Grátis</span>
                  <span className="font-medium text-blue-600">{freeActiveClubs.length} clubes</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span>MRR total</span>
                <span className="text-green-700">€{mrr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
