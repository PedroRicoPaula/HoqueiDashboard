'use client'

import Image from 'next/image'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, ExternalLink, Upload, X } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useDashT } from '@/hooks/useDashT'
import { useDashLabels } from '@/hooks/useDashLabels'

const SPONSOR_TYPE_BADGE: Record<string, string> = {
  EQUIPMENT_SENIOR:    'bg-blue-100 text-blue-800',
  EQUIPMENT_FORMATION: 'bg-sky-100 text-sky-800',
  NAMING_RIGHTS:       'bg-amber-100 text-amber-800',
  BANNER:              'bg-purple-100 text-purple-800',
  STICKS:              'bg-green-100 text-green-800',
  SHINGUARDS:          'bg-orange-100 text-orange-800',
  OTHER:               'bg-gray-100 text-gray-700',
}

const sponsorFormSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  annualContribution: z.coerce.number().min(0),
  contractStart: z.string().min(1, 'Data obrigatória'),
  contractEnd: z.string().min(1, 'Data obrigatória'),
  notes: z.string().optional(),
})
type SponsorForm = z.infer<typeof sponsorFormSchema>

interface Sponsor {
  id: string
  name: string
  website?: string | null
  phone?: string | null
  email?: string | null
  annualContribution: number
  contractStart: string
  contractEnd: string
  notes?: string | null
  logoUrl?: string | null
  sponsorTypes: string[]
  equipmentZones: number[]
  bannerCount?: number | null
  includesSticks: boolean
  includesShinguards: boolean
}

function ContractBadge({ contractEnd, tr }: { contractEnd: string; tr: (k: string, v?: Record<string,string>) => string }) {
  const days = differenceInDays(new Date(contractEnd), new Date())
  if (days < 0) return <Badge variant="destructive">{tr('sponsors.expired')}</Badge>
  if (days <= 30) return <Badge className="bg-orange-100 text-orange-800">{tr('sponsors.expiresIn', { days: String(days) })}</Badge>
  if (days <= 90) return <Badge className="bg-yellow-100 text-yellow-800">{tr('sponsors.expiresIn', { days: String(days) })}</Badge>
  return <Badge className="bg-green-100 text-green-800">{tr('common.active')}</Badge>
}

