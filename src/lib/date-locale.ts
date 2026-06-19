import { pt, enUS, es, fr, it } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const LOCALES: Record<string, Locale> = { pt, en: enUS, es, fr, it }

export function getDateLocale(lang: string | null | undefined): Locale {
  return LOCALES[lang ?? 'pt'] ?? pt
}
