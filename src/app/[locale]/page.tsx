import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Users, Package, MapPin, Brain, Plane, BarChart3, Check, ChevronDown
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/landing/LanguageSwitcher'
import { PricingToggle } from '@/components/landing/PricingToggle'
import { FaqAccordion } from '@/components/landing/FaqAccordion'

export default function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const t = useTranslations()

  const featureIcons = {
    athletes: Users,
    members: Users,
    materials: Package,
    training: Brain,
    travel: Plane,
    finance: BarChart3,
  } as const

  const featureKeys = ['athletes', 'members', 'materials', 'training', 'travel', 'finance'] as const

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-green-700">HoqueiManager</span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('nav.login')}
            </Link>
            <Link
              href="register"
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {t('nav.register')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 text-center bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-700 bg-green-100 px-3 py-1 rounded-full mb-6">
            {t('hero.badge')}
          </span>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6 whitespace-pre-line">
            {t('hero.title')}
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="register"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-green-200"
            >
              {t('hero.cta')}
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">{t('hero.ctaSub')}</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('features.title')}
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key]
              return (
                <div
                  key={key}
                  className="p-6 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    {t(`features.items.${key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t(`features.items.${key}.desc`)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('pricing.title')}
          </h2>
          <p className="text-lg text-gray-500 mb-12">{t('pricing.subtitle')}</p>
          <PricingToggle />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            {t('faq.title')}
          </h2>
          <FaqAccordion />
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-4 bg-green-600 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">{t('hero.cta')}</h2>
          <p className="text-green-100 mb-8">{t('hero.ctaSub')}</p>
          <Link
            href="register"
            className="inline-block bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-50 transition-colors"
          >
            {t('nav.register')}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} HoqueiManager. {t('footer.rights')}</span>
          <div className="flex gap-6">
            {['pt', 'es', 'en', 'fr', 'it'].map((loc) => (
              <Link
                key={loc}
                href={`/${loc}`}
                className="hover:text-white uppercase text-xs font-medium tracking-wide transition-colors"
              >
                {loc}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
