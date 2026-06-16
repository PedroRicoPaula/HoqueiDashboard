'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Dumbbell, Pencil, Trash2, Loader2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

const trainingSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  date: z.string().min(1, 'Data obrigatória'),
  notes: z.string().optional(),
})
type TrainingForm = z.infer<typeof trainingSchema>

interface Training {
  id: string
  title: string
  date: string
  notes?: string
  playbook?: { id: string } | null
}

export default function TrainingPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; training: Training | null }>({ open: false, training: null })
  const [saving, setSaving] = useState(false)
  const { can } = usePermissions()
  const { toast } = useToast()
  const router = useRouter()

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<TrainingForm>({ resolver: zodResolver(trainingSchema) })

  const fetchTrainings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/training')
    if (res.ok) setTrainings(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchTrainings() }, [fetchTrainings])

  const openCreate = () => {
    setEditingTraining(null)
    reset({ title: '', date: new Date().toISOString().substring(0, 10), notes: '' })
    setDialogOpen(true)
  }

  const openEdit = (t: Training) => {
    setEditingTraining(t)
    reset({ title: t.title, date: t.date.substring(0, 10), notes: t.notes ?? '' })
    setDialogOpen(true)
  }

  const onSubmit = async (data: TrainingForm) => {
    setSaving(true)
    try {
      const url = editingTraining ? `/api/training/${editingTraining.id}` : '/api/training'
      const method = editingTraining ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingTraining ? 'Treino atualizado' : 'Treino criado' })
      setDialogOpen(false)
      if (!editingTraining) {
        router.push(`/training/${json.id}`)
      } else {
        fetchTrainings()
      }
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.training) return
    const res = await fetch(`/api/training/${deleteDialog.training.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Treino eliminado' }); fetchTrainings() }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteDialog({ open: false, training: null })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {can('editTraining') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Novo Treino</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum treino registado</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainings.map((t) => (
            <Card key={t.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <Dumbbell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{t.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(t.date), "d 'de' MMMM 'de' yyyy", { locale: pt })}
                      </p>
                      {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
                      {t.playbook && (
                        <p className="text-xs text-primary mt-1 font-medium">Quadro tático guardado</p>
                      )}
                    </div>
                  </div>
                  {can('editTraining') && (
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDialog({ open: true, training: t })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-3 justify-between text-sm"
                  onClick={() => router.push(`/training/${t.id}`)}
                >
                  Abrir Quadro Tático
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTraining ? 'Editar Treino' : 'Novo Treino'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input {...register('title')} placeholder="ex: Treino Terça-feira" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTraining ? 'Guardar' : 'Criar e Abrir'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, training: deleteDialog.training })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Treino</DialogTitle>
            <DialogDescription>Tem a certeza que quer eliminar {deleteDialog.training?.title}? O quadro tático será perdido.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, training: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
