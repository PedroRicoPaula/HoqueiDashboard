'use client'

import { useEffect, useRef, useState } from 'react'
import { useSeasonStore } from '@/store/seasonStore'
import { useMounted } from '@/hooks/useMounted'
import { ChevronDown, CalendarDays, Check, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function SeasonSelector() {
  const mounted = useMounted()
  const { seasons: storeSeasons, selectedSeasonId, setSeasons, setSelectedSeason, getSelectedSeason } = useSeasonStore()
  const seasons = mounted ? storeSeasons : []
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load seasons from API on mount
  useEffect(() => {
    fetch('/api/seasons')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setSeasons(data)
      })
      .catch(() => {})
  }, [setSeasons])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = getSelectedSeason()
  const label = selected ? selected.name : (seasons.length === 0 ? 'Sem épocas' : 'Todas as épocas')

  if (seasons.length === 0) {
    return (
      <Link
        href="/seasons"
        className="flex items-center gap-2 px-3 py-2 mx-3 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors border border-white/10 border-dashed"
      >
        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Criar época</span>
      </Link>
    )
  }

  return (
    <div ref={ref} className="relative px-3">
      <button
        data-testid="season-selector"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
          'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10',
          open && 'bg-white/10 text-white'
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-white/50" />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={cn('h-3 w-3 flex-shrink-0 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-xl border border-white/10 bg-[hsl(var(--sidebar-bg))]">
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              onClick={() => { setSelectedSeason(null); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
                selectedSeasonId === null
                  ? 'bg-[hsl(var(--club-primary))] text-[hsl(var(--club-primary-fg))]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="flex-1 truncate">Todas as épocas</span>
              {selectedSeasonId === null && <Check className="h-3 w-3 flex-shrink-0" />}
            </button>
            <div className="border-t border-white/10 my-1" />
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedSeason(s.id); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
                  s.id === selectedSeasonId
                    ? 'bg-[hsl(var(--club-primary))] text-[hsl(var(--club-primary-fg))]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <span className="flex-1 truncate">{s.name}</span>
                {s.isActive && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 leading-none">Ativa</span>
                )}
                {s.id === selectedSeasonId && <Check className="h-3 w-3 flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-white/10 p-1">
            <Link
              href="/seasons"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors"
            >
              <Settings2 className="h-3 w-3" />
              Gerir épocas
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
