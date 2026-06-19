'use client'

import { useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

import pt from '../../messages/dashboard/pt.json'
import en from '../../messages/dashboard/en.json'
import es from '../../messages/dashboard/es.json'
import fr from '../../messages/dashboard/fr.json'
import it from '../../messages/dashboard/it.json'

type DeepRecord = Record<string, unknown>

const DICT: Record<string, DeepRecord> = { pt, en, es, fr, it }

function deepGet(obj: DeepRecord, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function useDashT() {
  const lang = useAuthStore((s) => s.clubLanguage) ?? 'pt'
  const dict = DICT[lang] ?? DICT.pt

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = deepGet(dict as DeepRecord, key) ?? deepGet(DICT.pt as DeepRecord, key) ?? key
      if (!vars) return val
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        val
      )
    },
    [dict]
  )

  return t
}
