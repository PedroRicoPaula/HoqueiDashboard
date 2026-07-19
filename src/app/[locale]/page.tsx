import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'
import {
  Users, UserCheck, Package, Brain, Plane, BarChart3,
  ArrowRight, Shield, Globe, Zap, MapPin, CheckCircle2,
  Wallet, Handshake, ClipboardList, CalendarCheck, FileBarChart, ShieldCheck,
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
    fees: Wallet,
    materials: Package,
    sponsors: Handshake,
    travel: Plane,
    direction: ClipboardList,
    training: Brain,
    attendance: CalendarCheck,
    finance: BarChart3,
    reports: FileBarChart,
    admin: ShieldCheck,
  } as const

  const featureKeys = [
    'athletes', 'members', 'fees', 'materials', 'sponsors', 'travel',
    'direction', 'training', 'attendance', 'finance', 'reports', 'admin',
  ] as const

  const socialIcons = [Shield, Globe, Zap, MapPin]

  const steps = t.raw('howItWorks.steps') as Array<{ step: string; title: string; desc: string }>
  const stats = t.raw('social.stats') as Array<{ value: string; label: string }>

  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2.5 shrink-0">
            <Image src="/logoHD.png" alt="HoqueiManager" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-green-700 hidden sm:block">HoqueiManager</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex">
              <LanguageSwitcher />
            </div>
            <Link
              href={`/login?lang=${locale}`}
              className="hidden sm:inline text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
            >
              {t('nav.login')}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
            >
              {t('nav.register')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-4 sm:px-6 text-center bg-gradient-to-b from-green-50 via-green-50/50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-green-700 bg-green-100 px-4 py-1.5 rounded-full mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('hero.badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6 whitespace-pre-line">
            {t('hero.title')}
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={`/${locale}/register`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-green-200 hover:shadow-green-300 hover:-translate-y-0.5"
            >
              {t('hero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href={`/login?lang=${locale}`}
              className="w-full sm:w-auto inline-flex items-center justify-center text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors sm:hidden"
            >
              {t('nav.login')} →
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">{t('hero.ctaSub')}</p>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="py-16 px-4 sm:px-6 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-10">{t('social.title')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y sm:divide-y-0 divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {stats.map((s, idx) => {
              const Icon = socialIcons[idx]
              return (
                <div key={idx} className="flex flex-col items-center py-8 px-4 text-center bg-white hover:bg-green-50/50 transition-colors">
                  <Icon className="w-5 h-5 text-green-500 mb-3" />
                  <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Product preview ── */}
      <section className="py-20 px-4 sm:px-6 bg-gray-950 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-400 bg-green-400/10 px-3 py-1 rounded-full mb-4">
              {t('preview.badge') || 'O produto real'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('preview.title') || 'Vê o que vais usar todos os dias'}
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
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

      {/* ── How it works ── */}
      <section className="py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('howItWorks.title')}</h2>
            <p className="text-lg text-gray-500">{t('howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0">
            {steps.map((s, i) => (
              <div key={i} className="flex sm:flex-col items-start sm:items-center text-left sm:text-center gap-4 sm:gap-0 bg-white sm:bg-transparent rounded-xl sm:rounded-none p-5 sm:p-0 border border-gray-100 sm:border-0">
                {/* number + connector */}
                <div className="flex sm:flex-col items-center sm:mb-5 shrink-0">
                  <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-md shadow-green-200">
                    {s.step}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block h-0 w-24 border-t-2 border-dashed border-green-200 absolute translate-x-full mt-5" />
                  )}
                </div>
                <div className="sm:px-4">
                  <h3 className="font-bold text-gray-900 mb-1 text-base sm:text-lg">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('features.title')}</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t('features.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureKeys.map((key) => {
              const Icon = featureIcons[key]
              return (
                <div
                  key={key}
                  className="group p-6 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-lg hover:shadow-green-50 transition-all duration-200 bg-white"
                >
                  <div className="w-11 h-11 bg-green-50 group-hover:bg-green-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-5 h-5 text-green-700" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{t(`features.items.${key}.title`)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{t(`features.items.${key}.desc`)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('pricing.title')}</h2>
          <p className="text-lg text-gray-500 mb-12">{t('pricing.subtitle')}</p>
          <PricingToggle />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">{t('faq.title')}</h2>
          <FaqAccordion />
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-br from-green-600 to-green-700 text-center relative overflow-hidden">
        {/* decorative rings */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border-2 border-white" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full border-2 border-white" />
        </div>
        <div className="max-w-2xl mx-auto relative">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('cta.title')}</h2>
          <p className="text-green-100 mb-10 text-lg">{t('cta.subtitle')}</p>
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center gap-2 bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            {t('cta.button')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 sm:px-6 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <Link href={`/${locale}`} className="flex items-center gap-2.5">
              <Image src="/logoHD.png" alt="HoqueiManager" width={28} height={28} className="rounded-md opacity-80" />
              <span className="font-bold text-white">HoqueiManager</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href={`/${locale}/privacy`} className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <Link href={`/${locale}/terms`} className="hover:text-white transition-colors">{t('footer.terms')}</Link>
              <Link href={`/login?lang=${locale}`} className="hover:text-white transition-colors">{t('nav.login')}</Link>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                <span>© {new Date().getFullYear()} HoqueiManager. {t('footer.rights')}</span>
                <span className="hidden sm:inline text-white/20">·</span>
                <span>Feito por <a href="https://pedropaula.com/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Pedro Paula</a></span>
              </div>
              {/* Locale switcher */}
              <div className="flex gap-3">
                {['pt', 'es', 'en', 'fr', 'it'].map((loc) => (
                  <Link
                    key={loc}
                    href={`/${loc}`}
                    className={`uppercase text-xs font-medium tracking-wide transition-colors hover:text-white ${loc === locale ? 'text-white' : ''}`}
                  >
                    {loc}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
