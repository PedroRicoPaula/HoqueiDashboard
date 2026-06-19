'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ArrowLeft } from 'lucide-react'

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-red-600 mb-4">Link inválido ou expirado.</p>
        <Link href="/forgot-password" className="text-sm text-green-600 hover:underline">
          Pedir novo link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({ title: 'Mínimo 8 caracteres', variant: 'destructive' })
      return
    }
    if (password !== confirm) {
      toast({ title: 'As palavras-passe não coincidem', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? 'Erro ao redefinir', variant: 'destructive' })
        return
      }
      toast({ title: 'Palavra-passe redefinida! Pode fazer login.' })
      router.push('/login')
    } catch {
      toast({ title: 'Erro de ligação. Tente novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="password">Nova palavra-passe</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirmar palavra-passe</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repetir palavra-passe"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Redefinir Palavra-passe
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">HM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HoqueiManager</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Palavra-passe</CardTitle>
            <CardDescription>Introduza e confirme a sua nova palavra-passe</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-32" />}>
              <ResetForm />
            </Suspense>
            <Link href="/login" className="text-sm text-gray-500 hover:underline flex items-center gap-1 justify-center mt-4">
              <ArrowLeft className="h-3 w-3" /> Voltar ao login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
