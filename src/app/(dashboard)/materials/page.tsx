'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Pencil, Trash2, Loader2, Layers } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { MATERIAL_STATE_LABELS, MATERIAL_STATE_COLORS, MATERIAL_TYPES } from '@/lib/constants'
import { useDashLabels } from '@/hooks/useDashLabels'
import { useSeasonStore } from '@/store/seasonStore'
import { CalendarDays } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'ATHLETE', label: 'Atleta' },
  { value: 'GOALKEEPER', label: 'Guarda-Redes' },
  { value: 'SMALL', label: 'Pequeno Material' },
]

const STATES = [
  { value: 'FREE', label: 'Livre' },
  { value: 'ASSIGNED', label: 'Atribuído' },
  { value: 'DAMAGED', label: 'Danificado' },
]

// ─── Schema ───────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  name: z.string().optional().default(''),
  category: z.enum(['ATHLETE', 'GOALKEEPER', 'SMALL']),
  type: z.string().min(1, 'Tipo obrigatório'),
  state: z.enum(['FREE', 'ASSIGNED', 'DAMAGED']),
  athleteId: z.string().optional().nullable(),
  notes: z.string().optional(),
  paidByAthlete: z.boolean().optional().default(false),
  paidAmount: z.coerce.number().nullable().optional(),
  seasonId: z.string().uuid().nullable().optional(),
})
type MaterialForm = z.infer<typeof materialSchema>

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Athlete { id: string; name: string; number: number }
interface Material {
  id: string
  name: string
  category: string
  type: string
  state: string
  notes?: string
  paidByAthlete: boolean
  paidAmount?: number | null
  athlete?: { id: string; name: string; number: number } | null
}
interface BatchItem {
  uid: string
  category: 'ATHLETE' | 'GOALKEEPER' | 'SMALL'
  type: string
  typeCustom: string
  name: string
  paidByAthlete: boolean
  paidAmount: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newBatchItem(): BatchItem {
  return { uid: crypto.randomUUID(), category: 'ATHLETE', type: '', typeCustom: '', name: '', paidByAthlete: false, paidAmount: '' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const dashLabels = useDashLabels()
  const { seasons, selectedSeasonId, getSelectedSeason, getActiveSeason } = useSeasonStore()
  const selectedSeason = getSelectedSeason()
  const activeSeason = getActiveSeason()

  // Data state
  const [materials, setMaterials] = useState<Material[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Sheet / form state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [saving, setSaving] = useState(false)
  const [typeSelect, setTypeSelect] = useState('')
  const [typeCustom, setTypeCustom] = useState('')

  // Single-mode athlete assign dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; material: Material | null }>({ open: false, material: null })

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false)
  const [batchAthleteId, setBatchAthleteId] = useState<string | null>(null)
  const [batchAthleteSearch, setBatchAthleteSearch] = useState('')
  const [batchAthleteOpen, setBatchAthleteOpen] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([newBatchItem()])
  const [batchSaving, setBatchSaving] = useState(false)

  const { can } = usePermissions()
  const { toast } = useToast()
  const debouncedSearch = useDebounce(search)

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<MaterialForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(materialSchema) as any,
    defaultValues: { state: 'FREE', category: 'ATHLETE', paidByAthlete: false },
  })

  const watchState = watch('state')
  const watchAthleteId = watch('athleteId')
  const watchCategory = watch('category')
  const watchPaid = watch('paidByAthlete')

  // Derived type options based on selected category
  const typeOptions = MATERIAL_TYPES[watchCategory] ?? []

