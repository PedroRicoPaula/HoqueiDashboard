'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, Mail, Phone, Euro, User, Calendar, ChevronLeft, ChevronRight, Upload, AlertCircle } from 'lucide-react'
import { AGE_GROUPS, DIRECTION_ROLES, DIRECTION_ROLE_LABELS, DIRECTION_ROLE_COLORS, AGE_GROUP_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useDashLabels } from '@/hooks/useDashLabels'
import { useAuthStore } from '@/store/authStore'
import { getNumberLocale } from '@/lib/date-locale'

// ─── Schema ───────────────────────────────────────────────────────────────────

const directionSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  roles: z.array(z.string()).min(1, 'Selecione pelo menos um cargo'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  salary: z.coerce.number().min(0).nullable().optional(),
  athleteId: z.string().nullable().optional(),
  trainerAgeGroups: z.array(z.string()).optional().default([]),
  sectionistAgeGroups: z.array(z.string()).optional().default([]),
})
type DirectionForm = z.infer<typeof directionSchema>

// ─── Types ────────────────────────────────────────────────────────────────────

interface DirectionMember {
  id: string
  name: string
  roles: string[]
  phone?: string
  email?: string
  salary?: number | null
  athleteId?: string | null
  trainerAgeGroups: string[]
  sectionistAgeGroups: string[]
}

interface SeniorAthlete {
  id: string
  name: string
  number: number
  phone?: string
  email?: string
}

// ─── CSV Import helpers (federation format) ───────────────────────────────────

function parseFederationRole(escalao: string): string {
  const lower = escalao.toLowerCase().trim()
  // "treinador adjunto"/"assistente" tem de ser testado ANTES de "treinador" —
  // senão .includes('treinador') apanha ambos e ASSISTANT_TRAINER nunca sai.
  if (lower.includes('treinador adjunto') || lower.includes('treinador-adjunto') || lower.includes('assistente')) return 'ASSISTANT_TRAINER'
  if (lower.includes('treinador')) return 'TRAINER'
  if (lower.includes('delegado')) return 'DIRECTOR'
  if (lower.includes('diretor de campo') || lower.includes('director de campo')) return 'FIELD_DIRECTOR'
  if (lower.includes('socorrista')) return 'SOCORRISTA'
  if (lower.includes('seccionista')) return 'SECCIONISTA'
  return 'DIRECTOR'
}

function parseDirectionCsv(text: string): { name: string; numFpp?: string; roles: string[] }[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '_'))

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(sep)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim().replace(/^["']|["']$/g, '') })
    return obj
  })

  // Group by Num FPP (or name) to merge duplicate entries with different roles
  const byKey = new Map<string, { name: string; numFpp?: string; roles: Set<string> }>()
  for (const row of rows) {
    const numFpp = row['num_fpp'] || undefined
    const key = numFpp || row['nome'] || row['name'] || ''
    if (!key) continue
    const name = row['nome'] || row['name'] || ''
    // "Escalão" header → 'escal_o' after ã→_ normalisation
    const escalao = row['escal_o'] || row['escalao'] || ''
    const role = parseFederationRole(escalao)
    if (!byKey.has(key)) {
      byKey.set(key, { name, numFpp, roles: new Set([role]) })
    } else {
      byKey.get(key)!.roles.add(role)
    }
  }

  return Array.from(byKey.values()).filter((m) => m.name).map((m) => ({
    name: m.name,
    numFpp: m.numFpp,
    roles: Array.from(m.roles),
  }))
}

const MONTHS_SHORT_FALLBACK = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_FULL_FALLBACK = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface SalaryPayment {
  id: string; month: number; year: number; paid: boolean; amount?: number | null; paidAt?: string | null; notes?: string | null
}

