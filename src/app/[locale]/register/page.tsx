'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Step = 1 | 2

interface ClubForm {
  name: string
  email: string
  country: string
  language: string
}

const COUNTRIES = ['pt', 'es', 'fr', 'it', 'other'] as const
const LANGUAGES = ['pt', 'es', 'en', 'fr', 'it'] as const
const PLANS = ['monthly', 'yearly'] as const

export default function RegisterPage() {
  const t = useTranslations('register')
  const params = useParams()
  const locale = (params?.locale as string) ?? 'pt'

  const [step, setStep] = useState<Step>(1)
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ClubForm>({
    name: '',
    email: '',
    country: locale === 'pt' ? 'pt' : locale === 'es' ? 'es' : locale === 'fr' ? 'fr' : locale === 'it' ? 'it' : 'other',
    language: locale,
  })

  function update(field: keyof ClubForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function validateStep1() {
    if (!form.name.trim()) return t('clubNameRequired')
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return t('emailInvalid')
    return null
  }

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido')
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setError('Erro de ligação. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="text-xl font-bold text-green-700">
          HoqueiManager
        </Link>
        <div className="flex gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'}`}>
            1
          </div>
          <div className="w-8 h-px bg-gray-200 self-center" />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
            2
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* Step 1: Club info */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('step1')}</h1>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('clubName')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="HC Exemplo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="admin@clube.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('country')}</label>
                  <select
                    value={form.country}
                    onChange={e => update('country', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{t(`countries.${c}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                  <select
                    value={form.language}
                    onChange={e => update('language', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l} value={l}>{t(`languages.${l}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  const err = validateStep1()
                  if (err) { setError(err); return }
                  setError(null)
                  setStep(2)
                }}
                className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {t('next')}
              </button>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </>
          )}

          {/* Step 2: Plan selection */}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('step2')}</h1>
              <div className="space-y-3 mb-6">
                {PLANS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                      plan === p
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{t(p)}</span>
                    {p === 'yearly' && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        -17%
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {loading ? t('processing') : t('checkout')}
              </button>
              <button
                onClick={() => { setError(null); setStep(1) }}
                className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
              >
                {t('back')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
