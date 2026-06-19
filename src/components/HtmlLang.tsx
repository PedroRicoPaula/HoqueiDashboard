'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function HtmlLang() {
  const lang = useAuthStore((s) => s.clubLanguage)

  useEffect(() => {
    if (lang) {
      document.documentElement.lang = lang
    }
  }, [lang])

  return null
}
