'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Pencil, Trash2, Loader2, Calendar, ChevronLeft, ChevronRight, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const memberSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  monthlyQuota: z.coerce.number().min(0),
})
type MemberForm = z.infer<typeof memberSchema>

interface Member {
  id: string
  number: number
  name: string
  phone?: string
  email?: string
  address?: string
  monthlyQuota: number
  paidCount: number
  lateMonths: number
}

interface Quota {
  id: string
  month: number
  year: number
  paid: boolean
  amount?: number | null
  paidAt?: string
  notes?: string | null
}

function QuotaCalendar({ memberId, year }: { memberId: string; year: number }) {
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [loading, setLoading] = useState(true)
  const [payAllSaving, setPayAllSaving] = useState(false)
  const [confirmQuota, setConfirmQuota] = useState<{ month: number; monthName: string; paid: boolean } | null>(null)
  const [confirmNotes, setConfirmNotes] = useState('')
  const [confirmSaving, setConfirmSaving] = useState(false)
  const { can } = usePermissions()
  const { toast } = useToast()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const fetchQuotas = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/members/${memberId}/quotas?year=${year}`)
    if (res.ok) setQuotas(await res.json())
    setLoading(false)
  }, [memberId, year])

  useEffect(() => { fetchQuotas() }, [fetchQuotas])

  const getQuota = (month: number) => quotas.find((q) => q.month === month)

  const isPast = (month: number) =>
    year < currentYear || (year === currentYear && month < currentMonth)

  const doToggle = async (month: number, paid: boolean, notes?: string) => {
    const res = await fetch(`/api/members/${memberId}/quotas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year, paid, notes: notes || null }),
    })
    if (res.ok) fetchQuotas()
    return res.ok
  }

  const handleCellClick = (month: number) => {
    if (!can('editMembers')) return
    const existing = getQuota(month)
    setConfirmNotes('')
    setConfirmQuota({ month, monthName: MONTHS[month - 1], paid: !existing?.paid })
  }

  const handleConfirm = async () => {
    if (!confirmQuota) return
    setConfirmSaving(true)
    const ok = await doToggle(confirmQuota.month, confirmQuota.paid, confirmNotes)
    if (!ok) toast({ title: 'Erro ao registar quota', variant: 'destructive' })
    setConfirmSaving(false)
    setConfirmQuota(null)
  }

  const pendingMonths = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((month) => isPast(month) && !getQuota(month)?.paid)

  const handlePayAllPending = async () => {
    if (pendingMonths.length === 0) return
    setPayAllSaving(true)
    let failed = 0
    for (const month of pendingMonths) {
      const ok = await doToggle(month, true)
      if (!ok) failed++
    }
    setPayAllSaving(false)
    const done = pendingMonths.length - failed
    if (failed > 0) {
      toast({ title: `${done} registada${done !== 1 ? 's' : ''}, ${failed} falhada${failed !== 1 ? 's' : ''}`, variant: 'destructive' })
    } else {
      toast({ title: `${done} quota${done !== 1 ? 's' : ''} registada${done !== 1 ? 's' : ''} como pagas` })
    }
  }

  if (loading) return <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>

  return (
    <div className="space-y-3">
      {can('editMembers') && pendingMonths.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handlePayAllPending} disabled={payAllSaving}>
            {payAllSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-1" />}
            Pagar todas em atraso ({pendingMonths.length})
          </Button>
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {MONTHS.map((monthName, idx) => {
          const month = idx + 1
          const quota = getQuota(month)
          const past = isPast(month)
          const paid = quota?.paid ?? false
          const late = past && !paid

          return (
            <button
              key={month}
              onClick={() => handleCellClick(month)}
              disabled={!can('editMembers')}
              className={cn(
                'relative flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-colors',
                paid ? 'bg-green-100 border-green-300 text-green-800' :
                late ? 'bg-red-100 border-red-300 text-red-800' :
                'bg-gray-50 border-gray-200 text-gray-500',
                can('editMembers') && 'hover:opacity-80 cursor-pointer',
                !can('editMembers') && 'cursor-default'
              )}
            >
              <span>{monthName.substring(0, 3)}</span>
              <span className="text-[10px] mt-0.5">
                {paid
                  ? (quota?.amount ? `${quota.amount % 1 === 0 ? quota.amount : quota.amount.toFixed(2)}€` : 'Pago')
                  : late ? 'Atraso' : 'Pend.'}
              </span>
              {quota?.notes && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" title={quota.notes} />
              )}
            </button>
          )
        })}
      </div>

      <Dialog open={!!confirmQuota} onOpenChange={(o) => !o && setConfirmQuota(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmQuota?.paid ? 'Registar quota paga' : 'Remover pagamento'}
            </DialogTitle>
          </DialogHeader>
          {confirmQuota && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium">{confirmQuota.monthName} {year}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {confirmQuota.paid ? 'Será marcada como paga' : 'O pagamento será removido'}
                </p>
              </div>
              {confirmQuota.paid && (
                <div className="space-y-1">
                  <Label>Notas (opcional)</Label>
                  <Input
                    value={confirmNotes}
                    onChange={(e) => setConfirmNotes(e.target.value)}
                    placeholder="ex: transferência"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmQuota(null)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={confirmSaving}>
              {confirmSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [quotaModal, setQuotaModal] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null })
  const [saving, setSaving] = useState(false)
  const [quotaYear, setQuotaYear] = useState(new Date().getFullYear())
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null })
  const { can } = usePermissions()
  const { toast } = useToast()
  const debouncedSearch = useDebounce(search)

  const {
    register, handleSubmit, reset, formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<MemberForm>({ resolver: zodResolver(memberSchema) as any })

  const fetchMembers = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    const res = await fetch(`/api/members?${params}`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
      setPage(p)
    }
    setLoading(false)
  }, [debouncedSearch])

  useEffect(() => { fetchMembers(1) }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingMember(null)
    reset({ name: '', phone: '', email: '', address: '', monthlyQuota: 0 })
    setSheetOpen(true)
  }

  const openEdit = (m: Member) => {
    setEditingMember(m)
    reset({ name: m.name, phone: m.phone ?? '', email: m.email ?? '', address: m.address ?? '', monthlyQuota: m.monthlyQuota })
    setSheetOpen(true)
  }

  const onSubmit = async (data: MemberForm) => {
    setSaving(true)
    try {
      const url = editingMember ? `/api/members/${editingMember.id}` : '/api/members'
      const method = editingMember ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingMember ? 'Sócio atualizado' : 'Sócio criado' })
      setSheetOpen(false)
      fetchMembers(page)
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.member) return
    const res = await fetch(`/api/members/${deleteDialog.member.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Sócio eliminado' }); fetchMembers(1) }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteDialog({ open: false, member: null })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, email ou nº..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can('editMembers') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />Novo Sócio
          </Button>
        )}
      </div>

      {!loading && (
        <p className="text-sm text-muted-foreground">
          {total} sócio{total !== 1 ? 's' : ''}
        </p>
      )}

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">N.º</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <p>{debouncedSearch ? 'Nenhum sócio encontrado' : 'Nenhum sócio registado'}</p>
                    {!debouncedSearch && can('editMembers') && (
                      <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Adicionar primeiro sócio</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.number}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {m.phone
                    ? <a href={`tel:${m.phone}`} className="hover:underline text-foreground">{m.phone}</a>
                    : '-'}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {m.email
                    ? <a href={`mailto:${m.email}`} className="hover:underline text-primary">{m.email}</a>
                    : '-'}
                </TableCell>
                <TableCell>{m.monthlyQuota.toFixed(2)} €</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {m.monthlyQuota === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : m.lateMonths > 0 ? (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                      {m.lateMonths} em atraso
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Em dia
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Quotas" onClick={() => { setQuotaModal({ open: true, member: m }); setQuotaYear(new Date().getFullYear()) }}>
                      <Calendar className="h-4 w-4" />
                    </Button>
                    {can('editMembers') && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDialog({ open: true, member: m })}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} sócio{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => fetchMembers(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => fetchMembers(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingMember ? 'Editar Sócio' : 'Novo Sócio'}</SheetTitle>
            <SheetDescription>Preencha os dados do sócio</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input {...register('phone')} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Morada</Label>
              <Input {...register('address')} />
            </div>
            <div className="space-y-1">
              <Label>Quota Mensal (€)</Label>
              <Input type="number" step="0.01" {...register('monthlyQuota')} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMember ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={quotaModal.open} onOpenChange={(o) => setQuotaModal({ open: o, member: quotaModal.member })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quotas - {quotaModal.member?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={() => setQuotaYear((y) => y - 1)} disabled={quotaYear <= 2025}>{'<'}</Button>
            <span className="font-semibold">{quotaYear}</span>
            <Button variant="outline" size="sm" onClick={() => setQuotaYear((y) => y + 1)} disabled={quotaYear >= new Date().getFullYear() + 1}>{'>'}</Button>
          </div>
          {quotaModal.member && (
            <QuotaCalendar memberId={quotaModal.member.id} year={quotaYear} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, member: deleteDialog.member })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Sócio</DialogTitle>
            <DialogDescription>
              Tem a certeza que quer eliminar {deleteDialog.member?.name}? Esta ação não pode ser desfeita e irá apagar todas as quotas associadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, member: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
