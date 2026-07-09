'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Check, Zap } from 'lucide-react'

export function PricingToggle() {
  const t = useTranslations('pricing')
  const params = useParams()
  const locale = (params?.locale as string) ?? 'pt'
  const [yearly, setYearly] = useState(false)

  const features = t.raw('features') as string[]

  return (
    <div>
      {/* Toggle */}
      <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 mb-10">
        <button
          onClick={() => setYearly(false)}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            !yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {t('monthly')}
        </button>
        <button
          onClick={() => setYearly(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {t('yearly')}
          <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">-17%</span>
        </button>
      </div>

      {/* Card */}
      <div className="relative bg-white rounded-2xl border-2 border-green-500 p-8 shadow-xl text-left">
        {/* Popular badge */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
            <Zap className="w-3 h-3" />
            Clube completo
          </span>
        </div>

        <div className="mb-6 pt-2">
          <div className="flex items-end gap-1 mb-1">
            <span className="text-5xl font-extrabold text-gray-900">
              €{yearly ? t('yearlyPrice') : t('monthlyPrice')}
            </span>
            <span className="text-gray-400 pb-2">{yearly ? t('perYear') : t('perMonth')}</span>
          </div>
          {yearly ? (
            <p className="text-sm text-green-600 font-medium">{t('yearlyNote')}</p>
          ) : (
            <p className="text-sm text-gray-400">&nbsp;</p>
          )}
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('includes')}</p>
        <ul className="space-y-3 mb-8">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href={`/${locale}/register`}
          className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-semibold transition-colors shadow-md shadow-green-200 hover:shadow-green-300"
        >
          {t('cta')}
        </Link>
        <p className="text-xs text-gray-400 mt-4 text-center">{t('guarantee')}</p>
      </div>
    </div>
  )
}
