import { pt, enUS, es, fr, it } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const LOCALES: Record<string, Locale> = { pt, en: enUS, es, fr, it }

export function getDateLocale(lang: string | null | undefined): Locale {
  return LOCALES[lang ?? 'pt'] ?? pt
}

const NUMBER_LOCALES: Record<string, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
}

export function getNumberLocale(lang: string | null | undefined): string {
  return NUMBER_LOCALES[lang ?? 'pt'] ?? 'pt-PT'
}
