'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, ShieldOff, ShieldCheck, Trash2, AlertTriangle, CreditCard } from 'lucide-react'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE:           { label: 'Ativo',                 color: 'bg-green-100 text-green-700' },
  PENDING_PAYMENT:  { label: 'Aguarda pagamento',      color: 'bg-yellow-100 text-yellow-700' },
  PAST_DUE:         { label: 'Pagamento em atraso',    color: 'bg-orange-100 text-orange-700' },
  CANCELLED:        { label: 'Cancelado',              color: 'bg-gray-100 text-gray-500' },
  SUSPENDED:        { label: 'Suspenso',               color: 'bg-red-100 text-red-700' },
}

interface Club {
  id: string
  name: string
  email: string
  country: string
  language: string
  status: string
  isFreeClub: boolean
  statusChangedAt: string | null
  createdAt: string
  _count: { users: number; athletes: number }
}

interface Props {
  initialClubs: Club[]
}

function canSuspend(club: Club): boolean {
  if (club.isFreeClub) return club.status === 'ACTIVE'
  return club.status === 'PAST_DUE'
}

function canActivate(club: Club): boolean {
  return club.status === 'SUSPENDED'
}

function canDelete(club: Club): boolean {
  if (club.status !== 'SUSPENDED') return false
  if (club.isFreeClub) return true
  const changedAt = club.statusChangedAt ? new Date(club.statusChangedAt).getTime() : null
  if (!changedAt) return false
  return Date.now() - changedAt >= ONE_YEAR_MS
}

