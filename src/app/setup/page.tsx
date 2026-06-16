'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As palavras-passe não coincidem',
  path: ['confirmPassword'],
})

type Form = z.infer<typeof schema>

export default function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (!data.needsSetup) router.replace('/login')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  const onSubmit = async (data: Form) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao criar conta'); return }
      router.replace('/login?setup=ok')
    } catch {
      setError('Erro de ligação ao servidor')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-white font-bold text-xl">Configuração Inicial</h1>
            <p className="text-gray-400 text-sm mt-1">Cria a conta de administrador do dashboard</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-gray-300">Nome</Label>
            <Input
              {...register('name')}
              placeholder="Nome completo"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-primary"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-gray-300">Email</Label>
            <Input
              {...register('email')}
              type="email"
              placeholder="admin@exemplo.pt"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-primary"
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-gray-300">Palavra-passe</Label>
            <Input
              {...register('password')}
              type="password"
              placeholder="Mínimo 8 caracteres"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-primary"
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-gray-300">Confirmar Palavra-passe</Label>
            <Input
              {...register('confirmPassword')}
              type="password"
              placeholder="Repete a palavra-passe"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-primary"
            />
            {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Conta de Administrador
          </Button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Esta página só aparece uma vez. Após criar a conta, o administrador cria os restantes utilizadores dentro do dashboard.
        </p>
      </div>
    </div>
  )
}
