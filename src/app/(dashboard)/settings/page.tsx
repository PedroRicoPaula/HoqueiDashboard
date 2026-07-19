'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/authStore'
import { useSeasonStore } from '@/store/seasonStore'
import { useDashT } from '@/hooks/useDashT'
import { useRouter } from 'next/navigation'
import { Loader2, Settings, Upload, X, Euro, CalendarDays, ShieldAlert, FileDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLOR_PRESETS = [
  { label: 'Verde',       hsl: '142 71% 45%', hex: '#16a34a' },
  { label: 'Azul',        hsl: '217 91% 50%', hex: '#1d6dcc' },
  { label: 'Vermelho',    hsl: '0 72% 51%',   hex: '#dc2626' },
  { label: 'Roxo',        hsl: '271 81% 56%', hex: '#9333ea' },
  { label: 'Laranja',     hsl: '21 90% 48%',  hex: '#ea580c' },
  { label: 'Teal',        hsl: '174 72% 32%', hex: '#0d9488' },
  { label: 'Azul Escuro', hsl: '222 89% 36%', hex: '#1e3a8a' },
  { label: 'Rosa',        hsl: '330 81% 48%', hex: '#be185d' },
]

const schema = z.object({
  name:         z.string().min(2),
  language:     z.enum(['pt', 'es', 'en', 'fr', 'it']),
  country:      z.string().min(2),
  primaryColor: z.string(),
})

type Form = z.infer<typeof schema>

interface Season {
  id: string
  name: string
  isActive: boolean
  defaultAthleteMonthlyFee: number | null
  defaultMemberMonthlyQuota: number | null
}

export default function SettingsPage() {
  const { toast } = useToast()
  const t = useDashT()
  const { user, setAuth, permissions } = useAuthStore()
  const { selectedSeasonId } = useSeasonStore()
  const router = useRouter()
  const [loading, setLoading]           = useState(false)
  const [fetching, setFetching]         = useState(true)
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Subscription state
  const [clubMeta, setClubMeta] = useState<{ isFreeClub: boolean; status: string; trialEndsAt: string | null; hasActiveSubscription: boolean } | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [subscribing, setSubscribing] = useState<'monthly' | 'yearly' | null>(null)

  // Season fees state
  const [allSeasons, setAllSeasons]         = useState<Season[]>([])
  const [feeSeasonId, setFeeSeasonId]       = useState<string>('')
  const [athleteFee, setAthleteFee]         = useState('')
  const [memberQuota, setMemberQuota]       = useState('')
  const [feesSaving, setFeesSaving]         = useState(false)
  const [feesLoading, setFeesLoading]       = useState(true)

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
    defaultValues: { name: '', language: 'pt', country: 'pt', primaryColor: '142 71% 45%' },
  })

  const selectedColor = watch('primaryColor')

  // Volta de /api/billing/subscribe com pagamento confirmado — window.location em vez de
  // useSearchParams para não obrigar a página toda a um boundary de Suspense por causa disto.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('upgraded') === '1') {
      toast({ title: 'Pagamento confirmado! O teu plano já está activo.' })
      window.history.replaceState(null, '', '/settings')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load club settings
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setValue('name', data.name ?? '')
        setValue('language', data.language ?? 'pt')
        setValue('country', data.country ?? 'pt')
        setValue('primaryColor', data.primaryColor ?? '142 71% 45%')
        setLogoUrl(data.logoUrl ?? null)
        setClubMeta({
          isFreeClub: !!data.isFreeClub,
          status: data.status ?? 'ACTIVE',
          trialEndsAt: data.trialEndsAt ?? null,
          hasActiveSubscription: !!data.hasActiveSubscription,
        })
      })
      .finally(() => setFetching(false))
  }, [setValue])

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    setSubscribing(plan)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: t('common.error'), description: json.error, variant: 'destructive' })
        return
      }
      window.location.href = json.checkoutUrl
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' })
      setSubscribing(null)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: t('common.error'), description: json.error, variant: 'destructive' })
        return
      }
      useAuthStore.getState().logout()
      router.push('/login?cancelled=1')
    } catch {
      toast({ title: t('common.error'), variant: 'destructive' })
    } finally {
      setCancelling(false)
      setCancelOpen(false)
    }
  }

  // Load seasons for fee configuration
  const loadSeasons = useCallback(async () => {
    setFeesLoading(true)
    try {
      const res = await fetch('/api/seasons')
      if (res.ok) {
        const data: Season[] = await res.json()
        setAllSeasons(data)
        // Default to selected season or active season
        const selected = selectedSeasonId ?? data.find(s => s.isActive)?.id ?? data[0]?.id ?? ''
        setFeeSeasonId(selected)
        const season = data.find(s => s.id === selected)
        if (season) {
          setAthleteFee(season.defaultAthleteMonthlyFee != null ? String(season.defaultAthleteMonthlyFee) : '')
          setMemberQuota(season.defaultMemberMonthlyQuota != null ? String(season.defaultMemberMonthlyQuota) : '')
        }
      }
    } finally {
      setFeesLoading(false)
    }
  }, [selectedSeasonId])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  // When season picker changes, update fee inputs
  const handleFeeSeasonChange = (id: string) => {
    setFeeSeasonId(id)
    const season = allSeasons.find(s => s.id === id)
    if (season) {
      setAthleteFee(season.defaultAthleteMonthlyFee != null ? String(season.defaultAthleteMonthlyFee) : '')
      setMemberQuota(season.defaultMemberMonthlyQuota != null ? String(season.defaultMemberMonthlyQuota) : '')
    }
  }

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
            clubPrimaryColor: data.primaryColor,
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

  const handleSaveFees = async () => {
    if (!feeSeasonId) return
    setFeesSaving(true)
    try {
      const res = await fetch(`/api/seasons/${feeSeasonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultAthleteMonthlyFee:  athleteFee  !== '' ? parseFloat(athleteFee)  : null,
          defaultMemberMonthlyQuota: memberQuota !== '' ? parseFloat(memberQuota) : null,
        }),
      })
      if (res.ok) {
        toast({ title: 'Valores guardados com sucesso' })
        // Update local season list
        const updated: Season = await res.json()
        setAllSeasons(prev => prev.map(s => s.id === updated.id ? { ...s, defaultAthleteMonthlyFee: updated.defaultAthleteMonthlyFee, defaultMemberMonthlyQuota: updated.defaultMemberMonthlyQuota } : s))
      } else {
        const json = await res.json()
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
      }
    } finally {
      setFeesSaving(false)
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
      if (user && permissions) setAuth({ ...user, clubLogoUrl: json.logoUrl }, permissions)
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
      if (user && permissions) setAuth({ ...user, clubLogoUrl: null }, permissions)
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

  const feeSelectedSeason = allSeasons.find(s => s.id === feeSeasonId)

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6 min-h-full">
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
              <Image src={logoUrl} alt="Club logo" width={64} height={64}
                className="rounded-full object-contain border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 border flex items-center justify-center">
                <span className="text-gray-400 text-xl font-bold">
                  {watch('name')?.charAt(0).toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm"
                  disabled={logoUploading} onClick={() => fileInputRef.current?.click()}>
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
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg"
                className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Season Fees card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-gray-500" />
            Mensalidades e Quotas por Época
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Define os valores padrão para todos os atletas e sócios desta época.
            Os atletas podem ter desconto individual sobre o valor definido aqui.
          </p>

          {feesLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar épocas...
            </div>
          ) : allSeasons.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              Sem épocas criadas. Cria uma época em{' '}
              <Link href="/seasons" className="text-primary underline">Épocas</Link> primeiro.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Época
                </Label>
                <Select value={feeSeasonId} onValueChange={handleFeeSeasonChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar época" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSeasons.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.isActive && ' · Ativa'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {feeSelectedSeason?.isActive && (
                  <p className="text-xs text-green-600 font-medium">✓ Esta é a época ativa</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="athleteFee">
                    Mensalidade padrão — Atletas
                    <span className="text-gray-400 font-normal ml-1">(€/mês)</span>
                  </Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="athleteFee"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={athleteFee}
                      onChange={e => setAthleteFee(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Aplicado a todos os atletas desta época (excepto isentos)
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="memberQuota">
                    Quota padrão — Sócios
                    <span className="text-gray-400 font-normal ml-1">(€/mês)</span>
                  </Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="memberQuota"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={memberQuota}
                      onChange={e => setMemberQuota(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Aplicado a todos os sócios desta época
                  </p>
                </div>
              </div>

              <Button onClick={handleSaveFees} disabled={feesSaving || !feeSeasonId}>
                {feesSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Valores
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Color palette card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.colorTheme') || 'Cor do clube'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {t('settings.colorThemeNote') || 'Escolhe a cor principal do teu dashboard.'}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = selectedColor === preset.hsl
              return (
                <button
                  key={preset.hsl}
                  type="button"
                  title={preset.label}
                  onClick={() => setValue('primaryColor', preset.hsl, { shouldDirty: true })}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all',
                    isSelected ? 'border-gray-900 shadow-md scale-105' : 'border-gray-200 hover:border-gray-400'
                  )}
                >
                  <div className="w-10 h-10 rounded-full shadow-sm"
                    style={{ backgroundColor: preset.hex }} />
                  <span className="text-xs text-gray-600 font-medium leading-tight text-center">
                    {preset.label}
                  </span>
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Plan card — trial clubs or paid clubs without an active subscription yet (e.g. self-cancelled and reactivating manually) */}
      {clubMeta && !clubMeta.isFreeClub && !clubMeta.hasActiveSubscription && (() => {
        const trialDaysLeft = clubMeta.trialEndsAt
          ? Math.max(0, Math.ceil((new Date(clubMeta.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : null
        return (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle>Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trialDaysLeft !== null ? (
                <p className="text-sm text-gray-600">
                  {trialDaysLeft > 0
                    ? <>Estás em <strong>teste grátis</strong> — faltam <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'}</strong>. Escolhe um plano antes de acabar para não perderes o acesso.</>
                    : <>O teu teste grátis terminou. Escolhe um plano para continuares a ter acesso.</>}
                </p>
              ) : (
                <p className="text-sm text-gray-600">Escolhe um plano para activar o acesso.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" onClick={() => handleSubscribe('monthly')} disabled={subscribing !== null}>
                  {subscribing === 'monthly' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mensal — €59/mês
                </Button>
                <Button type="button" variant="outline" onClick={() => handleSubscribe('yearly')} disabled={subscribing !== null}>
                  {subscribing === 'yearly' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Anual — €590/ano
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Subscription card — only for clubs with an active paid subscription */}
      {clubMeta && !clubMeta.isFreeClub && clubMeta.hasActiveSubscription && (
        <Card className="border-red-100">
          <CardHeader>
            <CardTitle className="text-red-700">{t('settings.subscription.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              {t('settings.subscription.description')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelOpen(true)}
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700">
              {t('settings.subscription.cancelButton')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={cancelOpen} onOpenChange={(o) => !cancelling && setCancelOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" /> {t('settings.subscription.dialogTitle')}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">{t('settings.subscription.dialogDescription1')}</span>
              <span className="block">{t('settings.subscription.dialogDescription2')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2 text-sm text-amber-800">
            <FileDown className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {t('settings.subscription.exportWarning')}{' '}
              <Link href="/reports" className="underline font-medium">{t('settings.subscription.exportLink')}</Link>
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>{t('settings.subscription.back')}</Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelling}>
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.subscription.cancelButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
