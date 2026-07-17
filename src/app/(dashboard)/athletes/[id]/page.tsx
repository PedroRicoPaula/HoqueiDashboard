'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, differenceInYears } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/hooks/usePermissions'
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, GraduationCap, User, CreditCard,
  Package, Calendar, Shield, Euro, Loader2, Hash, Briefcase, ChevronRight,
  ClipboardCheck, Shirt, Printer, ExternalLink, Percent,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  AGE_GROUPS, AGE_GROUP_LABELS,
  MATERIAL_STATE_LABELS, MATERIAL_STATE_COLORS,
  SEASON_MONTHS, MONTH_LABELS,
  DIRECTION_ROLE_LABELS,
  TEXTILE_TYPE_LABELS, TEXTILE_STATE_COLORS, TEXTILE_STATE_LABELS,
  SESSION_TYPE_LABELS,
} from '@/lib/constants'
import { useDashLabels } from '@/hooks/useDashLabels'
import { useSeasonStore } from '@/store/seasonStore'

const athleteSchema = z.object({
  number: z.coerce.number().int().positive(),
  name: z.string().min(2),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  birthDate: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  nif: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  idCard: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  discountPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  feeExempt: z.boolean().optional().default(false),
})
type AthleteForm = z.infer<typeof athleteSchema>

interface Athlete {
  id: string
  number: number
  name: string
  ageGroup: string
  birthDate: string
  phone?: string
  email?: string
  nif?: string
  address?: string
  school?: string
  idCard?: string
  parentName?: string
  parentPhone?: string
  discountPercent?: number | null
  feeExempt: boolean
  materials: {
    id: string
    name: string
    category: string
    type: string
    state: string
    paidByAthlete: boolean
    paidAmount?: number | null
  }[]
  directionRole?: {
    id: string
    roles: string[]
    trainerAgeGroups: string[]
    sectionistAgeGroups: string[]
    salary?: number | null
  } | null
}

interface AthleteListItem {
  id: string
  number: number
  name: string
  ageGroup: string
}

interface Payment { id: string; month: number; year: number; paid: boolean; amount?: number; paidAt?: string }

interface AttendanceStats {
  total: number
  present: number
  ownTotal: number
  ownPresent: number
  otherTotal: number
  otherPresent: number
  bySeason: { season: string; total: number; present: number; ownTotal: number; ownPresent: number; otherTotal: number; otherPresent: number }[]
  specific: {
    total: number
    attended: number
    paid: number
    totalPaid: number
    sessions: { sessionId: string; date: string; title?: string | null; paidByAthlete: boolean; paidAmount?: number | null }[]
  }
  recent: { sessionId: string; present: boolean; date: string; time?: string; sessionType: string; title?: string; primaryAgeGroup: string }[]
}

interface TextileItem {
  id: string
  type: string
  size: string
  jerseyNumber?: number | null
  season: string
  state: string
  paidByAthlete: boolean
  paidAmount?: number | null
  totalCost?: number | null
  personalized: boolean
}

function getCurrentSeason() {
  const now = new Date()
  const m = now.getMonth() + 1
  return m >= 9 ? now.getFullYear() : now.getFullYear() - 1
}

