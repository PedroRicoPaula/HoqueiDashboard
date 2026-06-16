import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Building2, Users, DollarSign, AlertCircle } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  PENDING_PAYMENT: { label: 'Aguarda pagamento', color: 'bg-yellow-100 text-yellow-700' },
  PAST_DUE: { label: 'Pagamento em atraso', color: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500' },
  SUSPENDED: { label: 'Suspenso', color: 'bg-red-100 text-red-700' },
}

export default async function PlatformPage() {
  const headersList = await headers()
  const req = new Request('http://localhost', { headers: headersList })
  const user = await getUserFromRequest(req)

  if (!user || !user.isSuperAdmin) redirect('/login')

  const [clubs, totalUsers] = await Promise.all([
    prisma.club.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    }),
    prisma.user.count({ where: { isSuperAdmin: false } }),
  ])

  const activeClubs = clubs.filter(c => c.status === 'ACTIVE')
  const mrr = activeClubs.length * 59 // rough estimate (monthly)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão geral da plataforma</h1>
        <p className="text-gray-500 text-sm mt-1">Todos os clubes registados no HoqueiManager</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-500">Clubes ativos</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{activeClubs.length}</p>
          <p className="text-xs text-gray-400">{clubs.length} total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-500">Utilizadores</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span className="text-sm text-gray-500">MRR estimado</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">€{mrr}</p>
        </div>
      </div>

      {/* Clubs table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Clube</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">País</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Utilizadores</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Registo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clubs.map((club) => {
              const st = STATUS_LABELS[club.status] ?? { label: club.status, color: 'bg-gray-100 text-gray-500' }
              return (
                <tr key={club.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{club.name}</td>
                  <td className="px-5 py-3 text-gray-500">{club.email}</td>
                  <td className="px-5 py-3 text-gray-500 uppercase">{club.country}</td>
                  <td className="px-5 py-3 text-gray-500">{club._count.users}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {new Date(club.createdAt).toLocaleDateString('pt-PT')}
                  </td>
                </tr>
              )
            })}
            {clubs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                  Ainda sem clubes registados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
