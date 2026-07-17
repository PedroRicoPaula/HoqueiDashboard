'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'hm_cookie_consent'

export function CookieBanner({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY)
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-300">
          Utilizamos um cookie técnico estritamente necessário para a autenticação e o Google Analytics para perceber como o site é usado.{' '}
          <Link href={`/${locale}/privacy`} className="underline hover:text-white">
            Política de Privacidade
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Aceitar
        </button>
      </div>
    </div>
  )
}
