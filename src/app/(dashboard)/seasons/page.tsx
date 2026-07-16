'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useSeasonStore } from '@/store/seasonStore'
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Loader2, CalendarRange, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const seasonSchema = z.object({
  name:      z.string().min(3, 'Nome obrigatório (ex: 2025/2026)'),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate:   z.string().min(1, 'Data de fim obrigatória'),
})
type SeasonForm = z.infer<typeof seasonSchema>

interface Season {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
  _count: { members: number; sponsors: number }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function SeasonsPage() {
  const { isAdmin } = usePermissions()
  const { toast } = useToast()
  const { setSeasons } = useSeasonStore()

  const [seasons, setLocal] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<Season | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<SeasonForm>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { name: '', startDate: '', endDate: '' },
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/seasons')
      if (r.ok) {
        const data = await r.json()
        setLocal(data)
        setSeasons(data)
      }
    } finally {
      setLoading(false)
    }
  }, [setSeasons])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingSeason(null)
    form.reset({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (s: Season) => {
    setEditingSeason(s)
    form.reset({
      name: s.name,
      startDate: s.startDate.split('T')[0],
      endDate: s.endDate.split('T')[0],
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (data: SeasonForm) => {
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      form.setError('endDate', { message: 'Data de fim deve ser posterior à data de início' })
      return
    }
    setSubmitting(true)
    try {
      const url = editingSeason ? `/api/seasons/${editingSeason.id}` : '/api/seasons'
      const method = editingSeason ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await r.json()
      if (!r.ok) { toast({ title: json.error ?? 'Erro', variant: 'destructive' }); return }
      toast({ title: editingSeason ? 'Época atualizada' : 'Época criada' })
      setDialogOpen(false)
      load()
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async (s: Season) => {
    setActivating(s.id)
    try {
      const r = await fetch(`/api/seasons/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      })
      if (r.ok) { toast({ title: `Época "${s.name}" definida como ativa` }); load() }
      else { const j = await r.json(); toast({ title: j.error ?? 'Erro', variant: 'destructive' }) }
    } finally {
      setActivating(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/seasons/${deleteDialog.id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) { toast({ title: j.error ?? 'Erro', variant: 'destructive' }); return }
      toast({ title: `Época "${deleteDialog.name}" eliminada` })
      setDeleteDialog(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Épocas Desportivas</h1>
            <p className="text-sm text-muted-foreground">Gerir as épocas do clube (ex: 2025/2026)</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Época
          </Button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-6">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          A <strong>época ativa</strong> é usada por defeito no dashboard e nos formulários de criação de sócios, patrocinadores e pagamentos.
          Podes mudar a época visualizada a qualquer momento no seletor da barra lateral.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : seasons.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <CalendarRange className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Nenhuma época criada</p>
          <p className="text-sm text-muted-foreground/70 mb-4">Cria a primeira época para começar a organizar os dados por ano desportivo</p>
          {isAdmin && (
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira época
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                s.isActive
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
              )}
            >
              {/* Active indicator */}
              <div className="flex-shrink-0">
                {s.isActive
                  ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                  : <Circle className="h-5 w-5 text-muted-foreground/30" />}
              </div>

              {/* Season info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {s.isActive && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                      Ativa
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDate(s.startDate)} → {formatDate(s.endDate)}
                </p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-muted-foreground/70">{s._count.members} sócio(s)</span>
                  <span className="text-xs text-muted-foreground/70">{s._count.sponsors} patrocinador(es)</span>
                </div>
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!s.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(s)}
                      disabled={activating === s.id}
                      className="text-xs h-8"
                    >
                      {activating === s.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : 'Definir como ativa'}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog(s)}
                    disabled={s.isActive}
                    title={s.isActive ? 'Não podes eliminar a época ativa' : 'Eliminar'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSeason ? 'Editar Época' : 'Nova Época'}</DialogTitle>
            <DialogDescription>
              Define o nome e as datas de início e fim da época desportiva.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label>Nome da época</Label>
              <Input
                {...form.register('name')}
                placeholder="2025/2026"
                className="mt-1"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" {...form.register('startDate')} className="mt-1" />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" {...form.register('endDate')} className="mt-1" />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.endDate.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSeason ? 'Guardar' : 'Criar Época'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar época</DialogTitle>
            <DialogDescription>
              Tens a certeza que queres eliminar a época <strong>{deleteDialog?.name}</strong>?
              Esta ação não pode ser revertida. Só é possível eliminar épocas sem registos associados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
