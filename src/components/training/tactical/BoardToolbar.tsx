'use client'

import { useRef, useState, useCallback } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useTacticalStore } from '@/store/tacticalStore'
import { User, Circle, Triangle, Play, Square, Save, Loader2, Video, FileJson, RotateCcw, X } from 'lucide-react'
import type { ElementType } from '@/types/training.types'
import { canvasDrawField, canvasDrawElements, ELEMENT_COLORS } from './HockeyField'
import { cn } from '@/lib/utils'

const playbookSchema = z.object({
  name: z.string().optional(),
  elements: z.array(z.object({
    id: z.string(),
    type: z.enum(['player', 'opponent', 'ball', 'cone']),
    label: z.string().optional(),
  })),
  frames: z.array(z.object({
    frameIndex: z.number().int().min(0),
    positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  })),
})

interface BoardToolbarProps {
  onSave: () => void
  saving: boolean
  canEdit: boolean
}

const TOOLS: { type: ElementType; label: string; icon: React.ElementType }[] = [
  { type: 'player',   label: 'Jogador',    icon: User },
  { type: 'opponent', label: 'Adversário', icon: User },
  { type: 'ball',     label: 'Bola',       icon: Circle },
  { type: 'cone',     label: 'Cone',       icon: Triangle },
]

export function BoardToolbar({ onSave, saving, canEdit }: BoardToolbarProps) {
  const {
    tacticName, elements, frames, isPlaying,
    pendingElementType, setPendingElement,
    startPlayback, stopPlayback, reset,
  } = useTacticalStore()
  const [exportingVideo, setExportingVideo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveJSON = () => {
    const data = { name: tacticName, elements, frames }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tatica-${tacticName.replace(/\s+/g, '-').toLowerCase()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string)
        const result = playbookSchema.safeParse(raw)
        if (result.success) {
          useTacticalStore.getState().loadPlaybook(result.data)
        }
      } catch { /* ignore malformed file */ }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportVideo = useCallback(async () => {
    if (frames.length < 2 || elements.length === 0) return
    if (typeof MediaRecorder === 'undefined') return
    setExportingVideo(true)

    const EXP_W = 1280, EXP_H = 768
    const FRAME_MS = 1200
    const TRANSITION_MS = 900
    const HOLD_MS = FRAME_MS - TRANSITION_MS
    const FPS = 30

    const canvas = document.createElement('canvas')
    canvas.width = EXP_W
    canvas.height = EXP_H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setExportingVideo(false); return }

    if (typeof (canvas as { captureStream?: unknown }).captureStream !== 'function') {
      setExportingVideo(false); return
    }

    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

    const stream = (canvas as { captureStream: (fps: number) => MediaStream }).captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType: mimeType.split(';')[0] })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tatica-${tacticName.replace(/\s+/g, '-').toLowerCase()}.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportingVideo(false)
    }

    recorder.start()

    const renderInterpolated = (
      posA: Record<string, { x: number; y: number }>,
      posB: Record<string, { x: number; y: number }>,
      t: number,
    ) => {
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      const positions: Record<string, { x: number; y: number }> = {}
      elements.forEach(el => {
        const a = posA[el.id], b = posB[el.id]
        if (!a) return
        positions[el.id] = b
          ? { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease }
          : a
      })
      canvasDrawField(ctx, EXP_W, EXP_H)
      canvasDrawElements(ctx, elements, positions, EXP_W, EXP_H)
    }

    const waitFrame = (frameIndex: number): Promise<void> =>
      new Promise(resolve => {
        const frame = frames[frameIndex]
        const nextFrame = frames[frameIndex + 1] ?? null
        const start = performance.now()
        let timer: ReturnType<typeof setTimeout>
        const tick = () => {
          const elapsed = performance.now() - start
          if (!nextFrame || elapsed < HOLD_MS) {
            canvasDrawField(ctx, EXP_W, EXP_H)
            canvasDrawElements(ctx, elements, frame.positions, EXP_W, EXP_H)
          } else {
            renderInterpolated(frame.positions, nextFrame.positions, Math.min((elapsed - HOLD_MS) / TRANSITION_MS, 1))
          }
          if (elapsed < FRAME_MS) { timer = setTimeout(tick, 16) }
          else { resolve() }
          void timer
        }
        tick()
      })

    for (let i = 0; i < frames.length; i++) await waitFrame(i)
    await new Promise(r => setTimeout(r, 1000))
    recorder.stop()
  }, [frames, elements, tacticName])

  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">
        {canEdit && (
          <>
            <span className="text-xs text-gray-400 flex-shrink-0">Adicionar:</span>
            {TOOLS.map(tool => {
              const Icon = tool.icon
              const isActive = pendingElementType === tool.type
              return (
                <button
                  key={tool.type}
                  onClick={() => setPendingElement(isActive ? null : tool.type)}
                  disabled={isPlaying}
                  title={tool.label}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-all flex-shrink-0',
                    isActive
                      ? 'text-gray-950 shadow-md ring-2 ring-white/20'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40',
                  )}
                  style={isActive ? { backgroundColor: ELEMENT_COLORS[tool.type] } : {}}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tool.label}</span>
                </button>
              )
            })}
            <div className="w-px h-5 bg-gray-700 mx-0.5 flex-shrink-0" />
          </>
        )}

        {isPlaying ? (
          <button onClick={stopPlayback}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-red-900/50 text-red-300 hover:bg-red-900/70 flex-shrink-0">
            <Square className="h-3.5 w-3.5" /><span>Parar</span>
          </button>
        ) : (
          <button
            onClick={() => frames.length >= 2 && startPlayback()}
            disabled={frames.length < 2}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Play className="h-3.5 w-3.5" /><span>Reproduzir</span>
          </button>
        )}

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <button onClick={handleSaveJSON}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-green-400 hover:bg-gray-700"
            title="Guardar tática (JSON)">
            <FileJson className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-blue-400 hover:bg-gray-700"
            title="Carregar tática (JSON)">
            <FileJson className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadJSON} />
          <button
            onClick={handleExportVideo}
            disabled={exportingVideo || frames.length < 2 || elements.length === 0 || isPlaying}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-purple-400 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar animação como vídeo">
            {exportingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
            <span>{exportingVideo ? 'A exportar...' : 'Vídeo'}</span>
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => { if (confirm('Limpar o quadro tático?')) reset() }}
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                title="Recomeçar">
                <RotateCcw className="h-4 w-4" />
              </button>
              <Button size="sm" variant="outline"
                className="h-8 text-xs bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Guardar
              </Button>
            </>
          )}
        </div>
      </div>

      {pendingElementType && !isPlaying && (
        <div className="px-3 py-1 bg-primary/10 border-b border-primary/20 flex-shrink-0 flex items-center justify-center gap-2">
          <p className="text-xs text-primary">
            Clica no campo para colocar{' '}
            {pendingElementType === 'player' ? 'um jogador'
              : pendingElementType === 'opponent' ? 'um adversário'
              : pendingElementType === 'ball' ? 'a bola'
              : 'um cone'}
          </p>
          <button onClick={() => setPendingElement(null)} className="text-primary/60 hover:text-primary">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  )
}
