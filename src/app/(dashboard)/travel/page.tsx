'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, Loader2, Plane, MapPin, Clock, Car, ChefHat, Pencil, Users, Euro, CheckSquare, X } from 'lucide-react'
import { format, isPast } from 'date-fns'
import type { Locale } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDashT } from '@/hooks/useDashT'
import { useAuthStore } from '@/store/authStore'
import { getDateLocale } from '@/lib/date-locale'

const travelSchema = z.object({
  opponent: z.string().min(1, 'Adversário obrigatório'),
  pavilionUrl: z.string().url('URL inválido').optional().or(z.literal('')),
  departureDate: z.string().min(1, 'Data de partida obrigatória'),
  returnDate: z.string().optional(),
  departureTime: z.string().optional(),
  transport: z.string().optional(),
  meal: z.string().optional(),
  notes: z.string().optional(),
  budgetTransport: z.coerce.number().optional().nullable(),
  budgetMeal: z.coerce.number().optional().nullable(),
  budgetAccommodation: z.coerce.number().optional().nullable(),
})
type TravelForm = z.infer<typeof travelSchema>

interface Travel {
  id: string
  opponent: string
  pavilionUrl?: string
  departureDate: string
  returnDate?: string
  departureTime?: string
  transport?: string
  drivers: string[]
  meal?: string
  notes?: string
  convocados: string[]
  budgetTransport?: number | null
  budgetMeal?: number | null
  budgetAccommodation?: number | null
  checklistItems: string[]
}

interface DirectionMember { id: string; name: string; role: string }
interface Athlete { id: string; name: string; number: number; ageGroup: string }

