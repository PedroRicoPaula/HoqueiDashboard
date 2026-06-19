'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Pencil, Trash2, Loader2, Package2 } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import {
  TEXTILE_CATEGORY_LABELS, TEXTILE_TYPE_LABELS, TEXTILE_TYPES_BY_CATEGORY,
  TEXTILE_SIZES_ALL, TEXTILE_STATE_LABELS, TEXTILE_STATE_COLORS,
} from '@/lib/constants'
import { useDashLabels } from '@/hooks/useDashLabels'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Athlete { id: string; name: string; number: number }
interface TextileItem {
  id: string
  category: string
  type: string
  size: string
  jerseyNumber?: number | null
  personalized: boolean
  personalizationDetails?: string | null
  season: string
  state: string
  athleteId?: string | null
  isPartOfKit: boolean
  kitRef?: string | null
  paidByAthlete: boolean
  paidAmount?: number | null
  totalCost?: number | null
  notes?: string | null
  athlete?: { id: string; name: string; number: number } | null
}

const CATEGORIES = [
  { value: 'GAME', label: 'Jogo' },
  { value: 'TRAINING', label: 'Treino' },
  { value: 'OTHER', label: 'Outro' },
]

const STATES = [
  { value: 'STOCK', label: 'Em Stock' },
  { value: 'ASSIGNED', label: 'Atribuído' },
  { value: 'DAMAGED', label: 'Danificado' },
  { value: 'LOST', label: 'Perdido' },
]

