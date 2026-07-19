'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuthT } from '@/hooks/useAuthT'
import { AuthLanguageSwitcher } from '@/components/auth/AuthLanguageSwitcher'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()
  const { t, locale, setLocale } = useAuthT()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      toast({ title: t('forgotPassword.emailInvalidToast'), variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // A API devolve sempre 200 quando o email existe ou não existe (anti-enumeração) —
      // só 429/500 são falhas reais, e essas não devem mostrar a mensagem de sucesso.
      if (res.ok) {
        setSent(true)
      } else {
        const json = await res.json().catch(() => ({}))
        toast({ title: json.error ?? t('forgotPassword.genericError'), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('forgotPassword.connectionError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">HM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HoqueiManager</h1>
        </div>

        <div className="mb-6">
          <AuthLanguageSwitcher locale={locale} onChange={setLocale} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('forgotPassword.title')}</CardTitle>
            <CardDescription>{t('forgotPassword.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
                <p className="text-sm text-gray-600">{t('forgotPassword.sentMessage')}</p>
                <Link href="/login" className="text-sm text-green-600 hover:underline flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="email">{t('forgotPassword.emailLabel')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@clube.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('forgotPassword.submit')}
                </Button>
                <Link href="/login" className="text-sm text-gray-500 hover:underline flex items-center gap-1 justify-center">
                  <ArrowLeft className="h-3 w-3" /> {t('forgotPassword.backToLogin')}
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
