import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getMessages, getTranslations } from 'next-intl/server'
import { CookieBanner } from '@/components/landing/CookieBanner'
import Script from 'next/script'

const GA_MEASUREMENT_ID = 'G-JZJMM066FR'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hoqueimanager.com'

// og:locale quer o formato completo (pt_PT), não o código curto usado nas rotas.
const OG_LOCALES: Record<string, string> = {
  pt: 'pt_PT', es: 'es_ES', en: 'en_US', fr: 'fr_FR', it: 'it_IT',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'hero' })

  const languages: Record<string, string> = {}
  for (const l of routing.locales) {
    languages[l] = `${APP_URL}/${l}`
  }
  languages['x-default'] = `${APP_URL}/pt`

  const title = `HoqueiManager — ${t('title').replace('\n', ' ')}`
  const description = t('subtitle')
  const url = `${APP_URL}/${locale}`

  return {
    title,
    description,
    alternates: { languages, canonical: url },
    metadataBase: new URL(APP_URL),
    openGraph: {
      title,
      description,
      url,
      siteName: 'HoqueiManager',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'HoqueiManager' }],
      locale: OG_LOCALES[locale] ?? 'pt_PT',
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
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
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      {children}
      <CookieBanner locale={locale} />
    </NextIntlClientProvider>
  )
}
