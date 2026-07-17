'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function HtmlLang() {
  const lang = useAuthStore((s) => s.clubLanguage)

  // authStore usa persist(skipHydration: true) para evitar mismatch de hidratação
  // (SSR não tem acesso ao localStorage) — hidrata manualmente assim que montamos no cliente.
  useEffect(() => {
    useAuthStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (lang) {
      document.documentElement.lang = lang
    }
  }, [lang])

  return null
}
