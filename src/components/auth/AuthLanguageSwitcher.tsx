'use client'

const LOCALES = [
  { code: 'pt', label: 'PT' },
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
]

export function AuthLanguageSwitcher({ locale, onChange }: { locale: string; onChange: (locale: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-1">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
            locale === code
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
