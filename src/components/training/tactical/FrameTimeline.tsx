'use client'

import { Button } from '@/components/ui/button'
import { useTacticalStore } from '@/store/tacticalStore'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FrameTimelineProps {
  canEdit: boolean
}

export function FrameTimeline({ canEdit }: FrameTimelineProps) {
  const { frames, currentFrameIndex, isPlaying, playbackFrameIndex, goToFrame, addFrame, removeFrame } = useTacticalStore()
  const activeIndex = isPlaying ? playbackFrameIndex : currentFrameIndex

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border-t border-gray-700 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-gray-400 flex-shrink-0">Frames:</span>
      {frames.map((_, idx) => (
        <div key={idx} className="flex items-center gap-0.5 flex-shrink-0 group">
          <button
            onClick={() => !isPlaying && goToFrame(idx)}
            disabled={isPlaying}
            className={cn(
              'w-8 h-8 rounded text-xs font-semibold transition-all',
              activeIndex === idx
                ? 'bg-primary text-gray-950 shadow-md'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white',
              'disabled:cursor-not-allowed',
            )}
          >{idx + 1}</button>
          {canEdit && !isPlaying && frames.length > 1 && (
            <button
              onClick={() => removeFrame(idx)}
              className="w-4 h-4 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex items-center justify-center"
              title="Remover frame"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
      {canEdit && !isPlaying && (
        <Button
          size="icon"
          variant="ghost"
          className="flex-shrink-0 w-8 h-8 text-gray-400 hover:text-white hover:bg-gray-700"
          onClick={addFrame}
          title="Adicionar frame"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
      <span className="ml-auto text-xs text-gray-600 flex-shrink-0">
        {frames[0] ? Object.keys(frames[0].positions).length : 0}el · {frames.length}fr
      </span>
    </div>
  )
}