function SalaryCalendar({ memberId, salary }: { memberId: string; salary: number | null }) {
  const [payments, setPayments] = useState<SalaryPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const { can } = usePermissions()
  const { toast } = useToast()
  const dashLabels = useDashLabels()
  const monthsFull = dashLabels.monthsFull?.slice(1) ?? MONTHS_FULL_FALLBACK
  const monthsShort = dashLabels.monthsShort?.slice(1) ?? MONTHS_SHORT_FALLBACK
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/direction/${memberId}/salary?year=${year}`)
      if (res.ok) setPayments(await res.json())
      else toast({ title: 'Erro ao carregar salários', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao carregar salários', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [memberId, year, toast])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const getPayment = (month: number) => payments.find((p) => p.month === month)

  const isPast = (month: number) =>
    year < currentYear || (year === currentYear && month < currentMonth)

  const toggle = async (month: number) => {
    if (!can('editDirection')) return
    const existing = getPayment(month)
    const paid = !existing?.paid
    try {
      const res = await fetch(`/api/direction/${memberId}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, paid, amount: salary }),
      })
      if (res.ok) fetchPayments()
      else toast({ title: 'Erro ao registar salário', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao registar salário', variant: 'destructive' })
    }
  }

  const totalPaid = payments.filter((p) => p.paid).reduce((s, p) => s + (p.amount ?? salary ?? 0), 0)

  if (loading) return <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)} disabled={year <= 2025}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-semibold text-sm w-10 text-center">{year}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear + 1}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        {totalPaid > 0 && (
          <span className="ml-auto text-sm text-emerald-600 font-medium">{totalPaid.toFixed(2)}€ pagos</span>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {monthsFull.map((monthName, idx) => {
          const month = idx + 1
          const payment = getPayment(month)
          const past = isPast(month)
          const paid = payment?.paid ?? false
          const late = past && !paid && (salary ?? 0) > 0

          return (
            <button
              key={month}
              onClick={() => toggle(month)}
              disabled={!can('editDirection')}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-colors',
                paid ? 'bg-green-100 border-green-300 text-green-800' :
                late ? 'bg-red-100 border-red-300 text-red-800' :
                'bg-gray-50 border-gray-200 text-gray-500',
                can('editDirection') && 'hover:opacity-80 cursor-pointer',
                !can('editDirection') && 'cursor-default'
              )}
            >
              <span>{monthsShort[idx]}</span>
              <span className="text-[10px] mt-0.5">
                {paid
                  ? (payment?.amount ? `${payment.amount % 1 === 0 ? payment.amount : payment.amount.toFixed(2)}€` : 'Pago')
                  : late ? 'Atraso' : 'Pend.'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Age group checkbox panel ─────────────────────────────────────────────────

function AgeGroupPanel({
  label,
  color,
  selected,
  onToggle,
  onToggleAll,
}: {
  label: string
  color: 'blue' | 'emerald'
  selected: string[]
  onToggle: (ag: string) => void
  onToggleAll: () => void
}) {
  const allSelected = AGE_GROUPS.every((g) => selected.includes(g.value))
  const border = color === 'blue' ? 'border-blue-100 bg-blue-50' : 'border-emerald-100 bg-emerald-50'
  const textColor = color === 'blue' ? 'text-blue-800' : 'text-emerald-800'
  const btnColor = color === 'blue'
    ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-100'
    : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100'

  return (
    <div className={`space-y-2 rounded-lg border ${border} p-3`}>
      <div className="flex items-center justify-between">
        <Label className={textColor}>{label}</Label>
        <Button type="button" variant="ghost" size="sm" className={`h-6 text-xs ${btnColor}`} onClick={onToggleAll}>
          {allSelected ? 'Desselecionar todos' : 'Todos'}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {AGE_GROUPS.map((g) => (
          <label key={g.value} className="flex items-center gap-2 p-2 rounded border bg-white cursor-pointer hover:bg-gray-50 text-sm">
            <Checkbox checked={selected.includes(g.value)} onCheckedChange={() => onToggle(g.value)} />
            {g.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DirectionPage() {
  const dashLabels = useDashLabels()
  const numLocale = getNumberLocale(useAuthStore((s) => s.clubLanguage))
  const roleLabel = (v: string) => dashLabels.directionRoles[v] ?? DIRECTION_ROLE_LABELS[v] ?? v
  const ageGroupLabel = (v: string) => dashLabels.ageGroups[v] ?? AGE_GROUP_LABELS[v] ?? v
  const ROLES = DIRECTION_ROLES.map((value) => ({ value, label: roleLabel(value) }))

  const [members, setMembers] = useState<DirectionMember[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<DirectionMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [seniorAthletes, setSeniorAthletes] = useState<SeniorAthlete[]>([])
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; member: DirectionMember | null }>({ open: false, member: null })
  const [salaryModal, setSalaryModal] = useState<{ open: boolean; member: DirectionMember | null }>({ open: false, member: null })

  // CSV import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<{ name: string; numFpp?: string; roles: string[] }[]>([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { can } = usePermissions()
  const { toast } = useToast()

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<DirectionForm>({ resolver: zodResolver(directionSchema) as any, defaultValues: { roles: [], trainerAgeGroups: [], sectionistAgeGroups: [], athleteId: null } })

  const watchedRoles = watch('roles') ?? []
  const watchedTrainerAgeGroups = watch('trainerAgeGroups') ?? []
  const watchedSectionistAgeGroups = watch('sectionistAgeGroups') ?? []
  const watchedAthleteId = watch('athleteId')

  const hasTrainer = watchedRoles.includes('TRAINER')
  const hasSeccionista = watchedRoles.includes('SECCIONISTA')

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/direction')
      if (res.ok) setMembers(await res.json())
      else toast({ title: 'Erro ao carregar direção', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao carregar direção', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  useEffect(() => {
    if (!can('viewAthletes')) return
    fetch('/api/athletes?ageGroup=SENIORS')
      .then((r) => r.ok ? r.json() : [])
      .then((data: SeniorAthlete[]) => setSeniorAthletes(data))
  }, [can])

  // ─── Form helpers ───────────────────────────────────────────────────────────

  const toggleRole = (role: string) => {
    const current = watch('roles') ?? []
    if (current.includes(role)) {
      setValue('roles', current.filter((r) => r !== role))
      if (role === 'TRAINER') setValue('trainerAgeGroups', [])
      if (role === 'SECCIONISTA') setValue('sectionistAgeGroups', [])
    } else {
      setValue('roles', [...current, role])
    }
  }

  const toggleAgeGroup = (field: 'trainerAgeGroups' | 'sectionistAgeGroups', ag: string) => {
    const current = watch(field) ?? []
    if (current.includes(ag)) setValue(field, current.filter((g) => g !== ag))
    else setValue(field, [...current, ag])
  }

  const toggleAllAgeGroups = (field: 'trainerAgeGroups' | 'sectionistAgeGroups') => {
    const current = watch(field) ?? []
    const allSelected = AGE_GROUPS.every((g) => current.includes(g.value))
    setValue(field, allSelected ? [] : AGE_GROUPS.map((g) => g.value))
  }

  const handleAthleteSelect = (val: string) => {
    if (!val || val === 'none') { setValue('athleteId', null); return }
    const athlete = seniorAthletes.find((a) => a.id === val)
    if (!athlete) return
    setValue('athleteId', athlete.id)
    setValue('name', athlete.name)
    if (athlete.phone) setValue('phone', athlete.phone)
    if (athlete.email) setValue('email', athlete.email)
  }

  // ─── Open / close ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingMember(null)
    reset({ name: '', roles: [], phone: '', email: '', salary: null, athleteId: null, trainerAgeGroups: [], sectionistAgeGroups: [] })
    setSheetOpen(true)
  }

  const openEdit = (m: DirectionMember) => {
    setEditingMember(m)
    reset({
      name: m.name, roles: m.roles, phone: m.phone ?? '', email: m.email ?? '',
      salary: m.salary ?? null, athleteId: m.athleteId ?? null,
      trainerAgeGroups: m.trainerAgeGroups ?? [], sectionistAgeGroups: m.sectionistAgeGroups ?? [],
    })
    setSheetOpen(true)
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: DirectionForm) => {
    setSaving(true)
    try {
      const url = editingMember ? `/api/direction/${editingMember.id}` : '/api/direction'
      const method = editingMember ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          trainerAgeGroups: data.roles.includes('TRAINER') ? (data.trainerAgeGroups ?? []) : [],
          sectionistAgeGroups: data.roles.includes('SECCIONISTA') ? (data.sectionistAgeGroups ?? []) : [],
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingMember ? 'Membro atualizado' : 'Membro criado' })
      setSheetOpen(false)
      fetchMembers()
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── CSV Import ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportRows([])
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseDirectionCsv(text)
      if (rows.length === 0) { setImportError('Nenhuma linha válida encontrada. Confirma que é a listagem FPP de Não Atletas.'); return }
      setImportRows(rows)
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    if (importRows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/direction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importRows),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao importar', description: json.error ?? 'Nenhum membro foi importado.', variant: 'destructive' })
        return
      }
      const parts = [
        json.created ? `${json.created} criado(s)` : null,
        json.updated ? `${json.updated} atualizado(s) (cargos juntados)` : null,
        json.errors?.length ? `${json.errors.length} erro(s)` : null,
      ].filter(Boolean)
      toast({ title: parts.join(', ') || 'Nada para importar', variant: json.errors?.length ? 'destructive' : undefined })
      setImportOpen(false)
      setImportRows([])
      setImportError('')
      if (fileRef.current) fileRef.current.value = ''
      fetchMembers()
    } catch {
      toast({ title: 'Erro de ligação — nenhum membro foi importado', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteDialog.member) return
    try {
      const res = await fetch(`/api/direction/${deleteDialog.member.id}`, { method: 'DELETE' })
      if (res.ok) { toast({ title: 'Membro eliminado' }); fetchMembers() }
      else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao eliminar', variant: 'destructive' })
    } finally {
      setDeleteDialog({ open: false, member: null })
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {can('editDirection') && (
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Importar CSV FPP</span>
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Novo Membro</Button>
          </>
        )}
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargos</TableHead>
              <TableHead className="hidden md:table-cell">Escalão(ões)</TableHead>
              <TableHead className="hidden sm:table-cell">Contacto</TableHead>
              <TableHead className="hidden lg:table-cell">Salário</TableHead>
              {can('editDirection') && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">
                <Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p>Nenhum membro registado</p>
                  {can('editDirection') && (
                    <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Adicionar membro</Button>
                  )}
                </div>
              </TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{m.name}</span>
                    {m.athleteId && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 flex-shrink-0">
                        <User className="h-2.5 w-2.5" />Sénior
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIRECTION_ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-800'}`}>
                        {roleLabel(r)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {m.trainerAgeGroups?.map((ag) => (
                      <Badge key={`t-${ag}`} variant="secondary" className="text-xs">{ageGroupLabel(ag)}</Badge>
                    ))}
                    {m.sectionistAgeGroups?.map((ag) => (
                      <Badge key={`s-${ag}`} variant="outline" className="text-xs">{ageGroupLabel(ag)}</Badge>
                    ))}
                    {!m.trainerAgeGroups?.length && !m.sectionistAgeGroups?.length && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="space-y-0.5">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-xs hover:underline">
                        <Phone className="h-3 w-3 flex-shrink-0" />{m.phone}
                      </a>
                    )}
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs hover:underline">
                        <Mail className="h-3 w-3 flex-shrink-0" />{m.email}
                      </a>
                    )}
                    {!m.phone && !m.email && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  {m.salary != null
                    ? <span className="flex items-center gap-0.5 font-medium text-emerald-700"><Euro className="h-3 w-3" />{m.salary.toFixed(2)}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                {can('editDirection') && (
                  <TableCell>
                    <div className="flex gap-1">
                      {m.salary != null && m.salary > 0 && (
                        <Button variant="ghost" size="icon" title="Histórico de salários" onClick={() => setSalaryModal({ open: true, member: m })}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDialog({ open: true, member: m })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Salary total */}
      {members.some((m) => m.salary != null && m.salary > 0) && (
        <p className="text-sm text-muted-foreground text-right">
          Total salários mensais:{' '}
          <strong className="text-foreground">
            {members.reduce((s, m) => s + (m.salary ?? 0), 0).toLocaleString(numLocale, { minimumFractionDigits: 2 })} €
          </strong>
        </p>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingMember ? 'Editar Membro' : 'Novo Membro'}</SheetTitle>
            <SheetDescription>Preencha os dados do membro da direção</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">

            {/* Atleta Sénior (opcional) */}
            {seniorAthletes.length > 0 && (
              <div className="space-y-1">
                <Label>Atleta Sénior <span className="text-muted-foreground font-normal text-xs">— opcional</span></Label>
                <Select value={watchedAthleteId ?? 'none'} onValueChange={handleAthleteSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar atleta sénior..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (pessoa externa)</SelectItem>
                    {seniorAthletes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>#{a.number} {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se for atleta sénior, os dados são preenchidos automaticamente.</p>
              </div>
            )}

            {/* Nome */}
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Telefone + Email */}
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

            {/* Salário */}
            <div className="space-y-1">
              <Label>Salário Mensal (€) <span className="text-muted-foreground font-normal text-xs">— opcional</span></Label>
              <div className="relative">
                <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-7" {...register('salary')} />
              </div>
            </div>

            {/* Cargos */}
            <div className="space-y-2">
              <Label>Cargos *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                    <Checkbox checked={watchedRoles.includes(role.value)} onCheckedChange={() => toggleRole(role.value)} />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
              {errors.roles && <p className="text-xs text-destructive">{errors.roles.message as string}</p>}
            </div>

            {/* Escalões do Treinador */}
            {hasTrainer && (
              <AgeGroupPanel
                label="Escalões do Treinador"
                color="blue"
                selected={watchedTrainerAgeGroups}
                onToggle={(ag) => toggleAgeGroup('trainerAgeGroups', ag)}
                onToggleAll={() => toggleAllAgeGroups('trainerAgeGroups')}
              />
            )}

            {/* Escalões do Seccionista */}
            {hasSeccionista && (
              <AgeGroupPanel
                label="Escalões do Seccionista"
                color="emerald"
                selected={watchedSectionistAgeGroups}
                onToggle={(ag) => toggleAgeGroup('sectionistAgeGroups', ag)}
                onToggleAll={() => toggleAllAgeGroups('sectionistAgeGroups')}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMember ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Salary history modal */}
      <Dialog open={salaryModal.open} onOpenChange={(o) => setSalaryModal({ open: o, member: salaryModal.member })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Salários — {salaryModal.member?.name}</DialogTitle>
          </DialogHeader>
          {salaryModal.member && (
            <SalaryCalendar memberId={salaryModal.member.id} salary={salaryModal.member.salary ?? null} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, member: deleteDialog.member })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Membro</DialogTitle>
            <DialogDescription>Tem a certeza que quer eliminar {deleteDialog.member?.name}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, member: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportRows([]); setImportError('') } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Membros via CSV FPP</DialogTitle>
            <DialogDescription>
              Carrega a <strong>Listagem de Inscrições — Não Atletas</strong> exportada do portal da FPP.
              As pessoas com múltiplos cargos são automaticamente agrupadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
            />
            {importError && (
              <div className="rounded border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{importError}</p>
              </div>
            )}
            {importRows.length > 0 && (
              <div className="rounded border overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground bg-muted px-3 py-2">{importRows.length} membro(s) detetado(s) — pré-visualização (5 primeiros)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">Cargos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5">{r.roles.map((role) => DIRECTION_ROLE_LABELS[role] ?? role).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importRows.length === 0 || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {importRows.length > 0 ? `${importRows.length} membro(s)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
