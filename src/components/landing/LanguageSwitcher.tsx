'use client'

import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

const LOCALES = [
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
]

export function LanguageSwitcher() {
  const params = useParams()
  const pathname = usePathname()
  const current = (params?.locale as string) ?? 'pt'

  function switchLocale(locale: string) {
    // Replace the locale segment in the current path
    const segments = pathname.split('/').filter(Boolean)
    segments[0] = locale
    window.location.href = '/' + segments.join('/')
  }

  return (
    <div className="flex items-center gap-1">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
            current === code
              ? 'bg-green-100 text-green-700'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