function TravelCard({ travel, onEdit, onDelete, canEdit, dateLocale, tr }: {
  travel: Travel; onEdit: () => void; onDelete: () => void; canEdit: boolean
  dateLocale: Locale; tr: (key: string) => string
}) {
  const budget = (travel.budgetTransport ?? 0) + (travel.budgetMeal ?? 0) + (travel.budgetAccommodation ?? 0)
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="font-semibold">{travel.opponent}</h3>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(new Date(travel.departureDate), "d MMMM yyyy", { locale: dateLocale })}
              {travel.departureTime && ` · ${travel.departureTime}`}
            </span>
          </div>
          {travel.transport && (
            <div className="flex items-center gap-2">
              <Car className="h-3.5 w-3.5" />
              <span>{travel.transport}</span>
            </div>
          )}
          {travel.drivers.length > 0 && (
            <div className="flex items-start gap-2">
              <Car className="h-3.5 w-3.5 mt-0.5" />
              <span>{tr('travel.drivers')}: {travel.drivers.join(', ')}</span>
            </div>
          )}
          {travel.convocados.length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="h-3.5 w-3.5 mt-0.5" />
              <span>{travel.convocados.length} {tr('travel.squad').toLowerCase()}</span>
            </div>
          )}
          {budget > 0 && (
            <div className="flex items-center gap-2">
              <Euro className="h-3.5 w-3.5" />
              <span>{tr('travel.budget')}: {budget.toFixed(2)}€</span>
            </div>
          )}
          {travel.meal && (
            <div className="flex items-center gap-2">
              <ChefHat className="h-3.5 w-3.5" />
              <span>{travel.meal}</span>
            </div>
          )}
          {travel.checklistItems.length > 0 && (
            <div className="flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{travel.checklistItems.length} item{travel.checklistItems.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {travel.pavilionUrl && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <a href={travel.pavilionUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                Pavilhão
              </a>
            </div>
          )}
          {travel.notes && <p className="text-xs italic">{travel.notes}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TravelPage() {
  const [travels, setTravels] = useState<Travel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTravel, setEditingTravel] = useState<Travel | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; travel: Travel | null }>({ open: false, travel: null })
  const [saving, setSaving] = useState(false)
  const [showAllPast, setShowAllPast] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('travel_showAllPast') === 'true'
  })

  // Form extra state (outside react-hook-form for array fields)
  const [drivers, setDrivers] = useState<string[]>([])
  const [driverInput, setDriverInput] = useState('')
  const [convocados, setConvocados] = useState<string[]>([])
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [checklistInput, setChecklistInput] = useState('')

  // Remote data
  const [directionMembers, setDirectionMembers] = useState<DirectionMember[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  const { can } = usePermissions()
  const { toast } = useToast()
  const tr = useDashT()
  const clubLanguage = useAuthStore((s) => s.clubLanguage) ?? 'pt'
  const dateLocale = getDateLocale(clubLanguage)

  const {
    register, handleSubmit, reset, formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<TravelForm>({ resolver: zodResolver(travelSchema) as any })

  const fetchTravels = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/travel')
    if (res.ok) setTravels(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchTravels() }, [fetchTravels])

  const fetchFormData = useCallback(async () => {
    const [dRes, aRes] = await Promise.all([
      fetch('/api/direction'),
      fetch('/api/athletes?all=true'),
    ])
    if (dRes.ok) {
      const data = await dRes.json()
      setDirectionMembers(data.members ?? data ?? [])
    }
    if (aRes.ok) {
      const data = await aRes.json()
      setAthletes(data.athletes ?? [])
    }
  }, [])

  const openCreate = () => {
    setEditingTravel(null)
    reset({ opponent: '', pavilionUrl: '', departureDate: '', returnDate: '', departureTime: '', transport: '', meal: '', notes: '', budgetTransport: undefined, budgetMeal: undefined, budgetAccommodation: undefined })
    setDrivers([])
    setDriverInput('')
    setConvocados([])
    setChecklistItems([])
    setChecklistInput('')
    fetchFormData()
    setDialogOpen(true)
  }

  const openEdit = (t: Travel) => {
    setEditingTravel(t)
    reset({
      opponent: t.opponent,
      pavilionUrl: t.pavilionUrl ?? '',
      departureDate: t.departureDate ? t.departureDate.substring(0, 10) : '',
      returnDate: t.returnDate ? t.returnDate.substring(0, 10) : '',
      departureTime: t.departureTime ?? '',
      transport: t.transport ?? '',
      meal: t.meal ?? '',
      notes: t.notes ?? '',
      budgetTransport: t.budgetTransport ?? undefined,
      budgetMeal: t.budgetMeal ?? undefined,
      budgetAccommodation: t.budgetAccommodation ?? undefined,
    })
    setDrivers(t.drivers ?? [])
    setDriverInput('')
    setConvocados(t.convocados ?? [])
    setChecklistItems(t.checklistItems ?? [])
    setChecklistInput('')
    fetchFormData()
    setDialogOpen(true)
  }

  const addDriver = () => {
    const v = driverInput.trim()
    if (v && !drivers.includes(v)) setDrivers((d) => [...d, v])
    setDriverInput('')
  }

  const toggleDirectionDriver = (name: string) => {
    setDrivers((d) => d.includes(name) ? d.filter((x) => x !== name) : [...d, name])
  }

  const toggleConvocado = (name: string) => {
    setConvocados((c) => c.includes(name) ? c.filter((x) => x !== name) : [...c, name])
  }

  const addChecklistItem = () => {
    const v = checklistInput.trim()
    if (v && !checklistItems.includes(v)) setChecklistItems((c) => [...c, v])
    setChecklistInput('')
  }

  const onSubmit = async (data: TravelForm) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        drivers,
        convocados,
        checklistItems,
        budgetTransport: data.budgetTransport || null,
        budgetMeal: data.budgetMeal || null,
        budgetAccommodation: data.budgetAccommodation || null,
      }
      const url = editingTravel ? `/api/travel/${editingTravel.id}` : '/api/travel'
      const method = editingTravel ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { toast({ title: tr('common.error'), description: json.error, variant: 'destructive' }); return }
      toast({ title: editingTravel ? tr('travel.saved') : tr('travel.created') })
      setDialogOpen(false)
      fetchTravels()
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.travel) return
    const res = await fetch(`/api/travel/${deleteDialog.travel.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: tr('travel.deleted') }); fetchTravels() }
    else toast({ title: tr('common.errorDelete'), variant: 'destructive' })
    setDeleteDialog({ open: false, travel: null })
  }

  const toggleShowAllPast = () => {
    setShowAllPast((v) => {
      const next = !v
      localStorage.setItem('travel_showAllPast', String(next))
      return next
    })
  }

  const upcoming = travels.filter((t) => !isPast(new Date(t.departureDate)))
  const past = travels.filter((t) => isPast(new Date(t.departureDate)))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {can('editTravel') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{tr('travel.new')}</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {tr('travel.upcoming')} ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr('travel.noUpcoming')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((t) => (
                  <TravelCard key={t.id} travel={t} canEdit={can('editTravel')} onEdit={() => openEdit(t)} onDelete={() => setDeleteDialog({ open: true, travel: t })} dateLocale={dateLocale} tr={tr} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {tr('travel.past')} ({past.length})
            </h2>
            {past.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr('common.noData')}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                  {(showAllPast ? past : past.slice(0, 6)).map((t) => (
                    <TravelCard key={t.id} travel={t} canEdit={can('editTravel')} onEdit={() => openEdit(t)} onDelete={() => setDeleteDialog({ open: true, travel: t })} dateLocale={dateLocale} tr={tr} />
                  ))}
                </div>
                {past.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-muted-foreground"
                    onClick={toggleShowAllPast}
                  >
                    {showAllPast ? tr('common.seeLess') : tr('common.seeAll', { count: String(past.length - 6) })}
                  </Button>
                )}
              </>
            )}
          </section>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTravel ? tr('travel.editTitle') : tr('travel.new')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic info */}
            <div className="space-y-1">
              <Label>Adversário *</Label>
              <Input {...register('opponent')} />
              {errors.opponent && <p className="text-xs text-destructive">{errors.opponent.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Data de Partida *</Label>
                <Input type="date" {...register('departureDate')} />
              </div>
              <div className="space-y-1">
                <Label>Hora de Partida</Label>
                <Input type="time" {...register('departureTime')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data de Regresso</Label>
              <Input type="date" {...register('returnDate')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Transporte</Label>
                <Input {...register('transport')} placeholder="ex: Carrinha do clube" />
              </div>
              <div className="space-y-1">
                <Label>Refeição</Label>
                <Input {...register('meal')} placeholder="ex: Restaurante X" />
              </div>
            </div>

            {/* Drivers */}
            <div className="space-y-2">
              <Label>Condutores</Label>
              {directionMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 rounded-md border bg-gray-50">
                  {directionMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleDirectionDriver(m.name)}
                      className={cn(
                        'px-2 py-1 rounded text-xs border transition-colors',
                        drivers.includes(m.name)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white border-gray-200 hover:border-gray-400'
                      )}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={driverInput}
                  onChange={(e) => setDriverInput(e.target.value)}
                  placeholder="Outro condutor..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDriver() } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addDriver}>Adicionar</Button>
              </div>
              {drivers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {drivers.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                      {d}
                      <button type="button" onClick={() => setDrivers((ds) => ds.filter((x) => x !== d))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Convocados */}
            {athletes.length > 0 && (
              <div className="space-y-2">
                <Label>Convocados ({convocados.length})</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {athletes.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <Checkbox
                        checked={convocados.includes(a.name)}
                        onCheckedChange={() => toggleConvocado(a.name)}
                      />
                      <span className="text-sm">{a.number}. {a.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{a.ageGroup.replace('SUB', 'S-')}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Budget */}
            <div className="space-y-2">
              <Label>Orçamento</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Transporte (€)</p>
                  <Input type="number" step="0.01" min="0" {...register('budgetTransport')} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Refeição (€)</p>
                  <Input type="number" step="0.01" min="0" {...register('budgetMeal')} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Alojamento (€)</p>
                  <Input type="number" step="0.01" min="0" {...register('budgetAccommodation')} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <Label>Checklist de partida</Label>
              <div className="flex gap-2">
                <Input
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  placeholder="ex: Equipamentos, Bolas..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>Adicionar</Button>
              </div>
              {checklistItems.length > 0 && (
                <ul className="space-y-1">
                  {checklistItems.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1">{item}</span>
                      <button type="button" onClick={() => setChecklistItems((c) => c.filter((_, i) => i !== idx))}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              <Label>URL do Pavilhão</Label>
              <Input {...register('pavilionUrl')} placeholder="https://maps.google.com/..." />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTravel ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, travel: deleteDialog.travel })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('travel.deleteTitle')}</DialogTitle>
            <DialogDescription>{tr('travel.deleteDesc', { opponent: deleteDialog.travel?.opponent ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, travel: null })}>{tr('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{tr('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
