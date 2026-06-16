'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Settings } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']),
  country: z.string().min(2),
})

type Form = z.infer<typeof schema>

const LANGUAGES = [
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
]

const COUNTRIES = [
  { value: 'pt', label: 'Portugal' },
  { value: 'es', label: 'Espanha' },
  { value: 'fr', label: 'França' },
  { value: 'it', label: 'Itália' },
  { value: 'other', label: 'Outro' },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', language: 'pt', country: 'pt' },
  })

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setValue('name', data.name ?? '')
        setValue('language', data.language ?? 'pt')
        setValue('country', data.country ?? 'pt')
      })
      .finally(() => setFetching(false))
  }, [setValue])

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast({ title: 'Definições guardadas' })
      } else {
        const json = await res.json()
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900">Definições do clube</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome do clube</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>País</Label>
              <Select
                value={watch('country')}
                onValueChange={v => setValue('country', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Idioma do dashboard</Label>
              <Select
                value={watch('language')}
                onValueChange={v => setValue('language', v as Form['language'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                A mudança de idioma requer novo login para ter efeito completo.
              </p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar definições
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
