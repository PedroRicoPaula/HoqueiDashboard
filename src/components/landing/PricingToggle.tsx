'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'

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
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            !yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t('monthly')}
        </button>
        <button
          onClick={() => setYearly(true)}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t('yearly')}
          {yearly && (
            <span className="ml-2 text-xs text-green-700">-17%</span>
          )}
        </button>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border-2 border-green-500 p-8 shadow-lg text-left">
        <div className="mb-6">
          <span className="text-5xl font-extrabold text-gray-900">
            €{yearly ? t('yearlyPrice') : t('monthlyPrice')}
          </span>
          <span className="text-gray-400 ml-1">{yearly ? t('perYear') : t('perMonth')}</span>
          {yearly && (
            <p className="text-sm text-green-600 mt-1">{t('yearlyNote')}</p>
          )}
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-4">{t('includes')}</p>
        <ul className="space-y-3 mb-8">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href={`/${locale}/register`}
          className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors"
        >
          {t('cta')}
        </Link>
        <p className="text-xs text-gray-400 mt-4 text-center">{t('guarantee')}</p>
      </div>
    </div>
  )
}
