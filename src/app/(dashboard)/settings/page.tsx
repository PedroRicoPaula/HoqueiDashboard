'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/authStore'
import { useDashT } from '@/hooks/useDashT'
import { Loader2, Settings, Upload, X } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']),
  country: z.string().min(2),
})

type Form = z.infer<typeof schema>

export default function SettingsPage() {
  const { toast } = useToast()
  const t = useDashT()
  const { user, setAuth, permissions } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const LANGUAGES = [
    { value: 'pt', label: 'Português' },
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'it', label: 'Italiano' },
  ]

  const COUNTRIES = [
    { value: 'pt', label: t('countries.pt') },
    { value: 'es', label: t('countries.es') },
    { value: 'fr', label: t('countries.fr') },
    { value: 'it', label: t('countries.it') },
    { value: 'other', label: t('countries.other') },
  ]

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
        setLogoUrl(data.logoUrl ?? null)
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
        toast({ title: t('settings.saved') })
        if (user && permissions) {
          setAuth({
            ...user,
            clubName: data.name,
            clubLanguage: data.language,
            clubLogoUrl: logoUrl,
          }, permissions)
        }
      } else {
        const json = await res.json()
        toast({ title: t('common.error'), description: json.error, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/club/logo', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? t('common.errorSave'), variant: 'destructive' })
        return
      }
      setLogoUrl(json.logoUrl)
      if (user && permissions) {
        setAuth({ ...user, clubLogoUrl: json.logoUrl }, permissions)
      }
      toast({ title: t('settings.saved') })
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoRemove = async () => {
    const res = await fetch('/api/club/logo', { method: 'DELETE' })
    if (res.ok) {
      setLogoUrl(null)
      if (user && permissions) {
        setAuth({ ...user, clubLogoUrl: null }, permissions)
      }
      toast({ title: t('settings.logoRemoved') })
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
    <div className="p-4 sm:p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
      </div>

      {/* Logo card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.logo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Club logo"
                width={64}
                height={64}
                className="rounded-full object-contain border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 border flex items-center justify-center">
                <span className="text-gray-400 text-xl font-bold">
                  {watch('name')?.charAt(0).toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoUploading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Upload className="h-4 w-4 mr-2" />}
                  {t('settings.uploadLogo')}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleLogoRemove}>
                    <X className="h-4 w-4 mr-1" /> {t('settings.removeLogo')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">{t('settings.logoHint')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General info card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>{t('settings.clubName')}</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>{t('settings.country')}</Label>
              <Select value={watch('country')} onValueChange={v => setValue('country', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t('settings.language')}</Label>
              <Select value={watch('language')} onValueChange={v => setValue('language', v as Form['language'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">{t('settings.languageNote')}</p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
