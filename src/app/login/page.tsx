'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/hooks/use-toast'
import { useAuthT } from '@/hooks/useAuthT'
import { AuthLanguageSwitcher } from '@/components/auth/AuthLanguageSwitcher'
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react'

type LoginForm = { email: string; password: string }

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const { toast } = useToast()
  const { t } = useAuthT()
  const [loading, setLoading] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [suspended, setSuspended] = useState<{ message: string; email: string; canReactivate: boolean } | null>(null)
  const registered = searchParams.get('registered') === '1'
  const reactivated = searchParams.get('reactivated') === '1'
  const upgraded = searchParams.get('upgraded') === '1'
  const cancelled = searchParams.get('cancelled') === '1'

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => { if (data.needsSetup) router.replace('/setup') })
      .catch(() => {})
  }, [router])

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t('login.emailInvalid')),
    password: z.string().min(8, t('login.passwordTooShort')),
  }), [t])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setSuspended(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 403 && json.status) {
          setSuspended({ message: json.error, email: data.email, canReactivate: !!json.canReactivate })
          return
        }
        toast({
          title: t('login.errorTitle'),
          description: json.error || t('login.credentialsInvalid'),
          variant: 'destructive',
        })
        return
      }

      setAuth(json.user, json.permissions)
      // Super admin → platform, club users → dashboard
      router.push(json.redirectTo ?? '/')
    } catch {
      toast({
        title: t('login.errorGeneric'),
        description: t('login.errorConnection'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!suspended) return
    setReactivating(true)
    try {
      const res = await fetch('/api/billing/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: suspended.email }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: t('login.errorGeneric'), description: json.error, variant: 'destructive' })
        return
      }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: t('login.errorGeneric'), description: t('login.errorConnection'), variant: 'destructive' })
    } finally {
      setReactivating(false)
    }
  }

  return (
    <>
      {registered && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          {t('login.registeredBanner')}
        </div>
      )}
      {reactivated && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          {t('login.reactivatedBanner')}
        </div>
      )}
      {upgraded && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          {t('login.upgradedBanner')}
        </div>
      )}
      {cancelled && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm text-center">
          {t('login.cancelledBanner')}
        </div>
      )}

      {suspended && (
        <div className="mb-4 px-4 py-4 rounded-lg bg-red-50 border border-red-200 text-sm">
          <div className="flex gap-2.5 text-red-800">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-3 w-full">
              <p className="font-medium">{suspended.message}</p>
              {suspended.canReactivate ? (
                <>
                  <p className="text-red-700">{t('login.suspendedCanReactivate')}</p>
                  <Button type="button" size="sm" disabled={reactivating} onClick={handleReactivate} className="bg-red-600 hover:bg-red-700">
                    {reactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('login.reactivateButton')}
                  </Button>
                </>
              ) : (
                <p className="text-red-700">{t('login.suspendedNoReactivate')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">{t('login.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@clube.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">{t('login.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('login.submit')}
            </Button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-green-600 transition-colors">
                {t('login.forgotLink')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default function LoginPage() {
  const { t, locale, setLocale } = useAuthT()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">HM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HoqueiManager</h1>
          <p className="text-gray-500 mt-1">{t('login.tagline')}</p>
        </div>

        <div className="mb-6">
          <AuthLanguageSwitcher locale={locale} onChange={setLocale} />
        </div>

        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>

        <div className="text-center mt-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('login.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
