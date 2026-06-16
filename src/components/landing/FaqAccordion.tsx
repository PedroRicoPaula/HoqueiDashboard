'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

export function FaqAccordion() {
  const t = useTranslations('faq')
  const items = t.raw('items') as Array<{ q: string; a: string }>
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>{item.q}</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
