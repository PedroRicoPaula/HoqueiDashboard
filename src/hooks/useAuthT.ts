'use client'

import { useCallback, useSyncExternalStore } from 'react'

import pt from '../../messages/auth/pt.json'
import en from '../../messages/auth/en.json'
import es from '../../messages/auth/es.json'
import fr from '../../messages/auth/fr.json'
import it from '../../messages/auth/it.json'

type DeepRecord = Record<string, unknown>

const DICT: Record<string, DeepRecord> = { pt, en, es, fr, it }
const STORAGE_KEY = 'hm-locale'

function deepGet(obj: DeepRecord, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

// Login/forgot-password/reset-password/register-complete não vivem debaixo de [locale]
// (URL fica /login, não /pt/login) — sem locale na rota, o idioma vem do query param
// ?lang= (handoff vindo da landing), depois de localStorage, depois do browser.
// Estado global (não useState local) porque várias páginas montam o hook em componentes
// separados (ex: LoginPage + LoginForm dentro do Suspense) e têm de partilhar o mesmo idioma.
let currentLocale = 'pt'
let initialized = false
const listeners = new Set<() => void>()

function detectLocale(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('lang')
  if (fromQuery && fromQuery in DICT) return fromQuery
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && stored in DICT) return stored
  const nav = navigator.language?.slice(0, 2)
  if (nav && nav in DICT) return nav
  return 'pt'
}

function ensureInitialized() {
  if (initialized) return
  initialized = true
  currentLocale = detectLocale()
  localStorage.setItem(STORAGE_KEY, currentLocale)
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  ensureInitialized()
  return currentLocale
}

function getServerSnapshot() {
  return 'pt'
}

function setLocale(locale: string) {
  currentLocale = locale
  initialized = true
  localStorage.setItem(STORAGE_KEY, locale)
  listeners.forEach((cb) => cb())
}

export function useAuthT() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const dict = DICT[locale] ?? DICT.pt

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

  return { t, locale, setLocale }
}