function getCurrentSeason() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 9 ? `${y}/${String(y + 1).slice(-2)}` : `${y - 1}/${String(y).slice(-2)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TextilesPage() {
  const dashLabels = useDashLabels()
  const { can } = usePermissions()
  const { toast } = useToast()

  const [items, setItems] = useState<TextileItem[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const debouncedSearch = useDebounce(search)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TextileItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [kitMode, setKitMode] = useState(false)

  // Assign athlete dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: TextileItem | null }>({ open: false, item: null })

  // Form state
  const [form, setForm] = useState({
    category: 'GAME' as string,
    type: 'GAME_SHIRT' as string,
    size: 'M',
    jerseyNumber: '',
    personalized: false,
    personalizationDetails: '',
    season: getCurrentSeason(),
    state: 'STOCK' as string,
    athleteId: null as string | null,
    paidByAthlete: false,
    paidAmount: '',
    totalCost: '',
    notes: '',
  })

  // Kit mode: list of items to create together
  const [kitItems, setKitItems] = useState([
    { type: 'GAME_SHIRT', size: 'M', jerseyNumber: '', personalized: false },
    { type: 'GAME_SHORTS', size: 'M', jerseyNumber: '', personalized: false },
    { type: 'GAME_SOCKS', size: 'M', jerseyNumber: '', personalized: false },
  ])

  const typeOptions = TEXTILE_TYPES_BY_CATEGORY[form.category] ?? []

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    if (stateFilter !== 'all') params.set('state', stateFilter)
    if (seasonFilter !== 'all') params.set('season', seasonFilter)
    const res = await fetch(`/api/textiles?${params}`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [debouncedSearch, categoryFilter, stateFilter, seasonFilter])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => {
    fetch('/api/athletes?all=true').then((r) => r.json()).then((d) => { if (Array.isArray(d.athletes)) setAthletes(d.athletes) })
  }, [])

  // Reset type when category changes
  useEffect(() => {
    const opts = TEXTILE_TYPES_BY_CATEGORY[form.category] ?? []
    if (!opts.includes(form.type)) {
      setForm((p) => ({ ...p, type: opts[0] ?? 'OTHER' }))
    }
  }, [form.category, form.type])

  // ── Available seasons from loaded items ──────────────────────────────────
  const seasons = Array.from(new Set(items.map((i) => i.season))).sort().reverse()

  // ── Sheet helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingItem(null)
    setKitMode(false)
    setForm({
      category: 'GAME', type: 'GAME_SHIRT', size: 'M', jerseyNumber: '',
      personalized: false, personalizationDetails: '',
      season: getCurrentSeason(), state: 'STOCK', athleteId: null,
      paidByAthlete: false, paidAmount: '', totalCost: '', notes: '',
    })
    setKitItems([
      { type: 'GAME_SHIRT', size: 'M', jerseyNumber: '', personalized: false },
      { type: 'GAME_SHORTS', size: 'M', jerseyNumber: '', personalized: false },
      { type: 'GAME_SOCKS', size: 'M', jerseyNumber: '', personalized: false },
    ])
    setSheetOpen(true)
  }

  const openEdit = (item: TextileItem) => {
    setEditingItem(item)
    setKitMode(false)
    setForm({
      category: item.category,
      type: item.type,
      size: item.size,
      jerseyNumber: item.jerseyNumber ? String(item.jerseyNumber) : '',
      personalized: item.personalized,
      personalizationDetails: item.personalizationDetails ?? '',
      season: item.season,
      state: item.state,
      athleteId: item.athleteId ?? null,
      paidByAthlete: item.paidByAthlete,
      paidAmount: item.paidAmount ? String(item.paidAmount) : '',
      totalCost: item.totalCost ? String(item.totalCost) : '',
      notes: item.notes ?? '',
    })
    setSheetOpen(true)
  }

  const buildPayload = (f: typeof form) => ({
    category: f.category,
    type: f.type,
    size: f.size,
    jerseyNumber: f.jerseyNumber ? parseInt(f.jerseyNumber) : null,
    personalized: f.personalized,
    personalizationDetails: f.personalizationDetails || null,
    season: f.season,
    state: f.state,
    athleteId: f.athleteId || null,
    paidByAthlete: f.paidByAthlete,
    paidAmount: f.paidAmount ? parseFloat(f.paidAmount) : null,
    totalCost: f.totalCost ? parseFloat(f.totalCost) : null,
    notes: f.notes || null,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (kitMode && !editingItem) {
        // Create all kit items
        const kitRef = `kit-${Date.now()}`
        const results = await Promise.allSettled(
          kitItems.map((ki) =>
            fetch('/api/textiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...buildPayload(form),
                type: ki.type,
                size: ki.size,
                jerseyNumber: ki.jerseyNumber ? parseInt(ki.jerseyNumber) : null,
                personalized: ki.personalized,
                isPartOfKit: true,
                kitRef,
              }),
            })
          )
        )
        const ok = results.filter((r) => r.status === 'fulfilled').length
        toast({ title: `Kit criado: ${ok}/${kitItems.length} peças` })
        setSheetOpen(false)
        fetchItems()
        return
      }

      const url = editingItem ? `/api/textiles/${editingItem.id}` : '/api/textiles'
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingItem ? 'Item atualizado' : 'Item criado' })
      setSheetOpen(false)
      fetchItems()
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.item) return
    const res = await fetch(`/api/textiles/${deleteDialog.item.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Item eliminado' }); fetchItems() }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteDialog({ open: false, item: null })
  }

  const filteredAssignAthletes = athletes.filter((a) =>
    a.name.toLowerCase().includes(assignSearch.toLowerCase()) || String(a.number).includes(assignSearch)
  )

  const hasActiveFilters = debouncedSearch || categoryFilter !== 'all' || stateFilter !== 'all' || seasonFilter !== 'all'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Categoria" />
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
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={seasonFilter} onValueChange={setSeasonFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Época" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as épocas</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can('editTextiles') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Item
          </Button>
        )}
      </div>

      {!loading && (
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? 'ns' : ''}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Época</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Atleta</TableHead>
              <TableHead className="hidden lg:table-cell">Custo</TableHead>
              {can('editTextiles') && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 && !hasActiveFilters ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="space-y-3">
                    <Package2 className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">Ainda não existem materiais têxteis</p>
                    {can('editTextiles') && (
                      <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar primeiro item
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{dashLabels.textileTypes[item.type] ?? TEXTILE_TYPE_LABELS[item.type] ?? item.type}</p>
                      {item.jerseyNumber && (
                        <p className="text-xs text-muted-foreground">Nº {item.jerseyNumber}</p>
                      )}
                      {item.personalized && (
                        <p className="text-xs text-blue-600">Personalizado</p>
                      )}
                      {item.isPartOfKit && (
                        <p className="text-xs text-purple-600">Kit</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-medium">{item.size}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {dashLabels.textileCategories[item.category] ?? TEXTILE_CATEGORY_LABELS[item.category] ?? item.category}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {item.season}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TEXTILE_STATE_COLORS[item.state] ?? 'bg-gray-100'}`}>
                      {dashLabels.textileStates[item.state] ?? TEXTILE_STATE_LABELS[item.state] ?? item.state}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {item.athlete ? `#${item.athlete.number} ${item.athlete.name}` : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {item.totalCost ? (
                      <div>
                        <span className={item.paidByAthlete ? 'text-green-700' : 'text-orange-700'}>
                          {item.paidAmount ? `${item.paidAmount}€` : '—'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          / {item.totalCost}€
                        </span>
                      </div>
                    ) : item.paidAmount ? (
                      <span className={item.paidByAthlete ? 'text-green-700' : 'text-orange-700'}>
                        {item.paidAmount}€
                      </span>
                    ) : '—'}
                  </TableCell>
                  {can('editTextiles') && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive"
                          onClick={() => setDeleteDialog({ open: true, item })}
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
            <SheetTitle>{editingItem ? 'Editar Item' : 'Novo Item Têxtil'}</SheetTitle>
            <div className="flex items-center justify-between">
              <SheetDescription>Preencha os dados do equipamento</SheetDescription>
              {!editingItem && (
                <Button
                  type="button" variant="outline" size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setKitMode((v) => !v)}
                >
                  {kitMode ? 'Peça única' : 'Criar kit de jogo'}
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* Common fields: season, category, athlete, payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Época *</Label>
                <Input
                  value={form.season}
                  onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))}
                  placeholder="ex: 2025/26"
                />
              </div>
            </div>

            {/* Single mode: type + size */}
            {!kitMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo *</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem key={t} value={t}>{TEXTILE_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Tamanho *</Label>
                    <Select value={form.size} onValueChange={(v) => setForm((p) => ({ ...p, size: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEXTILE_SIZES_ALL.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(form.type === 'GAME_SHIRT' || form.type === 'GK_SHIRT') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Nº Camisola</Label>
                      <Input
                        type="number" min="1"
                        value={form.jerseyNumber}
                        onChange={(e) => setForm((p) => ({ ...p, jerseyNumber: e.target.value }))}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-1 flex flex-col justify-end pb-1">
                      <div className="flex items-center justify-between">
                        <Label>Personalizado?</Label>
                        <Switch
                          checked={form.personalized}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, personalized: v }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {form.personalized && (
                  <div className="space-y-1">
                    <Label>Detalhes personalização</Label>
                    <Input
                      value={form.personalizationDetails}
                      onChange={(e) => setForm((p) => ({ ...p, personalizationDetails: e.target.value }))}
                      placeholder="ex: João Silva · Nº 10"
                    />
                  </div>
                )}
              </>
            )}

            {/* Kit mode: list of pieces */}
            {kitMode && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Peças do kit (todas com a mesma época e atleta)</p>
                {kitItems.map((ki, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Peça {idx + 1}</span>
                      {kitItems.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => setKitItems((p) => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={ki.type}
                        onValueChange={(v) => setKitItems((p) => p.map((x, i) => i === idx ? { ...x, type: v } : x))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(TEXTILE_TYPES_BY_CATEGORY[form.category] ?? []).map((t) => (
                            <SelectItem key={t} value={t}>{TEXTILE_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={ki.size}
                        onValueChange={(v) => setKitItems((p) => p.map((x, i) => i === idx ? { ...x, size: v } : x))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TEXTILE_SIZES_ALL.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(ki.type === 'GAME_SHIRT' || ki.type === 'GK_SHIRT') && (
                      <Input
                        className="h-8 text-xs" type="number" min="1"
                        placeholder="Nº camisola"
                        value={ki.jerseyNumber}
                        onChange={(e) => setKitItems((p) => p.map((x, i) => i === idx ? { ...x, jerseyNumber: e.target.value } : x))}
                      />
                    )}
                  </div>
                ))}
                <Button
                  type="button" variant="outline" size="sm" className="w-full"
                  onClick={() => setKitItems((p) => [...p, { type: typeOptions[0] ?? 'OTHER', size: 'M', jerseyNumber: '', personalized: false }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar peça
                </Button>
              </div>
            )}

            {/* State */}
            <div className="space-y-1">
              <Label>Estado *</Label>
              <Select
                value={form.state}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, state: v, ...( v !== 'ASSIGNED' ? { athleteId: null, paidByAthlete: false, paidAmount: '' } : {}) }))
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

            {/* Athlete + payment (ASSIGNED) */}
            {form.state === 'ASSIGNED' && (
              <div className="rounded-md border p-3 space-y-3">
                <div className="space-y-1">
                  <Label>Atleta</Label>
                  <Button
                    type="button" variant="outline" className="w-full justify-start"
                    onClick={() => { setAssignOpen(true); setAssignSearch('') }}
                  >
                    {form.athleteId
                      ? athletes.find((a) => a.id === form.athleteId)?.name ?? 'Selecionar...'
                      : 'Selecionar atleta...'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Custo total (€)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.totalCost}
                      onChange={(e) => setForm((p) => ({
                        ...p,
                        totalCost: e.target.value,
                        paidAmount: p.paidByAthlete ? e.target.value : p.paidAmount,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Pago pelo atleta (€)</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.paidAmount}
                      disabled={form.paidByAthlete}
                      onChange={(e) => setForm((p) => ({ ...p, paidAmount: e.target.value }))}
                    />
                  </div>
                </div>
                {form.totalCost && form.paidAmount && !form.paidByAthlete && (
                  <p className="text-xs text-muted-foreground">
                    Clube paga: {Math.max(0, parseFloat(form.totalCost || '0') - parseFloat(form.paidAmount || '0')).toFixed(2)}€
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Totalmente pago pelo atleta?</Label>
                    <p className="text-xs text-muted-foreground">Atleta paga o custo total; clube não suporta custo</p>
                  </div>
                  <Switch
                    checked={form.paidByAthlete}
                    onCheckedChange={(v) => setForm((p) => ({
                      ...p,
                      paidByAthlete: v,
                      paidAmount: v ? p.totalCost : '',
                    }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingItem ? 'Guardar' : kitMode ? `Criar kit (${kitItems.length} peças)` : 'Criar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Assign Athlete Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Selecionar Atleta</DialogTitle></DialogHeader>
          <Input
            placeholder="Pesquisar atleta..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            <button
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-muted-foreground"
              onClick={() => { setForm((p) => ({ ...p, athleteId: null })); setAssignOpen(false) }}
            >
              Sem atleta
            </button>
            {filteredAssignAthletes.map((a) => (
              <button
                key={a.id}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
                onClick={() => { setForm((p) => ({ ...p, athleteId: a.id })); setAssignOpen(false) }}
              >
                #{a.number} {a.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, item: deleteDialog.item })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Item</DialogTitle>
            <DialogDescription>
              Tem a certeza que quer eliminar{' '}
              <strong>{deleteDialog.item ? TEXTILE_TYPE_LABELS[deleteDialog.item.type] : ''}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, item: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
