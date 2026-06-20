import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  Users, UserCheck, Package, MapPin, Brain, Plane, BarChart3, Check,
  ArrowRight, Shield, Globe, Zap,
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/landing/LanguageSwitcher'
import { PricingToggle } from '@/components/landing/PricingToggle'
import { FaqAccordion } from '@/components/landing/FaqAccordion'
import { ProductScreenshots } from '@/components/landing/ProductScreenshots'

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale })

  const featureIcons = {
    athletes: Users,
    members: UserCheck,
    materials: Package,
    training: Brain,
    travel: Plane,
    finance: BarChart3,
  } as const

  const featureKeys = ['athletes', 'members', 'materials', 'training', 'travel', 'finance'] as const

  const socialIcons = [Shield, Globe, Zap, MapPin]

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
              href={`/${locale}/register`}
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
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-green-200"
            >
              {t('hero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">{t('hero.ctaSub')}</p>
        </div>
      </section>

      {/* Social proof — stats */}
      <section className="py-16 px-4 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm text-gray-400 uppercase tracking-widest mb-8">{t('social.title')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {(['0', '1', '2', '3'] as const).map((i, idx) => {
              const stat = t.raw('social.stats') as Array<{ value: string; label: string }>
              const s = stat[Number(i)]
              const Icon = socialIcons[idx]
              return (
                <div key={i} className="space-y-1">
                  <Icon className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-20 px-4 bg-gray-950 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-400 bg-green-400/10 px-3 py-1 rounded-full mb-4">
              {t('preview.badge') || 'O produto real'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('preview.title') || 'Vê o que vais usar todos os dias'}
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {t('preview.subtitle') || 'Sem demos fabricadas. Estes são ecrãs reais do HoqueiManager.'}
            </p>
          </div>
          <ProductScreenshots
            feesLabel={t('preview.feesTab') || 'Mensalidades'}
            athletesLabel={t('preview.athletesTab') || 'Atletas'}
            feesCaption={t('preview.feesCaption') || 'Controlo total de pagamentos por atleta, mês a mês. Um clique para registar ou editar.'}
            athletesCaption={t('preview.athletesCaption') || 'Todos os atletas num só lugar, com escalão, idade, contactos e acções rápidas.'}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('howItWorks.title')}</h2>
            <p className="text-lg text-gray-500">{t('howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {(['0', '1', '2'] as const).map((i) => {
              const steps = t.raw('howItWorks.steps') as Array<{ step: string; title: string; desc: string }>
              const s = steps[Number(i)]
              return (
                <div key={i} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-lg">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('features.title')}</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t('features.subtitle')}</p>
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
                  <h3 className="font-bold text-gray-900 mb-2">{t(`features.items.${key}.title`)}</h3>
                  <p className="text-sm text-gray-500">{t(`features.items.${key}.desc`)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('pricing.title')}</h2>
          <p className="text-lg text-gray-500 mb-12">{t('pricing.subtitle')}</p>
          <PricingToggle />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">{t('faq.title')}</h2>
          <FaqAccordion />
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-4 bg-green-600 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">{t('cta.title')}</h2>
          <p className="text-green-100 mb-8">{t('cta.subtitle')}</p>
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center gap-2 bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-50 transition-colors"
          >
            {t('cta.button')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span>© {new Date().getFullYear()} HoqueiManager. {t('footer.rights')}</span>
            <div className="flex gap-4">
              <Link href={`/${locale}/privacy`} className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <Link href={`/${locale}/terms`} className="hover:text-white transition-colors">{t('footer.terms')}</Link>
            </div>
          </div>
          <div className="flex gap-6">
            {['pt', 'es', 'en', 'fr', 'it'].map((loc) => (
              <Link
                key={loc}
                href={`/${loc}`}
                className={`hover:text-white uppercase text-xs font-medium tracking-wide transition-colors ${loc === locale ? 'text-white' : ''}`}
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
