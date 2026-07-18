'use client'

import { useState, useEffect, Suspense } from 'react'
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
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Palavra-passe deve ter pelo menos 8 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const { toast } = useToast()
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
          title: 'Erro ao entrar',
          description: json.error || 'Credenciais inválidas',
          variant: 'destructive',
        })
        return
      }

      setAuth(json.user, json.permissions)
      // Super admin → platform, club users → dashboard
      router.push(json.redirectTo ?? '/')
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
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
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
        return
      }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: 'Erro', description: 'Erro de conexão. Tente novamente.', variant: 'destructive' })
    } finally {
      setReactivating(false)
    }
  }

  return (
    <>
      {registered && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          Registo completo! Entre com o email e a palavra-passe que definiu.
        </div>
      )}
      {reactivated && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          Pagamento confirmado! O clube foi reativado — entre com as suas credenciais.
        </div>
      )}
      {upgraded && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center">
          Pagamento confirmado! Entre com as suas credenciais habituais.
        </div>
      )}
      {cancelled && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm text-center">
          A subscrição foi cancelada. Pode reativar quando quiser voltando a entrar.
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
                  <p className="text-red-700">Reative agora pagando a mensalidade para recuperar o acesso.</p>
                  <Button type="button" size="sm" disabled={reactivating} onClick={handleReactivate} className="bg-red-600 hover:bg-red-700">
                    {reactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reativar subscrição
                  </Button>
                </>
              ) : (
                <p className="text-red-700">Contacte o suporte para reativar o acesso.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Introduza as suas credenciais para aceder ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Palavra-passe</Label>
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
              Entrar
            </Button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-green-600 transition-colors">
                Esqueci a palavra-passe
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">HM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HoqueiManager</h1>
          <p className="text-gray-500 mt-1">Gestão para clubes de hóquei em patins</p>
        </div>

        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>

        <div className="text-center mt-6">
          <Link href="/pt" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Página principal
          </Link>
        </div>
      </div>
    </div>
  )
}