export default function PlatformClubs({ initialClubs }: Props) {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>(initialClubs)
  // router.refresh() (após criar clube, etc.) re-executa o server component e passa um
  // initialClubs novo, mas useState só lê o valor inicial uma vez — sem isto a tabela
  // nunca reflectia clubes criados, só as stats do servidor (achado em teste ao vivo).
  useEffect(() => { setClubs(initialClubs) }, [initialClubs])
  const [createOpen, setCreateOpen] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<Club | null>(null)
  const [activateTarget, setActivateTarget] = useState<Club | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Club | null>(null)
  const [paymentPlan, setPaymentPlan] = useState<'monthly' | 'test'>('monthly')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Create form state
  const [form, setForm] = useState({
    clubName: '', clubEmail: '', country: 'pt', language: 'pt',
    adminName: '', adminEmail: '', adminPassword: '',
  })
  const formRef = useRef(form)
  formRef.current = form

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // ─── Create free club ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/platform/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao criar clube'); return }
      setCreateOpen(false)
      setForm({ clubName: '', clubEmail: '', country: 'pt', language: 'pt', adminName: '', adminEmail: '', adminPassword: '' })
      router.refresh()
    } catch {
      setError('Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  // ─── Change status ───────────────────────────────────────────────────────────

  const changeStatus = async (clubId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/platform/clubs/${clubId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao atualizar estado'); return }
      setClubs((prev) => prev.map((c) => c.id === clubId
        ? { ...c, status, statusChangedAt: new Date().toISOString() }
        : c
      ))
      setSuspendTarget(null)
      setActivateTarget(null)
    } catch {
      setError('Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  // ─── Send payment link (free club → paid) ──────────────────────────────────

  const handleSendPaymentLink = async () => {
    if (!paymentTarget) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/platform/clubs/${paymentTarget.id}/send-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: paymentPlan }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao enviar link de pagamento'); return }
      setPaymentTarget(null)
    } catch {
      setError('Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (clubId: string) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/platform/clubs/${clubId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao eliminar clube'); return }
      setClubs((prev) => prev.filter((c) => c.id !== clubId))
      setDeleteTarget(null)
    } catch {
      setError('Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Clubes</h2>
          <Button size="sm" onClick={() => { setError(''); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" />Criar Clube Grátis
          </Button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Clube</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">País</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">Atletas</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">Registo</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clubs.map((club) => {
                const st = STATUS_LABELS[club.status] ?? { label: club.status, color: 'bg-gray-100 text-gray-500' }
                return (
                  <tr key={club.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{club.name}</p>
                      <p className="text-xs text-gray-400">{club.email}</p>
                      {club.isFreeClub && (
                        <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0 rounded bg-blue-100 text-blue-700 font-medium">Grátis</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 uppercase text-xs font-medium">{club.country}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{club._count.athletes}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">
                      {new Date(club.createdAt).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {club.isFreeClub && club.status === 'ACTIVE' && (
                          <button
                            title="Enviar link de pagamento"
                            onClick={() => { setError(''); setPaymentPlan('monthly'); setPaymentTarget(club) }}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        {canSuspend(club) && (
                          <button
                            title="Suspender"
                            onClick={() => { setError(''); setSuspendTarget(club) }}
                            className="p-1.5 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        )}
                        {canActivate(club) && (
                          <button
                            title="Ativar"
                            onClick={() => { setError(''); setActivateTarget(club) }}
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete(club) && (
                          <button
                            title="Eliminar clube"
                            onClick={() => { setError(''); setDeleteTarget(club) }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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

      {/* ── Create Free Club Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); setError('') }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Clube Grátis</DialogTitle>
            <DialogDescription>
              Cria um clube sem pagamento para testes ou demos. O clube fica imediatamente ativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome do clube *</Label>
                <Input value={form.clubName} onChange={setF('clubName')} placeholder="HC Exemplo" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Email do clube *</Label>
                <Input type="email" value={form.clubEmail} onChange={setF('clubEmail')} placeholder="info@hcexemplo.pt" />
              </div>
              <div className="space-y-1">
                <Label>País</Label>
                <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇵🇹 Portugal</SelectItem>
                    <SelectItem value="es">🇪🇸 Espanha</SelectItem>
                    <SelectItem value="fr">🇫🇷 França</SelectItem>
                    <SelectItem value="it">🇮🇹 Itália</SelectItem>
                    <SelectItem value="br">🇧🇷 Brasil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Idioma</Label>
                <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="it">Italiano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Administrador do clube</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={form.adminName} onChange={setF('adminName')} placeholder="João Silva" />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input type="email" value={form.adminEmail} onChange={setF('adminEmail')} placeholder="admin@hcexemplo.pt" />
                </div>
                <div className="space-y-1">
                  <Label>Password *</Label>
                  <Input type="password" value={form.adminPassword} onChange={setF('adminPassword')} placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar clube
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend Confirm ─────────────────────────────────────────── */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => { if (!o) setSuspendTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender clube</DialogTitle>
            <DialogDescription>
              Tens a certeza que queres suspender <strong>{suspendTarget?.name}</strong>?
              {suspendTarget?.isFreeClub
                ? ' O clube ficará inacessível e poderá ser eliminado.'
                : ' O clube ficará inacessível. Só podes fazer isto porque tem pagamento em atraso.'}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={saving} onClick={() => suspendTarget && changeStatus(suspendTarget.id, 'SUSPENDED')}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Activate Confirm ────────────────────────────────────────── */}
      <Dialog open={!!activateTarget} onOpenChange={(o) => { if (!o) setActivateTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar clube</DialogTitle>
            <DialogDescription>
              Ativar <strong>{activateTarget?.name}</strong>? Os utilizadores voltarão a ter acesso imediato.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateTarget(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => activateTarget && changeStatus(activateTarget.id, 'ACTIVE')}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Payment Link ───────────────────────────────────────── */}
      <Dialog open={!!paymentTarget} onOpenChange={(o) => { if (!o) setPaymentTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar link de pagamento</DialogTitle>
            <DialogDescription>
              Envia um email para <strong>{paymentTarget?.email}</strong> com um link de Stripe Checkout.
              O clube paga com o próprio cartão; depois de confirmado, o clube deixa de ser grátis e é
              reencaminhado para o login para entrar com as credenciais que já tem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={paymentPlan} onValueChange={(v) => setPaymentPlan(v as 'monthly' | 'test')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Plano Principal — €59/mês</SelectItem>
                <SelectItem value="test">Plano de Teste — €3/mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>Cancelar</Button>
            <Button disabled={saving} onClick={handleSendPaymentLink}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Eliminar clube permanentemente</DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os dados de <strong>{deleteTarget?.name}</strong> serão
              eliminados: atletas, sócios, mensalidades, materiais, patrocinadores, viagens, treinos e utilizadores.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={saving} onClick={() => deleteTarget && handleDelete(deleteTarget.id)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar para sempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
