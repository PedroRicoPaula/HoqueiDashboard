import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getMessages } from 'next-intl/server'
import { CookieBanner } from '@/components/landing/CookieBanner'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hoqueimanager.com'

export async function generateMetadata(): Promise<Metadata> {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) {
    languages[l] = `${APP_URL}/${l}`
  }
  languages['x-default'] = `${APP_URL}/pt`
  return {
    alternates: { languages },
    metadataBase: new URL(APP_URL),
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(routing.locales as readonly string[]).includes(locale)) notFound()
  const messages = await getMessages({ locale })

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <CookieBanner locale={locale} />
    </NextIntlClientProvider>
  )
}