function SponsorTypeBadge({ type, label }: { type: string; label: string }) {
  const cls = SPONSOR_TYPE_BADGE[type] ?? 'bg-gray-100 text-gray-700'
  return <Badge className={`text-xs font-medium ${cls}`}>{label}</Badge>
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired'

function getSponsorStatus(contractEnd: string): 'active' | 'expiring' | 'expired' {
  const days = differenceInDays(new Date(contractEnd), new Date())
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'active'
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; sponsor: Sponsor | null }>({ open: false, sponsor: null })
  const [saving, setSaving] = useState(false)

  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedZones, setSelectedZones] = useState<number[]>([])
  const [bannerCount, setBannerCount] = useState('')
  const [includesSticks, setIncludesSticks] = useState(false)
  const [includesShinguards, setIncludesShinguards] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { can } = usePermissions()
  const { toast } = useToast()
  const tr = useDashT()
  const { sponsorTypes: sponsorTypeLabels } = useDashLabels()

  const SPONSOR_TYPES = Object.entries(sponsorTypeLabels)
    .filter(([k]) => k !== 'all')
    .map(([value, label]) => ({ value, label }))

  const ZONE_LABELS: Record<number, string> = {
    1: tr('sponsors.zoneShoulderLeft'),
    2: tr('sponsors.zoneShoulderRight'),
    3: tr('sponsors.zoneChest'),
    4: tr('sponsors.zoneShorts'),
    5: tr('sponsors.zoneBackLower'),
    6: tr('sponsors.zoneBackShorts'),
  }

  const {
    register, handleSubmit, reset, formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<SponsorForm>({ resolver: zodResolver(sponsorFormSchema) as any })

  const fetchSponsors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sponsors')
      if (res.ok) setSponsors(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSponsors() }, [fetchSponsors])

  const resetExtras = () => {
    setSelectedTypes([])
    setSelectedZones([])
    setBannerCount('')
    setIncludesSticks(false)
    setIncludesShinguards(false)
    setLogoUrl(null)
  }

  const openCreate = () => {
    setEditingSponsor(null)
    reset({ name: '', website: '', phone: '', email: '', annualContribution: 0, contractStart: '', contractEnd: '', notes: '' })
    resetExtras()
    setSheetOpen(true)
  }

  const openEdit = (s: Sponsor) => {
    setEditingSponsor(s)
    reset({
      name: s.name, website: s.website ?? '', phone: s.phone ?? '', email: s.email ?? '',
      annualContribution: s.annualContribution,
      contractStart: s.contractStart?.substring(0, 10) ?? '',
      contractEnd: s.contractEnd?.substring(0, 10) ?? '',
      notes: s.notes ?? '',
    })
    setSelectedTypes(s.sponsorTypes ?? [])
    setSelectedZones(s.equipmentZones ?? [])
    setBannerCount(s.bannerCount != null ? String(s.bannerCount) : '')
    setIncludesSticks(s.includesSticks ?? false)
    setIncludesShinguards(s.includesShinguards ?? false)
    setLogoUrl(s.logoUrl ?? null)
    setSheetOpen(true)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok) {
        setLogoUrl(json.url)
      } else {
        toast({ title: 'Erro no upload', description: json.error, variant: 'destructive' })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleType = (type: string) =>
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type])

  const toggleZone = (zone: number) =>
    setSelectedZones((prev) => prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone])

  const onSubmit = async (data: SponsorForm) => {
    setSaving(true)
    try {
      const body = {
        ...data,
        logoUrl,
        sponsorTypes: selectedTypes,
        equipmentZones: selectedZones,
        bannerCount: bannerCount !== '' ? parseInt(bannerCount) : null,
        includesSticks,
        includesShinguards,
      }
      const url = editingSponsor ? `/api/sponsors/${editingSponsor.id}` : '/api/sponsors'
      const method = editingSponsor ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast({ title: tr('common.error'), description: json.error, variant: 'destructive' }); return }
      toast({ title: editingSponsor ? tr('sponsors.saved') : tr('sponsors.created') })
      setSheetOpen(false)
      fetchSponsors()
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteDialog.sponsor) return
    const res = await fetch(`/api/sponsors/${deleteDialog.sponsor.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: tr('sponsors.deleted') }); fetchSponsors() }
    else toast({ title: tr('common.errorDelete'), variant: 'destructive' })
    setDeleteDialog({ open: false, sponsor: null })
  }

  const activeSponsors = sponsors.filter((s) => getSponsorStatus(s.contractEnd) !== 'expired')
  const activeTotal = activeSponsors.reduce((sum, s) => sum + s.annualContribution, 0)
  const namingRightsCount = activeSponsors.filter((s) => s.sponsorTypes?.includes('NAMING_RIGHTS')).length
  const bannerTotalCount = activeSponsors.reduce((sum, s) => sum + (s.bannerCount ?? 0), 0)

  const filteredSponsors = sponsors.filter((s) => {
    const statusOk = statusFilter === 'all' || getSponsorStatus(s.contractEnd) === statusFilter
    const typeOk = typeFilter === 'all' || s.sponsorTypes?.includes(typeFilter)
    return statusOk && typeOk
  })

  const showEquipmentZones = selectedTypes.some((t) => t === 'EQUIPMENT_SENIOR' || t === 'EQUIPMENT_FORMATION')
  const showBannerCount = selectedTypes.includes('BANNER')

  return (
    <div className="space-y-4">
      {/* Stats */}
      {!loading && sponsors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: tr('sponsors.activeCount'), value: activeSponsors.length.toString() },
            { label: tr('sponsors.annualRevenue'), value: `${activeTotal.toLocaleString('pt-PT')} €` },
            { label: tr('sponsors.namingRights'), value: namingRightsCount.toString() },
            { label: tr('sponsors.banners'), value: bannerTotalCount.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border rounded-lg p-3 text-center shadow-sm">
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'expiring', 'expired'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-400'
              }`}
            >
              {s === 'all' ? tr('common.all') : s === 'active' ? tr('sponsors.statusActive') : s === 'expiring' ? tr('sponsors.expiring') : tr('sponsors.statusExpired')}
            </button>
          ))}
          <span className="text-gray-200 self-center select-none">|</span>
          {[{ value: 'all', label: sponsorTypeLabels.all ?? tr('sponsorTypes.all') }, ...SPONSOR_TYPES].map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                typeFilter === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-muted-foreground border-gray-200 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {can('manageSponsors') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{tr('sponsors.new')}</Button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      ) : filteredSponsors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {sponsors.length === 0
            ? <div className="flex flex-col items-center gap-2">
                <p>{tr('sponsors.noSponsors')}</p>
                {can('manageSponsors') && (
                  <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{tr('sponsors.new')}</Button>
                )}
              </div>
            : tr('sponsors.noCategory')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSponsors.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Logo */}
                <div className="relative h-24 bg-gray-50 border-b flex items-center justify-center px-4">
                  {s.logoUrl ? (
                    <Image src={s.logoUrl} alt={s.name} width={160} height={64} className="max-h-16 max-w-full object-contain" unoptimized />
                  ) : (
                    <span className="text-3xl font-black text-gray-200">{s.name.charAt(0).toUpperCase()}</span>
                  )}
                  {can('manageSponsors') && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/80 hover:bg-white" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/80 hover:bg-white text-destructive" onClick={() => setDeleteDialog({ open: true, sponsor: s })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2.5">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.annualContribution.toLocaleString('pt-PT')} €/ano</p>
                  </div>

                  {s.sponsorTypes?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.sponsorTypes.map((t) => <SponsorTypeBadge key={t} type={t} label={sponsorTypeLabels[t] ?? t} />)}
                    </div>
                  )}

                  {s.equipmentZones?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Zonas: {[...s.equipmentZones].sort((a, b) => a - b).map((z) => ZONE_LABELS[z]).join(' · ')}
                    </p>
                  )}

                  {(s.bannerCount != null && s.bannerCount > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {s.bannerCount} {tr('sponsors.bannersLabel')}
                    </p>
                  )}

                  {(s.includesSticks || s.includesShinguards) && (
                    <p className="text-xs text-muted-foreground">
                      {[s.includesSticks && tr('sponsors.sticksLabel'), s.includesShinguards && tr('sponsors.shinguardsLabel')].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-0.5">
                    <ContractBadge contractEnd={s.contractEnd} tr={tr} />
                    <span className="text-xs text-muted-foreground">
                      até {format(new Date(s.contractEnd), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      {s.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSponsor ? tr('sponsors.editTitle') : tr('sponsors.new')}</SheetTitle>
            <SheetDescription>{tr('sponsors.formDesc')}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">

            {/* Logo upload */}
            <div className="space-y-2">
              <Label>{tr('sponsors.logo')}</Label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-14 border rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                  {logoUrl ? (
                    <Image src={logoUrl} alt="Logo" width={80} height={56} className="max-h-full max-w-full object-contain p-1" unoptimized />
                  ) : (
                    <Upload className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    {uploading ? tr('common.uploading') : tr('common.upload')}
                  </Button>
                  {logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tr('common.name')} *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>{tr('sponsors.website')}</Label>
              <Input {...register('website')} placeholder="https://..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('common.phone')}</Label>
                <Input {...register('phone')} />
              </div>
              <div className="space-y-1">
                <Label>{tr('common.email')}</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tr('sponsors.annualContribution')}</Label>
              <Input type="number" step="0.01" {...register('annualContribution')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('sponsors.contractStart')} *</Label>
                <Input type="date" {...register('contractStart')} />
                {errors.contractStart && <p className="text-xs text-destructive">{errors.contractStart.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>{tr('sponsors.contractEnd')} *</Label>
                <Input type="date" {...register('contractEnd')} />
                {errors.contractEnd && <p className="text-xs text-destructive">{errors.contractEnd.message}</p>}
              </div>
            </div>

            {/* Tipos de patrocínio */}
            <div className="space-y-2">
              <Label>{tr('sponsors.sponsorTypes')}</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {SPONSOR_TYPES.map((t) => (
                  <div
                    key={t.value}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors select-none ${
                      selectedTypes.includes(t.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleType(t.value)}
                  >
                    <Checkbox checked={selectedTypes.includes(t.value)} />
                    <span className="text-sm">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zonas de equipamento */}
            {showEquipmentZones && (
              <div className="space-y-2">
                <Label>{tr('sponsors.equipmentZones')}</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([1, 2, 3, 4, 5, 6] as const).map((zone) => (
                    <div
                      key={zone}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors select-none ${
                        selectedZones.includes(zone)
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleZone(zone)}
                    >
                      <Checkbox checked={selectedZones.includes(zone)} />
                      <span className="text-xs">
                        <span className="font-semibold">{tr('sponsors.zone')} {zone}</span> — {ZONE_LABELS[zone]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nº de lonas */}
            {showBannerCount && (
              <div className="space-y-1">
                <Label>{tr('sponsors.bannerCount')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={bannerCount}
                  onChange={(e) => setBannerCount(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            {/* Sticks + Caneleiras */}
            <div className="flex flex-wrap gap-4">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setIncludesSticks((v) => !v)}
              >
                <Checkbox checked={includesSticks} />
                <Label className="cursor-pointer font-normal text-sm">{tr('sponsors.sticksLabel')}</Label>
              </div>
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setIncludesShinguards((v) => !v)}
              >
                <Checkbox checked={includesShinguards} />
                <Label className="cursor-pointer font-normal text-sm">{tr('sponsors.shinguardsLabel')}</Label>
              </div>
            </div>

            <div className="space-y-1">
              <Label>{tr('common.notes')}</Label>
              <Input {...register('notes')} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                {tr('common.cancel')}
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSponsor ? tr('common.save') : tr('common.create')}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, sponsor: deleteDialog.sponsor })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('sponsors.deleteTitle')}</DialogTitle>
            <DialogDescription>{tr('sponsors.deleteDesc', { name: deleteDialog.sponsor?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, sponsor: null })}>{tr('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{tr('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
