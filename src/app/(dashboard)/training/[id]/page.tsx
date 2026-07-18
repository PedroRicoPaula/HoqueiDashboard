'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TacticalBoard } from '@/components/training/tactical/TacticalBoard'
import { BoardToolbar } from '@/components/training/tactical/BoardToolbar'
import { FrameTimeline } from '@/components/training/tactical/FrameTimeline'
import { useTacticalStore } from '@/store/tacticalStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/authStore'
import { getDateLocale } from '@/lib/date-locale'
import { useDashT } from '@/hooks/useDashT'
import type { PlaybookData } from '@/types/training.types'

interface Training {
  id: string
  title: string
  date: string
  notes?: string
  playbook?: {
    id: string
    frames: PlaybookData
  } | null
}

export default function TrainingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { can } = usePermissions()
  const { toast } = useToast()
  const { loadPlaybook, toPlaybook, reset, setTacticName } = useTacticalStore()

  const [training, setTraining] = useState<Training | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const tr = useDashT()
  const clubLanguage = useAuthStore((s) => s.clubLanguage) ?? 'pt'
  const dateLocale = getDateLocale(clubLanguage)

  const canEdit = can('editTraining')

  const fetchTraining = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/training/${id}`)
      if (res.ok) {
        const data: Training = await res.json()
        setTraining(data)
        if (data.playbook?.frames) {
          const pbData = data.playbook.frames as unknown as PlaybookData
          if (pbData.elements && pbData.frames) {
            loadPlaybook(pbData)
          } else {
            reset()
            setTacticName(data.title)
          }
        } else {
          reset()
          setTacticName(data.title)
        }
      } else {
        toast({ title: tr('common.errorLoad'), variant: 'destructive' })
      }
    } catch {
      toast({ title: tr('common.errorLoad'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, loadPlaybook, reset, setTacticName, toast, tr])

  useEffect(() => {
    fetchTraining()
    return () => { reset() }
  }, [fetchTraining, reset])

  const handleSave = async () => {
    setSaving(true)
    try {
      const playbookData = toPlaybook()
      const res = await fetch(`/api/training/${id}/playbook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playbookData),
      })
      if (res.ok) {
        toast({ title: tr('training.tacticalSaved') })
      } else {
        const json = await res.json().catch(() => ({}))
        // O servidor já diz exatamente o que falhou (ex: limite de 50 elementos/100
        // frames excedido) — mostrar isso em vez de um erro genérico que não ajuda
        // o treinador a perceber o que remover.
        const fieldErrors = json.details?.fieldErrors as Record<string, string[]> | undefined
        const detail = fieldErrors ? Object.values(fieldErrors).flat().join(' ') : undefined
        toast({ title: json.error ?? tr('common.errorSave'), description: detail, variant: 'destructive' })
      }
    } catch {
      // Falha de rede (offline, ligação perdida — plausível num pavilhão) engolia isto
      // em silêncio: o botão voltava ao normal via finally, sem toast nenhum, dando a
      // entender que a jogada tinha sido guardada quando não foi.
      toast({ title: tr('common.errorSave'), description: 'Falha de ligação — a jogada não foi guardada.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  if (!training) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">{tr('common.noData')}</p>
        <Button onClick={() => router.push('/training')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tr('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-300 hover:text-white hover:bg-gray-700 h-8 w-8"
          onClick={() => router.push('/training')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-semibold text-white text-sm">{training.title}</h2>
          <p className="text-xs text-gray-400">
            {format(new Date(training.date), "d MMMM yyyy", { locale: dateLocale })}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <BoardToolbar onSave={handleSave} saving={saving} canEdit={canEdit} />

      {/* Board */}
      <div className="flex-1 overflow-hidden min-h-0">
        <TacticalBoard canEdit={canEdit} />
      </div>

      {/* Timeline */}
      <FrameTimeline canEdit={canEdit} />
    </div>
  )
}
