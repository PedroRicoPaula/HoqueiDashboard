'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  feesLabel: string
  athletesLabel: string
  feesCaption: string
  athletesCaption: string
}

export function ProductScreenshots({ feesLabel, athletesLabel, feesCaption, athletesCaption }: Props) {
  const [active, setActive] = useState<'fees' | 'athletes'>('fees')

  const tabs = [
    { key: 'fees' as const,     label: feesLabel,     caption: feesCaption,     src: '/screenshots/fees-preview.png' },
    { key: 'athletes' as const, label: athletesLabel, caption: athletesCaption, src: '/screenshots/athletes-preview.png' },
  ]

  const current = tabs.find(t => t.key === active)!

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex justify-center gap-2 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all',
              active === tab.key
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Screenshot */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
        <div className="absolute inset-x-0 top-0 h-8 bg-gray-800 flex items-center px-4 gap-1.5 z-10">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <div className="ml-4 flex-1 bg-gray-700 rounded h-4 max-w-xs" />
        </div>
        <div className="pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={active}
            src={current.src}
            alt={current.label}
            className="w-full h-auto block"
          />
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-gray-400 text-sm mt-4 max-w-xl mx-auto">
        {current.caption}
      </p>
    </div>
  )
}