export default function AthleteProfilePage() {
  const dashLabels = useDashLabels()
  const { getSelectedSeason, getActiveSeason } = useSeasonStore()
  const activeSeason = getActiveSeason()
  const selectedSeason = getSelectedSeason()
  const seasonDefaultFee = (selectedSeason ?? activeSeason)?.defaultAthleteMonthlyFee ?? null
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { can } = usePermissions()
  const { toast } = useToast()

  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null)
  const [textileItems, setTextileItems] = useState<TextileItem[]>([])
  const [attendanceView, setAttendanceView] = useState<'total' | 'season'>('total')
  const [error, setError] = useState<'not_found' | 'unauthorized' | 'server' | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [season, setSeason] = useState(getCurrentSeason())

  // Navigation dropdown state
  const [allAthletes, setAllAthletes] = useState<AthleteListItem[]>([])
  const [navAgeGroup, setNavAgeGroup] = useState('all')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AthleteForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(athleteSchema) as any,
  })
  const ageGroupValue = watch('ageGroup')

  const fetchAthlete = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/athletes/${id}`)
      if (res.ok) {
        setAthlete(await res.json())
      } else if (res.status === 401 || res.status === 403) {
        setError('unauthorized')
      } else if (res.status === 404) {
        setError('not_found')
      } else {
        setError('server')
      }
    } catch {
      setError('server')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchPayments = useCallback(async () => {
    if (!can('viewFees')) return
    const res = await fetch(`/api/athletes/${id}/payments?year=${season}`)
    if (res.ok) setPayments(await res.json())
  }, [id, season, can])

  const fetchAllAthletes = useCallback(async () => {
    const res = await fetch('/api/athletes?all=true')
    if (res.ok) {
      const data = await res.json()
      setAllAthletes(data.athletes ?? data)
    }
  }, [])

  useEffect(() => { fetchAthlete() }, [fetchAthlete])
  useEffect(() => { fetchPayments() }, [fetchPayments])
  useEffect(() => { fetchAllAthletes() }, [fetchAllAthletes])

  useEffect(() => {
    if (!id || !can('viewAttendance')) return
    fetch(`/api/athletes/${id}/attendance`).then((r) => r.json()).then((d) => {
      if (d && typeof d.total === 'number') setAttendanceStats(d)
    })
  }, [id, can])

  useEffect(() => {
    if (!id || !can('viewTextiles')) return
    fetch(`/api/textiles?athleteId=${id}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setTextileItems(d)
    })
  }, [id, can])

  // Set nav age group to match current athlete
  useEffect(() => {
    if (athlete) setNavAgeGroup(athlete.ageGroup)
  }, [athlete])

  const filteredNavAthletes = navAgeGroup === 'all'
    ? allAthletes
    : allAthletes.filter((a) => a.ageGroup === navAgeGroup)

  const openEdit = () => {
    if (!athlete) return
    reset({
      number: athlete.number,
      name: athlete.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ageGroup: athlete.ageGroup as any,
      birthDate: athlete.birthDate.substring(0, 10),
      phone: athlete.phone ?? '',
      email: athlete.email ?? '',
      nif: athlete.nif ?? '',
      address: athlete.address ?? '',
      school: athlete.school ?? '',
      idCard: athlete.idCard ?? '',
      parentName: athlete.parentName ?? '',
      parentPhone: athlete.parentPhone ?? '',
      discountPercent: athlete.discountPercent ?? null,
      feeExempt: athlete.feeExempt ?? false,
    })
    setSheetOpen(true)
  }

  const onSubmit = async (data: AthleteForm) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/athletes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: 'Atleta atualizado' })
      setSheetOpen(false)
      fetchAthlete()
    } finally {
      setSaving(false)
    }
  }

  const getPayment = (month: number) => {
    const year = month >= 9 ? season : season + 1
    return payments.find((p) => p.month === month && p.year === year)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error === 'unauthorized') {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-muted-foreground">Sessão expirada. Por favor volta a fazer login.</p>
        <Button variant="outline" onClick={() => router.push('/login')}>Ir para Login</Button>
      </div>
    )
  }

  if (error || !athlete) {
    return (
      <div className="text-center py-24 space-y-3">
        <p className="text-muted-foreground">Atleta não encontrado.</p>
        <Button variant="outline" onClick={() => router.push('/athletes')}>Voltar à lista</Button>
      </div>
    )
  }

  const age = differenceInYears(new Date(), new Date(athlete.birthDate))
  const isSenior = athlete.ageGroup === 'SENIORS'

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.push('/athletes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">#{athlete.number}</span>
            <h1 className="text-xl font-bold truncate">{athlete.name}</h1>
            <Badge variant="secondary">{AGE_GROUP_LABELS[athlete.ageGroup] ?? athlete.ageGroup}</Badge>
            {athlete.feeExempt && <Badge className="bg-gray-100 text-gray-700">Isento</Badge>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Imprimir</span>
        </Button>
        {can('editAthletes') && (
          <Button size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        )}
      </div>

      {/* Navigation bar */}
      {allAthletes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-white border rounded-lg px-3 py-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">Navegar:</span>
          <Select value={navAgeGroup} onValueChange={setNavAgeGroup}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {AGE_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={id}
            onValueChange={(newId) => {
              if (newId !== id) router.push(`/athletes/${newId}`)
            }}
          >
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue placeholder="Selecionar atleta..." />
            </SelectTrigger>
            <SelectContent>
              {filteredNavAthletes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-1">#{a.number}</span>
                  {a.name}
                </SelectItem>
              ))}
              {filteredNavAthletes.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Sem atletas neste escalão
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info pessoal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Informação Pessoal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Nascimento">
              {format(new Date(athlete.birthDate), 'dd/MM/yyyy')} · {age} anos
            </InfoRow>
            {athlete.nif && <InfoRow icon={<Hash className="h-4 w-4" />} label="NIF">{athlete.nif}</InfoRow>}
            {athlete.idCard && <InfoRow icon={<Shield className="h-4 w-4" />} label="N.º CC/BI">{athlete.idCard}</InfoRow>}
            {athlete.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Morada">{athlete.address}</InfoRow>}
            {!isSenior && athlete.school && (
              <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Escola">{athlete.school}</InfoRow>
            )}
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {athlete.phone
              ? <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone">
                  <a href={`tel:${athlete.phone}`} className="hover:underline text-primary">{athlete.phone}</a>
                </InfoRow>
              : <p className="text-muted-foreground text-xs">Sem telefone</p>}
            {athlete.email
              ? <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
                  <a href={`mailto:${athlete.email}`} className="hover:underline text-primary">{athlete.email}</a>
                </InfoRow>
              : null}

            {!isSenior && (athlete.parentName || athlete.parentPhone) && (
              <>
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Encarregado de Educação</p>
                  {athlete.parentName && (
                    <InfoRow icon={<User className="h-4 w-4" />} label="Nome">{athlete.parentName}</InfoRow>
                  )}
                  {athlete.parentPhone && (
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone">
                      <a href={`tel:${athlete.parentPhone}`} className="hover:underline text-primary">{athlete.parentPhone}</a>
                    </InfoRow>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Mensalidade */}
        {!isSenior && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Mensalidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {athlete.feeExempt ? (
                <Badge className="bg-gray-100 text-gray-700">Isento de pagamento</Badge>
              ) : (
                <>
                  {seasonDefaultFee != null ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Valor da época</span>
                        <span className="font-medium">{seasonDefaultFee.toFixed(2)}€</span>
                      </div>
                      {athlete.discountPercent != null && athlete.discountPercent > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Percent className="h-3.5 w-3.5" />
                            Desconto individual
                          </span>
                          <span className="text-orange-600 font-medium">-{athlete.discountPercent}%</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="font-medium">Valor efetivo</span>
                        <span className="font-bold text-primary">
                          {(seasonDefaultFee * (1 - (athlete.discountPercent ?? 0) / 100)).toFixed(2)}€/mês
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Sem mensalidade de época definida. Configurar em{' '}
                      <a href="/settings" className="text-primary underline">Definições</a>.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estado</span>
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Materiais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Materiais Atribuídos
              {athlete.materials.length > 0 && (
                <Badge variant="secondary" className="ml-1">{athlete.materials.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {athlete.materials.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum material atribuído</p>
            ) : (
              <div className="space-y-2">
                {athlete.materials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{m.type}</span>
                      {m.name && <span className="text-muted-foreground text-xs ml-1.5">{m.name}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.paidByAthlete
                        ? <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {m.paidAmount ? `${m.paidAmount}€` : 'Pago'}
                          </span>
                        : <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">Não pago</span>
                      }
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${MATERIAL_STATE_COLORS[m.state] ?? 'bg-gray-100'}`}>
                        {dashLabels.materialStates[m.state] ?? MATERIAL_STATE_LABELS[m.state] ?? m.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assiduidade + Têxteis */}
      {(can('viewAttendance') || can('viewTextiles')) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assiduidade */}
          {can('viewAttendance') && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Assiduidade
                  </CardTitle>
                  {attendanceStats && attendanceStats.total > 0 && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setAttendanceView('total')}
                        className={`text-xs px-2 py-0.5 rounded-md transition-colors ${attendanceView === 'total' ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Total {attendanceStats.total > 0 ? `— ${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%` : ''}
                      </button>
                      <button
                        onClick={() => setAttendanceView('season')}
                        className={`text-xs px-2 py-0.5 rounded-md transition-colors ${attendanceView === 'season' ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Por época
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!attendanceStats || attendanceStats.total === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem registos de assiduidade</p>
                ) : attendanceView === 'season' ? (
                  // ── BY SEASON VIEW ──
                  <div className="space-y-2">
                    {(attendanceStats.bySeason ?? []).map((s) => {
                      const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0
                      return (
                        <div key={s.season} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{s.season}</span>
                            <span className={`font-bold text-xs ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {s.present}/{s.total} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {s.otherTotal > 0 && (
                            <p className="text-xs text-amber-700">{s.otherPresent} treino(s) noutros escalões</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // ── TOTAL VIEW ──
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Treinos próprios</p>
                        <p className="font-semibold">{attendanceStats.ownPresent}/{attendanceStats.ownTotal}</p>
                      </div>
                      {attendanceStats.otherTotal > 0 && (
                        <div>
                          <p className="text-muted-foreground text-xs">Outros escalões</p>
                          <p className="font-semibold text-amber-700">{attendanceStats.otherPresent}/{attendanceStats.otherTotal}</p>
                        </div>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          Math.round((attendanceStats.present / attendanceStats.total) * 100) >= 80 ? 'bg-green-500' :
                          Math.round((attendanceStats.present / attendanceStats.total) * 100) >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%` }}
                      />
                    </div>
                    {attendanceStats.recent.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs text-muted-foreground font-medium">Últimos treinos</p>
                        {attendanceStats.recent.map((r) => (
                          <div key={r.sessionId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.present ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="text-muted-foreground">{format(new Date(r.date), 'dd/MM')}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.present ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {r.present ? 'Presente' : 'Falta'}
                              </span>
                            </div>
                            <span className="text-muted-foreground">{SESSION_TYPE_LABELS[r.sessionType]}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Specific trainings */}
                    {attendanceStats.specific && attendanceStats.specific.total > 0 && (
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <span>⚡</span> Treinos Específicos
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Realizados</p>
                            <p className="font-semibold">{attendanceStats.specific.attended}/{attendanceStats.specific.total}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pagou</p>
                            <p className="font-semibold text-blue-700">{attendanceStats.specific.paid}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total pago</p>
                            <p className="font-semibold text-blue-700">{attendanceStats.specific.totalPaid.toFixed(2)}€</p>
                          </div>
                        </div>
                        {attendanceStats.specific.sessions.map((s) => (
                          <div key={s.sessionId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{format(new Date(s.date), 'dd/MM')}</span>
                              <span className="text-muted-foreground truncate max-w-[80px]">{s.title || 'Específico'}</span>
                            </div>
                            {s.paidByAthlete ? (
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                                {s.paidAmount ? `${s.paidAmount}€` : 'Pago'}
                              </span>
                            ) : (
                              <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">Não pago</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Materiais Têxteis */}
          {can('viewTextiles') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shirt className="h-4 w-4" />
                  Materiais Têxteis
                  {textileItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{textileItems.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {textileItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum têxtil atribuído</p>
                ) : (
                  <div className="space-y-2">
                    {textileItems.map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-sm gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-sm">{dashLabels.textileTypes[t.type] ?? TEXTILE_TYPE_LABELS[t.type] ?? t.type}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{t.size}</span>
                            {t.jerseyNumber && <span className="text-xs text-muted-foreground">· Nº {t.jerseyNumber}</span>}
                            <span className="text-xs text-muted-foreground">· {t.season}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {t.paidByAthlete ? (
                            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {t.paidAmount ? `${t.paidAmount}€` : 'Pago'}
                            </span>
                          ) : t.paidAmount ? (
                            <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {t.paidAmount}€ clube
                            </span>
                          ) : null}
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${TEXTILE_STATE_COLORS[t.state] ?? 'bg-gray-100'}`}>
                            {dashLabels.textileStates[t.state] ?? TEXTILE_STATE_LABELS[t.state] ?? t.state}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Funções na Direção */}
      {athlete.directionRole && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Funções na Direção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {athlete.directionRole.roles.map((r) => (
                <Badge key={r} className="text-xs">{DIRECTION_ROLE_LABELS[r] ?? r}</Badge>
              ))}
            </div>
            {athlete.directionRole.trainerAgeGroups.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Escalões (Treinador)</p>
                <div className="flex flex-wrap gap-1">
                  {athlete.directionRole.trainerAgeGroups.map((ag) => (
                    <Badge key={ag} variant="secondary" className="text-xs">{AGE_GROUP_LABELS[ag] ?? ag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {athlete.directionRole.sectionistAgeGroups.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Escalões (Seccionista)</p>
                <div className="flex flex-wrap gap-1">
                  {athlete.directionRole.sectionistAgeGroups.map((ag) => (
                    <Badge key={ag} variant="outline" className="text-xs">{AGE_GROUP_LABELS[ag] ?? ag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {athlete.directionRole.salary != null && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <Euro className="h-3.5 w-3.5" />
                {athlete.directionRole.salary.toFixed(2)}€ / mês
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de Pagamentos */}
      {can('viewFees') && !isSenior && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Histórico de Pagamentos
                <Link href="/fees" className="ml-1 text-xs text-primary font-normal flex items-center gap-0.5 hover:underline">
                  <ExternalLink className="h-3 w-3" />Ver Fees
                </Link>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSeason(s => s - 1)} disabled={season <= 2025}>‹</Button>
                <span className="text-sm font-medium">{season}/{season + 1}</span>
                <Button variant="outline" size="sm" onClick={() => setSeason(s => s + 1)} disabled={season >= getCurrentSeason()}>›</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {SEASON_MONTHS.map((m) => {
                const payment = getPayment(m)
                const year = m >= 9 ? season : season + 1
                const isPaid = payment?.paid
                const now = new Date()
                const isLate = !isPaid && (year < now.getFullYear() || (year === now.getFullYear() && m < now.getMonth() + 1))
                return (
                  <div
                    key={m}
                    className={`flex flex-col items-center p-2 rounded-lg border text-center ${
                      isPaid ? 'bg-green-50 border-green-200' :
                      isLate ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-xs font-medium">{dashLabels.monthsShort?.[m] ?? MONTH_LABELS[m]}</span>
                    <span className={`text-sm mt-0.5 ${isPaid ? 'text-green-600' : isLate ? 'text-red-500' : 'text-gray-400'}`}>
                      {isPaid ? '✓' : isLate ? '✗' : '—'}
                    </span>
                    {isPaid && payment?.amount != null && (
                      <span className="text-[10px] text-green-600 mt-0.5">{payment.amount}€</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Pago</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Em falta</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Pendente</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Atleta</SheetTitle>
            <SheetDescription>Altere os dados do atleta</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>N.º Atleta *</Label>
                <Input type="number" {...register('number')} />
                {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Escalão *</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={ageGroupValue} onValueChange={(v) => setValue('ageGroup', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Data de Nascimento *</Label>
              <Input type="date" {...register('birthDate')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Telefone</Label><Input {...register('phone')} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" {...register('email')} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>NIF</Label><Input {...register('nif')} /></div>
              <div className="space-y-1"><Label>N.º CC/BI</Label><Input {...register('idCard')} /></div>
            </div>
            <div className="space-y-1"><Label>Morada</Label><Input {...register('address')} /></div>
            {ageGroupValue !== 'SENIORS' && (
              <div className="space-y-1"><Label>Escola</Label><Input {...register('school')} /></div>
            )}
            {ageGroupValue !== 'SENIORS' && (
              <div className="pt-2 border-t space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Mensalidade</p>
                {seasonDefaultFee != null && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                    <span className="text-blue-800">Mensalidade da época: <strong>{seasonDefaultFee.toFixed(2)}€/mês</strong></span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Desconto individual (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" min="0" max="100" step="1" className="pl-9" placeholder="0" {...register('discountPercent')} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Isento</Label>
                    <div className="flex items-center h-10 gap-3">
                      <Switch checked={watch('feeExempt') ?? false} onCheckedChange={(v) => setValue('feeExempt', v)} />
                      <span className="text-sm text-muted-foreground">{watch('feeExempt') ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {ageGroupValue !== 'SENIORS' && (
              <div className="pt-2 border-t space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Encarregado de Educação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Nome</Label><Input {...register('parentName')} /></div>
                  <div className="space-y-1"><Label>Telefone</Label><Input {...register('parentPhone')} /></div>
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="text-sm break-words">{children}</span>
      </div>
    </div>
  )
}
