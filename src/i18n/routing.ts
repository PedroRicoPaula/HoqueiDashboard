import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['pt', 'es', 'en', 'fr', 'it'],
  defaultLocale: 'pt',
  localePrefix: 'always',
})
