'use client'

import { useParams, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LOCALES = [
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
]

function useLocaleSwitch() {
  const params = useParams()
  const pathname = usePathname()
  const current = (params?.locale as string) ?? 'pt'

  function switchLocale(locale: string) {
    // Replace the locale segment in the current path
    const segments = pathname.split('/').filter(Boolean)
    segments[0] = locale
    window.location.href = '/' + segments.join('/')
  }

  return { current, switchLocale }
}

export function LanguageSwitcher() {
  const { current, switchLocale } = useLocaleSwitch()

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

// Variante compacta para nav mobile — a versão de texto (acima) fica escondida em ecrãs
// pequenos e sem isto o idioma só era descobrível no rodapé, ao fim da página.
export function LanguageSwitcherCompact() {
  const { current, switchLocale } = useLocaleSwitch()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Mudar idioma"
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors px-1.5 py-1"
        >
          <Globe className="w-4 h-4" />
          {current.toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map(({ code, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => switchLocale(code)}
            className={current === code ? 'font-semibold text-green-700' : ''}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
