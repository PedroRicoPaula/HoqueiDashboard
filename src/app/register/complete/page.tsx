'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useAuthT } from '@/hooks/useAuthT'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

function CompleteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const { t } = useAuthT()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      setStatus('error')
      setError(t('registerComplete.missingSession'))
      return
    }

    fetch('/api/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? t('registerComplete.genericError'))
        setAuth(json.user, json.permissions)
        router.push(json.redirectTo ?? '/')
      })
      .catch((err: Error) => {
        setStatus('error')
        setError(err.message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'error') {
    return (
      <div className="text-center py-4">
        <XCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500 mb-4">{t('registerComplete.errorHelp')}</p>
        <Link href="/login" className="text-sm text-green-600 hover:underline">
          {t('registerComplete.goToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <Loader2 className="h-10 w-10 text-green-600 mx-auto mb-4 animate-spin" />
      <p className="text-sm text-gray-600">{t('registerComplete.loadingMessage')}</p>
    </div>
  )
}

export default function RegisterCompletePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HoqueiManager</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <Suspense fallback={<div className="h-32" />}>
            <CompleteInner />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