  // Sync type field value when typeSelect or typeCustom changes
  useEffect(() => {
    setValue('type', typeSelect === 'OUTRO' ? typeCustom : typeSelect)
  }, [typeSelect, typeCustom, setValue])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (stateFilter !== 'all') params.set('state', stateFilter)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    if (selectedSeasonId) params.set('seasonId', selectedSeasonId)
    const res = await fetch(`/api/materials?${params}`)
    if (res.ok) setMaterials(await res.json())
    setLoading(false)
  }, [debouncedSearch, stateFilter, categoryFilter, selectedSeasonId])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  useEffect(() => {
    fetch('/api/athletes?all=true').then((r) => r.json()).then((data) => {
      if (Array.isArray(data.athletes)) setAthletes(data.athletes)
    })
  }, [])

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingMaterial(null)
    const defaultSeasonId = selectedSeasonId ?? activeSeason?.id ?? null
    reset({ name: '', category: 'ATHLETE', type: '', state: 'FREE', athleteId: null, notes: '', paidByAthlete: false, paidAmount: null, seasonId: defaultSeasonId })
    setTypeSelect('')
    setTypeCustom('')
    setBatchMode(false)
    setBatchItems([newBatchItem()])
    setBatchAthleteId(null)
    setBatchAthleteSearch('')
    setSheetOpen(true)
  }

  const openEdit = (m: Material) => {
    setEditingMaterial(m)
    setBatchMode(false)
    const predefined = (MATERIAL_TYPES[m.category] ?? []).includes(m.type)
    setTypeSelect(predefined ? m.type : 'OUTRO')
    setTypeCustom(predefined ? '' : m.type)
    reset({
      name: m.name ?? '',
      category: m.category as 'ATHLETE' | 'GOALKEEPER' | 'SMALL',
      type: m.type,
      state: m.state as 'FREE' | 'ASSIGNED' | 'DAMAGED',
      athleteId: m.athlete?.id ?? null,
      notes: m.notes ?? '',
      paidByAthlete: m.paidByAthlete ?? false,
      paidAmount: m.paidAmount ?? null,
      seasonId: (m as { seasonId?: string | null }).seasonId ?? null,
    })
    setSheetOpen(true)
  }

  // ── Single submit ──────────────────────────────────────────────────────────

  const onSubmit = async (data: MaterialForm) => {
    setSaving(true)
    try {
      const url = editingMaterial ? `/api/materials/${editingMaterial.id}` : '/api/materials'
      const method = editingMaterial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: editingMaterial ? 'Material atualizado' : 'Material criado' })
      setSheetOpen(false)
      fetchMaterials()
    } finally {
      setSaving(false)
    }
  }

  // ── Batch submit ───────────────────────────────────────────────────────────

  const handleBatchSubmit = async () => {
    // Validate all items have a type
    const invalid = batchItems.some((item) => {
      const resolvedType = item.type === 'OUTRO' ? item.typeCustom.trim() : item.type
      return !resolvedType
    })
    if (invalid) {
      toast({ title: 'Preencha o tipo de todos os itens', variant: 'destructive' })
      return
    }

    setBatchSaving(true)
    const state = batchAthleteId ? 'ASSIGNED' : 'FREE'
    const results = await Promise.allSettled(
      batchItems.map((item) => {
        const resolvedType = item.type === 'OUTRO' ? item.typeCustom.trim() : item.type
        const payload = {
          name: item.name.trim(),
          category: item.category,
          type: resolvedType,
          state,
          athleteId: batchAthleteId ?? null,
          paidByAthlete: batchAthleteId ? item.paidByAthlete : false,
          paidAmount: (batchAthleteId && item.paidAmount)
            ? parseFloat(item.paidAmount) || null
            : null,
        }
        return fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    if (failed === 0) {
      toast({ title: `${succeeded} material${succeeded !== 1 ? 'is' : ''} criado${succeeded !== 1 ? 's' : ''}` })
    } else {
      toast({
        title: `${succeeded} criado${succeeded !== 1 ? 's' : ''}, ${failed} com erro`,
        variant: 'destructive',
      })
    }

    setBatchSaving(false)
    setSheetOpen(false)
    fetchMaterials()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteDialog.material) return
    const res = await fetch(`/api/materials/${deleteDialog.material.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Material eliminado' }); fetchMaterials() }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteDialog({ open: false, material: null })
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredAthletes = athletes.filter((a) =>
    a.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
    String(a.number).includes(assignSearch)
  )

  const filteredBatchAthletes = athletes.filter((a) =>
    a.name.toLowerCase().includes(batchAthleteSearch.toLowerCase()) ||
    String(a.number).includes(batchAthleteSearch)
  )

  const hasActiveFilters = debouncedSearch || stateFilter !== 'all' || categoryFilter !== 'all'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar materiais..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todos estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can('editMaterials') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Material
          </Button>
        )}
      </div>

      {(!loading || selectedSeason) && (
        <div className="flex items-center gap-3">
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {materials.length} material{materials.length !== 1 ? 'is' : ''}
            </p>
          )}
          {selectedSeason && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              <CalendarDays className="h-3 w-3" />
              {selectedSeason.name}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">Marca</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Atleta</TableHead>
              <TableHead className="hidden md:table-cell">Pago</TableHead>
              {can('editMaterials') && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : materials.length === 0 && !hasActiveFilters ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="space-y-3">
                    <p className="text-muted-foreground">Ainda não existem materiais</p>
                    {can('editMaterials') && (
                      <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar primeiro material
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : materials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum material encontrado
                </TableCell>
              </TableRow>
            ) : (
              materials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.type}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {m.name || '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {CATEGORIES.find((c) => c.value === m.category)?.label ?? m.category}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MATERIAL_STATE_COLORS[m.state] ?? 'bg-gray-100'}`}>
                      {dashLabels.materialStates[m.state] ?? MATERIAL_STATE_LABELS[m.state] ?? m.state}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.athlete ? `#${m.athlete.number} ${m.athlete.name}` : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {m.state === 'ASSIGNED' ? (
                      m.paidByAthlete ? (
                        <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {m.paidAmount ? `${m.paidAmount}€ (atleta)` : 'Atleta pagou'}
                        </span>
                      ) : m.paidAmount ? (
                        <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {m.paidAmount}€ (clube)
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  {can('editMaterials') && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteDialog({ open: true, material: m })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingMaterial ? 'Editar Material' : 'Novo Material'}</SheetTitle>
            <div className="flex items-center justify-between">
              <SheetDescription>Preencha os dados do material</SheetDescription>
              {!editingMaterial && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setBatchMode((v) => !v)}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {batchMode ? 'Modo único' : 'Adicionar múltiplos'}
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* ── SINGLE MODE ── */}
          {/* eslint-disable @typescript-eslint/no-explicit-any */}
          {!batchMode && (
            <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 mt-6">
              {/* Category + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Categoria *</Label>
                  <Select
                    value={watchCategory}
                    onValueChange={(v) => {
                      setValue('category', v as 'ATHLETE' | 'GOALKEEPER' | 'SMALL')
                      setTypeSelect('')
                      setTypeCustom('')
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <Select value={typeSelect} onValueChange={setTypeSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                      <SelectItem value="OUTRO">Outro...</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                </div>
              </div>

              {/* Custom type input */}
              {typeSelect === 'OUTRO' && (
                <div className="space-y-1">
                  <Label>Tipo personalizado *</Label>
                  <Input
                    value={typeCustom}
                    onChange={(e) => setTypeCustom(e.target.value)}
                    placeholder="ex: Protetor Dorsal, Almofada..."
                  />
                </div>
              )}

              {/* Brand / Model */}
              <div className="space-y-1">
                <Label>Marca / Modelo</Label>
                <Input {...register('name')} placeholder="ex: Azemad, Bauer, Mission..." />
              </div>

              {/* State */}
              <div className="space-y-1">
                <Label>Estado *</Label>
                <Select
                  value={watchState}
                  onValueChange={(v) => {
                    setValue('state', v as 'FREE' | 'ASSIGNED' | 'DAMAGED')
                    if (v !== 'ASSIGNED') {
                      setValue('athleteId', null)
                      setValue('paidByAthlete', false)
                      setValue('paidAmount', null)
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned athlete + payment section */}
              {watchState === 'ASSIGNED' && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="space-y-1">
                    <Label>Atleta Atribuído</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => { setAssignOpen(true); setAssignSearch('') }}
                    >
                      {watchAthleteId
                        ? athletes.find((a) => a.id === watchAthleteId)?.name ?? 'Selecionar...'
                        : 'Selecionar atleta...'}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label>Valor do material (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...register('paidAmount')}
                    />
                    <p className="text-xs text-muted-foreground">Custo do equipamento — independente de quem pagou</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="paidByAthlete">Pago pelo atleta?</Label>
                      <p className="text-xs text-muted-foreground">Se sim, o clube não gastou este valor</p>
                    </div>
                    <Switch
                      id="paidByAthlete"
                      checked={watchPaid ?? false}
                      onCheckedChange={(v) => setValue('paidByAthlete', v)}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input {...register('notes')} />
              </div>

              {/* Season */}
              {seasons.length > 0 && (
                <div className="space-y-1">
                  <Label>Época</Label>
                  <select
                    {...register('seasonId')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sem época</option>
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (ativa)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingMaterial ? 'Guardar' : 'Criar'}
                </Button>
              </div>
            </form>
          )}

          {/* ── BATCH MODE ── */}
          {batchMode && (
            <div className="space-y-4 mt-6">
              {/* Shared athlete */}
              <div className="space-y-1">
                <Label>Atleta (partilhado por todos os itens)</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => { setBatchAthleteOpen(true); setBatchAthleteSearch('') }}
                >
                  {batchAthleteId
                    ? athletes.find((a) => a.id === batchAthleteId)
                      ? `#${athletes.find((a) => a.id === batchAthleteId)!.number} ${athletes.find((a) => a.id === batchAthleteId)!.name}`
                      : 'Selecionar...'
                    : 'Sem atleta (material livre)'}
                </Button>
              </div>

              {/* Batch items */}
              <div className="space-y-3">
                {batchItems.map((item, idx) => (
                  <div key={item.uid} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {idx + 1}</span>
                      {batchItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setBatchItems((prev) => prev.filter((i) => i.uid !== item.uid))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Categoria</Label>
                        <Select
                          value={item.category}
                          onValueChange={(v) => setBatchItems((prev) =>
                            prev.map((i) => i.uid === item.uid ? { ...i, category: v as BatchItem['category'], type: '' } : i)
                          )}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={item.type}
                          onValueChange={(v) => setBatchItems((prev) =>
                            prev.map((i) => i.uid === item.uid ? { ...i, type: v, typeCustom: '' } : i)
                          )}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(MATERIAL_TYPES[item.category] ?? []).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                            <SelectItem value="OUTRO">Outro...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {item.type === 'OUTRO' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo personalizado</Label>
                        <Input
                          className="h-8 text-sm"
                          value={item.typeCustom}
                          onChange={(e) => setBatchItems((prev) =>
                            prev.map((i) => i.uid === item.uid ? { ...i, typeCustom: e.target.value } : i)
                          )}
                          placeholder="ex: Protetor Dorsal..."
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Marca / Modelo</Label>
                      <Input
                        className="h-8 text-sm"
                        value={item.name}
                        onChange={(e) => setBatchItems((prev) =>
                          prev.map((i) => i.uid === item.uid ? { ...i, name: e.target.value } : i)
                        )}
                        placeholder="ex: Azemad, Bauer..."
                      />
                    </div>
                    {batchAthleteId && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Valor do material (€)</Label>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.paidAmount}
                            onChange={(e) => setBatchItems((prev) =>
                              prev.map((i) => i.uid === item.uid ? { ...i, paidAmount: e.target.value } : i)
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs" htmlFor={`paid-${item.uid}`}>Pago pelo atleta?</Label>
                          <Switch
                            id={`paid-${item.uid}`}
                            checked={item.paidByAthlete}
                            onCheckedChange={(v) => setBatchItems((prev) =>
                              prev.map((i) => i.uid === item.uid ? { ...i, paidByAthlete: v } : i)
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add item button */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setBatchItems((prev) => [...prev, newBatchItem()])}
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>

              {/* Batch actions */}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="flex-1" disabled={batchSaving} onClick={handleBatchSubmit}>
                  {batchSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar {batchItems.length} item{batchItems.length !== 1 ? 'ns' : ''}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign Athlete Dialog — single mode */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Atleta</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Pesquisar atleta..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            <button
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-muted-foreground"
              onClick={() => { setValue('athleteId', null); setAssignOpen(false) }}
            >
              Sem atleta
            </button>
            {filteredAthletes.map((a) => (
              <button
                key={a.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                onClick={() => { setValue('athleteId', a.id); setAssignOpen(false) }}
              >
                #{a.number} {a.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Athlete Dialog — batch mode */}
      <Dialog open={batchAthleteOpen} onOpenChange={setBatchAthleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Atleta (lote)</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Pesquisar atleta..."
            value={batchAthleteSearch}
            onChange={(e) => setBatchAthleteSearch(e.target.value)}
            className="mb-3"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            <button
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-muted-foreground"
              onClick={() => { setBatchAthleteId(null); setBatchAthleteOpen(false) }}
            >
              Sem atleta (material livre)
            </button>
            {filteredBatchAthletes.map((a) => (
              <button
                key={a.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                onClick={() => { setBatchAthleteId(a.id); setBatchAthleteOpen(false) }}
              >
                #{a.number} {a.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(o) => setDeleteDialog({ open: o, material: deleteDialog.material })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Material</DialogTitle>
            <DialogDescription>
              Tem a certeza que quer eliminar{' '}
              <strong>
                {deleteDialog.material?.type}
                {deleteDialog.material?.name ? ` (${deleteDialog.material.name})` : ''}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, material: null })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
