'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { Plus, Search, Pencil, Trash2, Loader2, Euro, ExternalLink, Download, Upload, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { AGE_GROUPS, AGE_GROUP_LABELS } from '@/lib/constants'
import { useDashLabels } from '@/hooks/useDashLabels'

function calcAge(birthDate: string): number {
  const b = new Date(birthDate)
  const n = new Date()
  return n.getFullYear() - b.getFullYear() -
    (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
}

const today = new Date().toISOString().split('T')[0]

const athleteSchema = z.object({
  number: z.coerce.number().int().positive('Número deve ser positivo'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória')
    .refine((v) => new Date(v) <= new Date(), 'Data de nascimento não pode ser futura'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  nif: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  idCard: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  monthlyFee: z.coerce.number().min(0).optional().default(0),
  feeExempt: z.boolean().optional().default(false),
})

type AthleteForm = z.infer<typeof athleteSchema>

interface Athlete {
  id: string
  number: number
  name: string
  ageGroup: string
  birthDate: string
  phone?: string
  email?: string
  nif?: string
  address?: string
  school?: string
  idCard?: string
  parentName?: string
  parentPhone?: string
  monthlyFee: number
  feeExempt: boolean
}

// ─── CSV Import helpers ───────────────────────────────────────────────────────

const AGE_GROUP_MAP: Record<string, string> = {
  'sub-11': 'SUB11', 'sub11': 'SUB11', 'sub_11': 'SUB11', 'sub 11': 'SUB11',
  'sub-13': 'SUB13', 'sub13': 'SUB13', 'sub_13': 'SUB13', 'sub 13': 'SUB13',
  'sub-15': 'SUB15', 'sub15': 'SUB15', 'sub_15': 'SUB15', 'sub 15': 'SUB15',
  'sub-17': 'SUB17', 'sub17': 'SUB17', 'sub_17': 'SUB17', 'sub 17': 'SUB17',
  'sub-19': 'SUB19', 'sub19': 'SUB19', 'sub_19': 'SUB19', 'sub 19': 'SUB19',
  'seniors': 'SENIORS', 'seniores': 'SENIORS',
}

function parseAgeGroup(v: string): string {
  return AGE_GROUP_MAP[v.toLowerCase().trim()] ?? v.toUpperCase().trim()
}

function parseBirthDate(v: string): string {
  if (!v) return ''
  // DD/MM/YYYY → YYYY-MM-DD
  const ptMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ptMatch) return `${ptMatch[3]}-${ptMatch[2].padStart(2, '0')}-${ptMatch[1].padStart(2, '0')}`
  // Already YYYY-MM-DD
  return v.trim()
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))
  return lines.slice(1).map((line) => {
    const cols = line.split(sep)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim().replace(/^["']|["']$/g, '') })
    return obj
  })
}

function rowToAthlete(row: Record<string, string>) {
  const number = parseInt(row['numero'] ?? row['n_'] ?? row['number'] ?? row['n__'] ?? '')
  const name = row['nome'] ?? row['name'] ?? ''
  const ageGroupRaw = row['escalao'] ?? row['age_group'] ?? row['agegroup'] ?? row['escalão'] ?? ''
  const birthDateRaw = row['data_nascimento'] ?? row['data_nasc_'] ?? row['birthdate'] ?? row['data'] ?? ''
  return {
    number: isNaN(number) ? undefined : number,
    name: name,
    ageGroup: parseAgeGroup(ageGroupRaw),
    birthDate: parseBirthDate(birthDateRaw),
    phone: row['telefone'] ?? row['phone'] ?? '',
    email: row['email'] ?? '',
    nif: row['nif'] ?? '',
    idCard: row['n__cc_bi'] ?? row['cc'] ?? row['id_card'] ?? '',
    address: row['morada'] ?? row['address'] ?? '',
    school: row['escola'] ?? row['school'] ?? '',
    parentName: row['encarregado'] ?? row['parent_name'] ?? '',
    parentPhone: row['tel__encarregado'] ?? row['parent_phone'] ?? '',
    monthlyFee: parseFloat(row['mensalidade___'] ?? row['mensalidade'] ?? row['monthly_fee'] ?? '0') || 0,
    feeExempt: (row['isento'] ?? row['fee_exempt'] ?? '').toLowerCase() === 'sim' || (row['isento'] ?? '').toLowerCase() === 'true',
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AthletesPage() {
  const dashLabels = useDashLabels()

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ageGroupFilter, setAgeGroupFilter] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; athlete: Athlete | null }>({ open: false, athlete: null })
  const [saving, setSaving] = useState(false)

  // CSV Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ReturnType<typeof rowToAthlete>[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Export
  const [exporting, setExporting] = useState(false)

  const { can } = usePermissions()
  const { toast } = useToast()
  const debouncedSearch = useDebounce(search)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<AthleteForm>({ resolver: zodResolver(athleteSchema) as any })

  const fetchAthletes = useCallback(async (p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (ageGroupFilter !== 'all') params.set('ageGroup', ageGroupFilter)
    const res = await fetch(`/api/athletes?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAthletes(data.athletes)
      setTotal(data.total)
      setPages(data.pages)
      setPage(p)
    }
    setLoading(false)
  }, [debouncedSearch, ageGroupFilter, page])

  useEffect(() => { fetchAthletes(1) }, [debouncedSearch, ageGroupFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingAthlete(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reset({ number: undefined as any, name: '', ageGroup: 'SENIORS', birthDate: '', phone: '', email: '', nif: '', address: '', school: '', idCard: '', parentName: '', parentPhone: '', monthlyFee: 0, feeExempt: false })
    setSheetOpen(true)
  }

  const openEdit = (athlete: Athlete) => {
    setEditingAthlete(athlete)
    reset({
      number: athlete.number,
      name: athlete.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ageGroup: athlete.ageGroup as any,
      birthDate: athlete.birthDate ? athlete.birthDate.substring(0, 10) : '',
      phone: athlete.phone ?? '',
      email: athlete.email ?? '',
      nif: athlete.nif ?? '',
      address: athlete.address ?? '',
      school: athlete.school ?? '',
      idCard: athlete.idCard ?? '',
      parentName: athlete.parentName ?? '',
      parentPhone: athlete.parentPhone ?? '',
      monthlyFee: athlete.monthlyFee ?? 0,
      feeExempt: athlete.feeExempt ?? false,
    })
    setSheetOpen(true)
  }

  const onSubmit = async (data: AthleteForm) => {
    setSaving(true)
    try {
      const url = editingAthlete ? `/api/athletes/${editingAthlete.id}` : '/api/athletes'
      const method = editingAthlete ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingAthlete ? 'Atleta atualizado' : 'Atleta criado' })
      setSheetOpen(false)
      fetchAthletes(1)
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.athlete) return
    const res = await fetch(`/api/athletes/${deleteDialog.athlete.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Atleta eliminado' }); fetchAthletes(1) }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteDialog({ open: false, athlete: null })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (ageGroupFilter !== 'all') params.set('ageGroup', ageGroupFilter)
      const res = await fetch(`/api/reports/athletes?${params}`)
      if (!res.ok) { toast({ title: 'Erro ao exportar', variant: 'destructive' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `atletas-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Lista exportada' })
    } finally { setExporting(false) }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCsv(text)
      const parsed = rows.map(rowToAthlete)
      const errs: string[] = []
      parsed.forEach((r, i) => {
        if (!r.number) errs.push(`Linha ${i + 2}: número em falta`)
        if (!r.name) errs.push(`Linha ${i + 2}: nome em falta`)
        if (!r.ageGroup) errs.push(`Linha ${i + 2}: escalão em falta`)
      })
      setImportRows(parsed)
      setImportErrors(errs)
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    if (importErrors.length > 0) { toast({ title: 'Corrija os erros antes de importar', variant: 'destructive' }); return }
    setImporting(true)
    try {
      const res = await fetch('/api/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importRows),
      })
      const json = await res.json()
      toast({ title: `${json.created} atleta(s) importado(s)${json.errors?.length ? `, ${json.errors.length} erro(s)` : ''}` })
      setImportOpen(false)
      setImportRows([])
      setImportErrors([])
      if (fileRef.current) fileRef.current.value = ''
      fetchAthletes(1)
    } finally { setImporting(false) }
  }

  const ageGroupValue = watch('ageGroup')

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar atletas..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos os escalões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {AGE_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Exportar</span>
        </Button>
        {can('editAthletes') && (
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Importar CSV</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />Novo Atleta
            </Button>
          </>
        )}
      </div>

      {!loading && (
        <p className="text-sm text-muted-foreground">
          {total} atleta{total !== 1 ? 's' : ''}
          {pages > 1 && ` · página ${page} de ${pages}`}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">N.º</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Escalão</TableHead>
              <TableHead className="hidden sm:table-cell">Data Nasc.</TableHead>
              <TableHead className="hidden sm:table-cell w-14">Idade</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : athletes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <p>{debouncedSearch || ageGroupFilter !== 'all' ? 'Nenhum atleta encontrado' : 'Ainda não há atletas registados'}</p>
                    {can('editAthletes') && !debouncedSearch && ageGroupFilter === 'all' && (
                      <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Adicionar primeiro atleta</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : athletes.map((athlete) => (
              <TableRow key={athlete.id}>
                <TableCell className="font-mono font-medium">{athlete.number}</TableCell>
                <TableCell className="font-medium">{athlete.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{dashLabels.ageGroups[athlete.ageGroup] ?? AGE_GROUP_LABELS[athlete.ageGroup] ?? athlete.ageGroup}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {athlete.birthDate ? format(new Date(athlete.birthDate), 'dd/MM/yyyy') : '-'}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {athlete.birthDate ? calcAge(athlete.birthDate) : '-'}
                </TableCell>
                <TableCell className="hidden md:table-cell">{athlete.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/athletes/${athlete.id}`}><ExternalLink className="h-4 w-4" /></Link>
                    </Button>
                    {can('editAthletes') && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(athlete)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDialog({ open: true, athlete })}><Trash2 className="h-4 w-4" /></Button>
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
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAthletes(page - 1)} disabled={page <= 1 || loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => fetchAthletes(page + 1)} disabled={page >= pages || loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingAthlete ? 'Editar Atleta' : 'Novo Atleta'}</SheetTitle>
            <SheetDescription>{editingAthlete ? 'Altere os dados do atleta' : 'Preencha os dados do novo atleta'}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>N.º Atleta *</Label>
                <Input type="number" {...register('number')} />
                {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Escalão *</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={ageGroupValue} onValueChange={(v) => setValue('ageGroup', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Data de Nascimento *</Label>
              <Input type="date" max={today} {...register('birthDate')} />
              {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate.message}</p>}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>NIF</Label>
                <Input {...register('nif')} />
              </div>
              <div className="space-y-1">
                <Label>N.º CC/BI</Label>
                <Input {...register('idCard')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Morada</Label>
              <Input {...register('address')} />
            </div>
            {ageGroupValue !== 'SENIORS' && (
              <div className="space-y-1">
                <Label>Escola</Label>
                <Input {...register('school')} />
              </div>
            )}
            {ageGroupValue !== 'SENIORS' && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-3">Mensalidade</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Valor mensal (€)</Label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" min="0" step="0.01" className="pl-9" {...register('monthlyFee')} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Isento de pagamento</Label>
                    <div className="flex items-center h-10 gap-3">
                      <Switch checked={watch('feeExempt') ?? false} onCheckedChange={(v) => setValue('feeExempt', v)} />
                      <span className="text-sm text-muted-foreground">{watch('feeExempt') ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {ageGroupValue !== 'SENIORS' && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-3">Encarregado de Educação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Nome</Label>
                    <Input {...register('parentName')} />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input {...register('parentPhone')} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAthlete ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, athlete: deleteDialog.athlete })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Atleta</DialogTitle>
            <DialogDescription>Tem a certeza que quer eliminar {deleteDialog.athlete?.name}? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, athlete: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportRows([]); setImportErrors([]) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Atletas via CSV</DialogTitle>
            <DialogDescription>
              Carregue um ficheiro CSV com as colunas: <code className="bg-muted px-1 rounded text-xs">numero, nome, escalao, data_nascimento</code> (obrigatórias) + opcionais.
              Escalão aceita: Sub-11, Sub-13, Sub-15, Sub-17, Sub-19, Seniores.
              Data: DD/MM/AAAA ou AAAA-MM-DD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer" />

            {importErrors.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-3 space-y-1">
                <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {importErrors.length} erro(s) encontrado(s)
                </p>
                {importErrors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-700">{e}</p>
                ))}
                {importErrors.length > 5 && <p className="text-xs text-red-600">...e mais {importErrors.length - 5}</p>}
              </div>
            )}

            {importRows.length > 0 && (
              <div className="rounded border overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground bg-muted px-3 py-2">{importRows.length} linha(s) detetada(s) — pré-visualização (5 primeiras)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left">N.º</th>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">Escalão</th>
                        <th className="px-3 py-2 text-left">Nascimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-mono">{r.number ?? '—'}</td>
                          <td className="px-3 py-1.5">{r.name || '—'}</td>
                          <td className="px-3 py-1.5">{r.ageGroup || '—'}</td>
                          <td className="px-3 py-1.5">{r.birthDate || '—'}</td>
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
              Importar {importRows.length > 0 ? `${importRows.length} atleta(s)` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
