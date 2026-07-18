'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { format, getDaysInMonth, getDay, startOfMonth, addMonths, subMonths, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Pencil, Trash2, Loader2, CheckSquare, Users, ChevronLeft, ChevronRight, ChevronDown,
  XCircle, Calendar, BarChart2, Clock, MapPin,
} from 'lucide-react'
import {
  AGE_GROUPS, AGE_GROUP_LABELS,
  AGE_GROUP_CALENDAR_COLORS,
} from '@/lib/constants'
import { useDashLabels } from '@/hooks/useDashLabels'

// isSameDay(new Date(s.date), date) sozinho compara errado: s.date vem como meia-noite UTC
// do servidor, mas `date` (dia da célula do calendário) é construído em hora local
// (new Date(year, month, d)). Num fuso UTC negativo (ex: Açores), new Date(s.date) em hora
// local cai no dia anterior — mesmo padrão já corrigido em Viagens (getTravelDateTime).
// Lê os componentes UTC e reconstrói como data local, para comparar sempre "dia contra dia".
function sessionDateOnly(dateIso: string): Date {
  const d = new Date(dateIso)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  season: string
  seasonStart?: string | null
  ageGroup: string
  dayOfWeek: number
  startTime: string
  endTime?: string | null
  location?: string | null
  sessionType: string
  active: boolean
}

interface Session {
  id: string
  date: string
  time?: string
  primaryAgeGroup: string
  sessionType: string
  title?: string
  notes?: string
  cancelled: boolean
  cancellationReason?: string | null
  scheduleId?: string | null
  totalRecords: number
  presentCount: number
}

interface AthleteRecord {
  id: string
  sessionId: string
  athleteId: string
  present: boolean
  notes?: string
  paidByAthlete: boolean
  paidAmount?: number | null
  athlete: { id: string; name: string; number: number; ageGroup: string }
}

interface AthleteStat {
  id: string; name: string; number: number; ageGroup: string
  ownSessions: number; ownPresent: number
  otherSessions: number; otherPresent: number
  total: number; totalPresent: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SESSION_TYPES = [
  { value: 'GENERAL', label: 'Geral' },
  { value: 'GOALKEEPERS', label: 'Guarda-Redes' },
  { value: 'FIELD_PLAYERS', label: 'Jogadores de Campo' },
  { value: 'SPECIFIC', label: 'Específico' },
]

const MIN_SEASON_YEAR = 2025

function getCurrentSeason() {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 9 ? `${y}/${String(y + 1).slice(-2)}` : `${y - 1}/${String(y).slice(-2)}`
}

function seasonToYear(season: string): number { return parseInt(season.split('/')[0]) }
function yearToSeason(year: number): string { return `${year}/${String(year + 1).slice(-2)}` }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const dashLabels = useDashLabels()
  const ageGroupLabel = (v: string) => dashLabels.ageGroups[v] ?? AGE_GROUP_LABELS[v] ?? v

  const { can } = usePermissions()
  const { toast } = useToast()

  // ── Tab / view state ──────────────────────────────────────────────────────

  const [tab, setTab] = useState<'calendar' | 'schedules' | 'stats'>('calendar')

  // ── Schedules data ────────────────────────────────────────────────────────

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [scheduleSeason, setScheduleSeason] = useState(getCurrentSeason())
  const [scheduleSheet, setScheduleSheet] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    season: getCurrentSeason(), seasonStart: '', ageGroup: 'SUB15',
    dayOfWeek: 1, startTime: '19:00', endTime: '', location: '', sessionType: 'GENERAL', active: true,
  })
  const [deleteScheduleDialog, setDeleteScheduleDialog] = useState<{ open: boolean; schedule: Schedule | null }>({ open: false, schedule: null })
  const [copyingSeaon, setCopyingSeason] = useState(false)

  // Season navigation helpers
  const prevScheduleSeason = () => {
    const y = seasonToYear(scheduleSeason)
    if (y > MIN_SEASON_YEAR) setScheduleSeason(yearToSeason(y - 1))
  }
  const nextScheduleSeason = () => setScheduleSeason(yearToSeason(seasonToYear(scheduleSeason) + 1))
  const canGoPrevSeason = seasonToYear(scheduleSeason) > MIN_SEASON_YEAR

  // Age groups already covered for this season
  const usedAgeGroups = new Set(schedules.map((s) => s.ageGroup))
  const availableAgeGroups = AGE_GROUPS.filter((g) => !usedAgeGroups.has(g.value))
  const allAgeGroupsFilled = availableAgeGroups.length === 0

  // ── Calendar state ────────────────────────────────────────────────────────

  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [calendarAgeGroup, setCalendarAgeGroup] = useState('all')
  const [sessions, setSessions] = useState<Session[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  // ── Session modal (from calendar cell click) ──────────────────────────────

  const [sessionModal, setSessionModal] = useState<{
    open: boolean
    date: Date | null
    schedule: Schedule | null
    existingSession: Session | null
  }>({ open: false, date: null, schedule: null, existingSession: null })

  // Attendance grid (inside session modal)
  const [gridView, setGridView] = useState(false)
  const [gridSession, setGridSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AthleteRecord[]>([])
  const [allAthletes, setAllAthletes] = useState<{ id: string; name: string; number: number; ageGroup: string }[]>([])
  const [pendingRecords, setPendingRecords] = useState<Record<string, boolean>>({})
  const [pendingPayments, setPendingPayments] = useState<Record<string, { paid: boolean; amount: string }>>({})
  const [savingRecords, setSavingRecords] = useState(false)
  const [addAthleteOpen, setAddAthleteOpen] = useState(false)
  const [addAthleteSearch, setAddAthleteSearch] = useState('')
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])
  const [expandedAddGroups, setExpandedAddGroups] = useState<string[]>([])

  const [cancelReason, setCancelReason] = useState('')

  // Create specific session dialog
  const [specificDialog, setSpecificDialog] = useState<{ open: boolean; date: Date | null }>({ open: false, date: null })
  const [specificForm, setSpecificForm] = useState({ time: '', title: '' })
  const [savingSpecific, setSavingSpecific] = useState(false)

  // ── Stats state ───────────────────────────────────────────────────────────

  const [stats, setStats] = useState<AthleteStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsAgeGroup, setStatsAgeGroup] = useState('all')

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/schedules?season=${encodeURIComponent(scheduleSeason)}`)
      if (res.ok) setSchedules(await res.json())
      else toast({ title: 'Erro ao carregar horários', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao carregar horários', variant: 'destructive' })
    }
  }, [scheduleSeason, toast])

  const fetchSessions = useCallback(async () => {
    setCalendarLoading(true)
    try {
      const y = calendarMonth.getFullYear()
      const m = calendarMonth.getMonth() + 1
      const from = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = getDaysInMonth(calendarMonth)
      const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const params = new URLSearchParams({ from, to })
      if (calendarAgeGroup !== 'all') params.set('ageGroup', calendarAgeGroup)
      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) setSessions(await res.json())
      else toast({ title: 'Erro ao carregar treinos', variant: 'destructive' })
    } catch {
      toast({ title: 'Erro de ligação ao carregar treinos', variant: 'destructive' })
    } finally {
      setCalendarLoading(false)
    }
  }, [calendarMonth, calendarAgeGroup, toast])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => {
    fetch('/api/athletes?all=true')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.athletes)) setAllAthletes(d.athletes) })
      .catch(() => toast({ title: 'Erro ao carregar atletas', variant: 'destructive' }))
  }, [toast])

  // ── Calendar generation ───────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const totalDays = getDaysInMonth(calendarMonth)
    const firstDayOfWeek = getDay(startOfMonth(calendarMonth)) // 0=Sun

    // Convert to Mon-first (0=Mon, 6=Sun)
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    const days: { date: Date | null }[] = Array.from({ length: offset }, () => ({ date: null }))
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: new Date(year, month, d) })
    }
    return days
  }, [calendarMonth])

  // SPECIFIC sessions for a given date
  const getSpecificSessionsForDay = useCallback((date: Date): Session[] => {
    return sessions.filter((s) => s.sessionType === 'SPECIFIC' && isSameDay(sessionDateOnly(s.date), date))
  }, [sessions])

  // For a given date, find all matching schedules (from the active season schedules)
  const getSchedulesForDay = useCallback((date: Date): Schedule[] => {
    const dow = getDay(date) // 0=Sun
    return schedules.filter((s) => {
      if (!s.active) return false
      if (s.dayOfWeek !== dow) return false
      if (calendarAgeGroup !== 'all' && s.ageGroup !== calendarAgeGroup) return false
      return true
    })
  }, [schedules, calendarAgeGroup])

  // Find existing session for a given date+schedule
  const getSessionForSlot = useCallback((date: Date, schedule: Schedule): Session | undefined => {
    return sessions.find((s) => {
      const sDate = sessionDateOnly(s.date)
      return isSameDay(sDate, date) &&
        s.primaryAgeGroup === schedule.ageGroup &&
        (s.scheduleId === schedule.id || (!s.scheduleId && s.primaryAgeGroup === schedule.ageGroup))
    })
  }, [sessions])

  // ── Schedule CRUD ─────────────────────────────────────────────────────────

  const copySeason = async () => {
    const prevYear = seasonToYear(scheduleSeason) - 1
    if (prevYear < MIN_SEASON_YEAR) return
    const prevSeason = yearToSeason(prevYear)
    setCopyingSeason(true)
    try {
      const res = await fetch(`/api/attendance/schedules?season=${encodeURIComponent(prevSeason)}`)
      if (!res.ok) { toast({ title: 'Sem horários para copiar', variant: 'destructive' }); return }
      const prev: Schedule[] = await res.json()
      if (prev.length === 0) { toast({ title: `Sem horários em ${prevSeason} para copiar`, variant: 'destructive' }); return }

      const results = await Promise.allSettled(
        prev.map((s) =>
          fetch('/api/attendance/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              season: scheduleSeason,
              ageGroup: s.ageGroup,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime ?? null,
              location: s.location ?? null,
              sessionType: s.sessionType,
              active: true,
            }),
          })
        )
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      toast({ title: `${ok} horário(s) copiados de ${prevSeason}` })
      fetchSchedules()
    } finally {
      setCopyingSeason(false)
    }
  }

  const openCreateSchedule = () => {
    setEditingSchedule(null)
    const firstAvailable = availableAgeGroups[0]?.value ?? 'SUB15'
    setScheduleForm({
      season: scheduleSeason, seasonStart: '', ageGroup: firstAvailable,
      dayOfWeek: 1, startTime: '19:00', endTime: '', location: '', sessionType: 'GENERAL', active: true,
    })
    setScheduleSheet(true)
  }

  const openEditSchedule = (s: Schedule) => {
    setEditingSchedule(s)
    setScheduleForm({
      season: s.season,
      seasonStart: s.seasonStart ? s.seasonStart.substring(0, 10) : '',
      ageGroup: s.ageGroup,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime ?? '',
      location: s.location ?? '',
      sessionType: s.sessionType,
      active: s.active,
    })
    setScheduleSheet(true)
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      const url = editingSchedule ? `/api/attendance/schedules/${editingSchedule.id}` : '/api/attendance/schedules'
      const method = editingSchedule ? 'PUT' : 'POST'
      const body = {
        ...scheduleForm,
        seasonStart: scheduleForm.seasonStart || null,
        endTime: scheduleForm.endTime || null,
        location: scheduleForm.location || null,
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro', description: json.error, variant: 'destructive' }); return }
      toast({ title: editingSchedule ? 'Horário atualizado' : 'Horário criado' })
      setScheduleSheet(false)
      fetchSchedules()
    } finally { setSavingSchedule(false) }
  }

  const confirmDeleteSchedule = async () => {
    if (!deleteScheduleDialog.schedule) return
    const res = await fetch(`/api/attendance/schedules/${deleteScheduleDialog.schedule.id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Horário eliminado' }); fetchSchedules() }
    else toast({ title: 'Erro ao eliminar', variant: 'destructive' })
    setDeleteScheduleDialog({ open: false, schedule: null })
  }

  // ── Calendar cell click ───────────────────────────────────────────────────

  const handleDayClick = (date: Date, schedule: Schedule) => {
    const existing = getSessionForSlot(date, schedule) ?? null
    setSessionModal({ open: true, date, schedule, existingSession: existing })
    setCancelReason(existing?.cancellationReason ?? '')
  }

  // Create session + open attendance grid
  const handleOpenAttendance = async () => {
    const { date, schedule, existingSession } = sessionModal
    if (!date || !schedule) return

    try {
      let session = existingSession
      if (!session) {
        // Create the session
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: format(date, 'yyyy-MM-dd'),
            time: schedule.startTime,
            primaryAgeGroup: schedule.ageGroup,
            sessionType: schedule.sessionType,
            scheduleId: schedule.id,
          }),
        })
        if (!res.ok) { toast({ title: 'Erro ao criar sessão', variant: 'destructive' }); return }
        session = await res.json()

        // Pre-populate athletes of the primary age group
        const ageAthletes = allAthletes.filter((a) => a.ageGroup === schedule.ageGroup)
        if (ageAthletes.length > 0) {
          const prePopRes = await fetch(`/api/attendance/${session!.id}/records`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: ageAthletes.map((a) => ({ athleteId: a.id, present: false })) }),
          })
          if (!prePopRes.ok) {
            toast({ title: 'Sessão criada, mas falhou o pré-preenchimento dos atletas', description: 'Adiciona-os manualmente.', variant: 'destructive' })
          }
        }
        await fetchSessions()
      }

      // Open grid
      setGridSession({ ...session!, totalRecords: session!.totalRecords ?? 0, presentCount: session!.presentCount ?? 0 })
      const recRes = await fetch(`/api/attendance/${session!.id}/records`)
      if (recRes.ok) {
        const data: AthleteRecord[] = await recRes.json()
        setRecords(data)
        const initPresent: Record<string, boolean> = {}
        const initPayment: Record<string, { paid: boolean; amount: string }> = {}
        data.forEach((r) => {
          initPresent[r.athleteId] = r.present
          initPayment[r.athleteId] = { paid: r.paidByAthlete, amount: r.paidAmount ? String(r.paidAmount) : '' }
        })
        setPendingRecords(initPresent)
        setPendingPayments(initPayment)
      }
      setSessionModal({ open: false, date: null, schedule: null, existingSession: null })
      setGridView(true)
    } catch {
      toast({ title: 'Erro de ligação ao abrir assiduidade', variant: 'destructive' })
    }
  }

  const openSpecificSession = async (session: Session) => {
    setGridSession(session)
    try {
      const recRes = await fetch(`/api/attendance/${session.id}/records`)
      if (recRes.ok) {
        const data: AthleteRecord[] = await recRes.json()
        setRecords(data)
        const initPresent: Record<string, boolean> = {}
        const initPayment: Record<string, { paid: boolean; amount: string }> = {}
        data.forEach((r) => {
          initPresent[r.athleteId] = r.present
          initPayment[r.athleteId] = { paid: r.paidByAthlete, amount: r.paidAmount ? String(r.paidAmount) : '' }
        })
        setPendingRecords(initPresent)
        setPendingPayments(initPayment)
      } else {
        toast({ title: 'Erro ao carregar presenças', variant: 'destructive' })
      }
      setGridView(true)
    } catch {
      toast({ title: 'Erro de ligação ao carregar presenças', variant: 'destructive' })
    }
  }

  const createSpecificSession = async () => {
    if (!specificDialog.date) return
    setSavingSpecific(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(specificDialog.date, 'yyyy-MM-dd'),
          time: specificForm.time || undefined,
          primaryAgeGroup: 'SUB15', // placeholder, not really used for SPECIFIC
          sessionType: 'SPECIFIC',
          title: specificForm.title || 'Treino Específico',
        }),
      })
      if (!res.ok) { toast({ title: 'Erro ao criar sessão', variant: 'destructive' }); return }
      const session: Session = { ...(await res.json()), totalRecords: 0, presentCount: 0, cancelled: false }
      await fetchSessions()
      setSpecificDialog({ open: false, date: null })
      setSpecificForm({ time: '', title: '' })
      openSpecificSession(session)
    } catch {
      toast({ title: 'Erro de ligação ao criar sessão', variant: 'destructive' })
    } finally { setSavingSpecific(false) }
  }

  // ── Cancel session ────────────────────────────────────────────────────────

  const handleCancelSession = async () => {
    const { date, schedule, existingSession } = sessionModal
    if (!date || !schedule) return

    try {
      let session = existingSession
      if (!session) {
        // Create the session first
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: format(date, 'yyyy-MM-dd'),
            time: schedule.startTime,
            primaryAgeGroup: schedule.ageGroup,
            sessionType: schedule.sessionType,
            scheduleId: schedule.id,
          }),
        })
        if (!res.ok) { toast({ title: 'Erro', variant: 'destructive' }); return }
        session = await res.json()
      }

      const res = await fetch(`/api/attendance/${session!.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelled: !session!.cancelled, cancellationReason: cancelReason || null }),
      })
      if (res.ok) {
        toast({ title: session!.cancelled ? 'Treino reativado' : 'Treino cancelado' })
        fetchSessions()
      } else {
        toast({ title: 'Erro', variant: 'destructive' })
      }
      setSessionModal({ open: false, date: null, schedule: null, existingSession: null })
      setCancelReason('')
    } catch {
      toast({ title: 'Erro de ligação ao cancelar treino', variant: 'destructive' })
    }
  }

  // ── Attendance grid ───────────────────────────────────────────────────────

  const togglePresent = (athleteId: string) => {
    setPendingRecords((prev) => ({ ...prev, [athleteId]: !prev[athleteId] }))
  }

  const markAll = (present: boolean) => {
    const updated: Record<string, boolean> = {}
    records.forEach((r) => { updated[r.athleteId] = present })
    setPendingRecords(updated)
  }

  const saveAttendance = async () => {
    if (!gridSession) return
    setSavingRecords(true)
    const isSpecific = gridSession.sessionType === 'SPECIFIC'
    const recordsList = records.map((r) => {
      const payment = pendingPayments[r.athleteId]
      return {
        athleteId: r.athleteId,
        present: pendingRecords[r.athleteId] ?? r.present,
        paidByAthlete: isSpecific ? (payment?.paid ?? false) : false,
        paidAmount: isSpecific && payment?.paid && payment.amount ? parseFloat(payment.amount) : null,
      }
    })
    const res = await fetch(`/api/attendance/${gridSession.id}/records`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: recordsList }),
    })
    if (res.ok) {
      toast({ title: 'Assiduidade guardada' })
      fetchSessions()
    } else {
      toast({ title: 'Erro ao guardar', variant: 'destructive' })
    }
    setSavingRecords(false)
  }

  const confirmAddAthletes = () => {
    const toAdd = allAthletes.filter((a) => selectedToAdd.includes(a.id) && !records.find((r) => r.athleteId === a.id))
    if (toAdd.length === 0) { setAddAthleteOpen(false); return }
    const newRecords: AthleteRecord[] = toAdd.map((athlete) => ({
      id: crypto.randomUUID(), sessionId: gridSession!.id,
      athleteId: athlete.id, present: true, paidByAthlete: false, paidAmount: null, athlete,
    }))
    setRecords((prev) => [...prev, ...newRecords].sort((a, b) => a.athlete.number - b.athlete.number))
    const recUpdates: Record<string, boolean> = {}
    const payUpdates: Record<string, { paid: boolean; amount: string }> = {}
    toAdd.forEach((a) => { recUpdates[a.id] = true; payUpdates[a.id] = { paid: false, amount: '' } })
    setPendingRecords((prev) => ({ ...prev, ...recUpdates }))
    setPendingPayments((prev) => ({ ...prev, ...payUpdates }))
    setAddAthleteOpen(false)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      // Uma query agregada no servidor (src/lib/attendanceStats.ts) em vez de um
      // fetch por sessão — antes crescia sem limite a cada época nova.
      const res = await fetch('/api/attendance/stats')
      if (!res.ok) { toast({ title: 'Erro ao carregar estatísticas', variant: 'destructive' }); return }
      const data: AthleteStat[] = await res.json()
      setStats(data.filter((s) => s.total > 0).sort((a, b) => b.totalPresent - a.totalPresent))
    } catch {
      toast({ title: 'Erro de ligação ao carregar estatísticas', variant: 'destructive' })
    } finally {
      setStatsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === 'stats') loadStats()
  }, [tab, loadStats])

  // ── Derived ───────────────────────────────────────────────────────────────

  const groupedSchedules = schedules.reduce((acc, s) => {
    if (!acc[s.ageGroup]) acc[s.ageGroup] = []
    acc[s.ageGroup].push(s)
    return acc
  }, {} as Record<string, Schedule[]>)

  const primaryRecords = records.filter((r) => !gridSession || r.athlete.ageGroup === gridSession.primaryAgeGroup)
  const guestRecords = records.filter((r) => gridSession && r.athlete.ageGroup !== gridSession.primaryAgeGroup)
  const availableToAdd = allAthletes.filter(
    (a) => !records.find((r) => r.athleteId === a.id) &&
      (addAthleteSearch === '' || a.name.toLowerCase().includes(addAthleteSearch.toLowerCase()) || String(a.number).includes(addAthleteSearch))
  )
  const availableToAddByGroup = AGE_GROUPS.map((g) => ({
    group: g.value,
    label: g.label,
    athletes: availableToAdd.filter((a) => a.ageGroup === g.value),
  })).filter((g) => g.athletes.length > 0)

  const filteredStats = statsAgeGroup === 'all' ? stats : stats.filter((s) => s.ageGroup === statsAgeGroup)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Attendance grid view (full-page)
  if (gridView && gridSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setGridView(false); setGridSession(null) }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {format(sessionDateOnly(gridSession.date), "EEEE, d 'de' MMMM yyyy", { locale: pt })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {ageGroupLabel(gridSession.primaryAgeGroup)} · {gridSession.time ?? ''}
              </p>
            </div>
          </div>
          {can('editAttendance') && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => markAll(true)}>
                <CheckSquare className="h-4 w-4 mr-1.5" />Todos presentes
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setSelectedToAdd([]); setExpandedAddGroups([]); setAddAthleteSearch(''); setAddAthleteOpen(true) }}>
                <Users className="h-4 w-4 mr-1.5" />Adicionar atleta
              </Button>
              <Button size="sm" onClick={saveAttendance} disabled={savingRecords}>
                {savingRecords && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Guardar
              </Button>
            </div>
          )}
        </div>

        {gridSession.sessionType === 'SPECIFIC' && (
          <div className="rounded-md bg-gray-800 text-white px-4 py-2.5 text-sm flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <span className="font-semibold">{gridSession.title || 'Treino Específico'}</span>
              <span className="text-white/60 ml-2 text-xs">Sessão paga — regista presença e pagamento por atleta</span>
            </div>
          </div>
        )}

        {/* Helper to render a rows for a list of records */}
        {(() => {
          const renderRows = (rows: AthleteRecord[]) => rows.map((r) => {
            const payment = pendingPayments[r.athleteId] ?? { paid: false, amount: '' }
            return (
              <TableRow key={r.athleteId} className={pendingRecords[r.athleteId] ? 'bg-green-50' : ''}>
                <TableCell className="font-medium">#{r.athlete.number}</TableCell>
                <TableCell>{r.athlete.name}</TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={() => can('editAttendance') && togglePresent(r.athleteId)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-lg transition-colors ${pendingRecords[r.athleteId] ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                  >
                    {pendingRecords[r.athleteId] ? '✓' : '✗'}
                  </button>
                </TableCell>
                {gridSession.sessionType === 'SPECIFIC' && (
                  <>
                    <TableCell className="text-center">
                      <button
                        onClick={() => can('editAttendance') && setPendingPayments((prev) => ({
                          ...prev,
                          [r.athleteId]: { ...payment, paid: !payment.paid },
                        }))}
                        className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm transition-colors ${payment.paid ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                      >
                        {payment.paid ? '€' : '—'}
                      </button>
                    </TableCell>
                    <TableCell>
                      {payment.paid && (
                        <Input
                          type="number" min="0" step="0.01" className="h-8 text-sm w-24"
                          placeholder="0.00"
                          value={payment.amount}
                          onChange={(e) => can('editAttendance') && setPendingPayments((prev) => ({
                            ...prev,
                            [r.athleteId]: { ...payment, amount: e.target.value },
                          }))}
                        />
                      )}
                    </TableCell>
                  </>
                )}
              </TableRow>
            )
          })

          const colSpan = gridSession.sessionType === 'SPECIFIC' ? 5 : 3
          const tableHead = (
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nº</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center w-28">Presente</TableHead>
                {gridSession.sessionType === 'SPECIFIC' && (
                  <>
                    <TableHead className="text-center w-24">Pagou?</TableHead>
                    <TableHead className="w-28">Valor (€)</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
          )

          if (gridSession.sessionType === 'SPECIFIC') {
            return (
              <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                  {tableHead}
                  <TableBody>
                    {records.length === 0
                      ? <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-sm text-muted-foreground">Sem atletas — usa &quot;Adicionar atletas&quot; para incluir</TableCell></TableRow>
                      : renderRows(records)}
                  </TableBody>
                </Table>
              </div>
            )
          }

          // Non-SPECIFIC: primary section + one section per guest age group
          const guestGroups = AGE_GROUPS
            .map((g) => ({ group: g.value, label: g.label, rows: guestRecords.filter((r) => r.athlete.ageGroup === g.value) }))
            .filter((g) => g.rows.length > 0)

          return (
            <div className="space-y-3">
              <div className="rounded-md border bg-white overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-sm font-semibold">{ageGroupLabel(gridSession.primaryAgeGroup)} — Escalão Principal</p>
                </div>
                <Table>
                  {tableHead}
                  <TableBody>
                    {primaryRecords.length === 0
                      ? <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-sm text-muted-foreground">Sem atletas — usa &quot;Adicionar atletas&quot; para incluir</TableCell></TableRow>
                      : renderRows(primaryRecords)}
                  </TableBody>
                </Table>
              </div>
              {guestGroups.map(({ group, label, rows }) => (
                <div key={group} className="rounded-md border bg-white overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 border-b">
                    <p className="text-sm font-semibold text-amber-800">{label} — Convidados</p>
                  </div>
                  <Table>
                    {tableHead}
                    <TableBody>{renderRows(rows)}</TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )
        })()}

        <p className="text-xs text-muted-foreground">
          {Object.values(pendingRecords).filter(Boolean).length} presente(s) de {records.length} atleta(s)
          {gridSession.sessionType === 'SPECIFIC' && Object.values(pendingPayments).filter((p) => p.paid).length > 0 && (
            <span className="ml-2 text-blue-600">
              · {Object.values(pendingPayments).filter((p) => p.paid).length} pagamento(s)
              {' '}(total: {Object.values(pendingPayments).filter((p) => p.paid && p.amount).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(2)}€)
            </span>
          )}
        </p>

        <Dialog open={addAthleteOpen} onOpenChange={(o) => { if (!o) setAddAthleteOpen(false) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Atletas</DialogTitle>
              <DialogDescription className="sr-only">Seleciona atletas para adicionar ao treino</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Pesquisar por nome ou número..."
              value={addAthleteSearch}
              onChange={(e) => setAddAthleteSearch(e.target.value)}
              className="mb-1"
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto space-y-1 py-1">
              {availableToAddByGroup.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem atletas disponíveis</p>
              ) : availableToAddByGroup.map(({ group, label, athletes }) => {
                const isOpen = expandedAddGroups.includes(group)
                const selectedInGroup = athletes.filter((a) => selectedToAdd.includes(a.id)).length
                return (
                  <div key={group} className="border rounded-md overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium"
                      onClick={() => setExpandedAddGroups((prev) => isOpen ? prev.filter((g) => g !== group) : [...prev, group])}
                    >
                      <span className="flex items-center gap-2">
                        {label}
                        <span className="text-xs text-muted-foreground font-normal">({athletes.length})</span>
                        {selectedInGroup > 0 && (
                          <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{selectedInGroup}</span>
                        )}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="divide-y">
                        {athletes.map((a) => {
                          const checked = selectedToAdd.includes(a.id)
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors ${checked ? 'bg-green-50' : ''}`}
                              onClick={() => setSelectedToAdd((prev) => checked ? prev.filter((id) => id !== a.id) : [...prev, a.id])}
                            >
                              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                              </span>
                              <span className="flex-1">#{a.number} {a.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedToAdd.length > 0 ? `${selectedToAdd.length} selecionado(s)` : 'Nenhum selecionado'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddAthleteOpen(false)}>Cancelar</Button>
                <Button size="sm" disabled={selectedToAdd.length === 0} onClick={confirmAddAthletes}>
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN TABS VIEW
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-1.5" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Clock className="h-4 w-4 mr-1.5" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart2 className="h-4 w-4 mr-1.5" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        {/* ── CALENDÁRIO ── */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon"
                onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                disabled={calendarMonth <= new Date(2025, 8, 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-base font-semibold w-36 text-center capitalize">
                {format(calendarMonth, 'MMMM yyyy', { locale: pt })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Select value={calendarAgeGroup} onValueChange={setCalendarAgeGroup}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os escalões</SelectItem>
                {AGE_GROUPS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {calendarLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
          <div className="rounded-lg border bg-white overflow-hidden min-w-[480px]">
            {/* Day headers - Mon to Sun */}
            <div className="grid grid-cols-7 border-b">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, idx) => {
                if (!cell.date) {
                  return <div key={`empty-${idx}`} className="min-h-[80px] border-r border-b last:border-r-0 bg-gray-50/50" />
                }

                const date = cell.date
                const isToday = isSameDay(date, new Date())
                const daySchedules = getSchedulesForDay(date)
                const specificSessions = getSpecificSessionsForDay(date)

                return (
                  <div
                    key={date.toISOString()}
                    className={`min-h-[80px] border-r border-b last:border-r-0 p-1.5 group ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                        {date.getDate()}
                      </div>
                      {can('editAttendance') && (
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-gray-300 hover:bg-primary hover:text-white text-gray-600 flex items-center justify-center text-[10px] leading-none"
                          title="Criar treino específico"
                          onClick={() => { setSpecificDialog({ open: true, date }); setSpecificForm({ time: '', title: '' }) }}
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Specific sessions */}
                    {specificSessions.map((s) => (
                      <button
                        key={s.id}
                        className={`w-full text-left rounded p-1 mb-0.5 text-[10px] leading-tight transition-colors bg-gray-800 text-white hover:bg-gray-900 ${s.cancelled ? 'opacity-50' : ''}`}
                        onClick={() => openSpecificSession(s)}
                      >
                        <div className="font-semibold truncate">⚡ {s.title || 'Específico'}</div>
                        {s.time && <div className="opacity-70">{s.time}</div>}
                        {s.cancelled && <div className="text-red-300">Cancelado</div>}
                        {!s.cancelled && s.totalRecords > 0 && (
                          <div className="inline-flex items-center gap-0.5 bg-green-500 text-white rounded px-1 mt-0.5">
                            ✓ {s.presentCount}/{s.totalRecords}
                          </div>
                        )}
                      </button>
                    ))}

                    {daySchedules.map((schedule) => {
                      const session = getSessionForSlot(date, schedule)
                      const isCancelled = session?.cancelled
                      const hasRecords = session && session.totalRecords > 0
                      const colors = AGE_GROUP_CALENDAR_COLORS[schedule.ageGroup] ?? AGE_GROUP_CALENDAR_COLORS['SUB19']

                      return (
                        <button
                          key={schedule.id}
                          className={`w-full text-left rounded p-1 mb-0.5 text-[10px] leading-tight transition-colors ${colors.bg} ${colors.text} ${colors.hover} ${isCancelled ? 'opacity-60' : ''}`}
                          onClick={() => handleDayClick(date, schedule)}
                        >
                          <div className="font-semibold truncate">{ageGroupLabel(schedule.ageGroup)}</div>
                          <div className="opacity-80">{schedule.startTime}{schedule.endTime ? `–${schedule.endTime}` : ''}</div>
                          {isCancelled && (
                            <div className="flex items-center gap-0.5 text-red-600 font-medium">
                              <XCircle className="h-2.5 w-2.5 flex-shrink-0" />
                              Cancelado
                            </div>
                          )}
                          {hasRecords && !isCancelled && (
                            <div className="inline-flex items-center gap-0.5 bg-green-500 text-white rounded px-1 mt-0.5">
                              ✓ {session!.presentCount}/{session!.totalRecords}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="font-medium">Escalões:</span>
            {Object.entries(AGE_GROUP_CALENDAR_COLORS).map(([ag, c]) => (
              <span key={ag} className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
                {ageGroupLabel(ag) ?? ag}
              </span>
            ))}
            <span className="ml-2 font-medium">Estado:</span>
            <span className="flex items-center gap-1"><span className="inline-flex items-center gap-0.5 bg-green-500 text-white rounded px-1 text-[10px]">✓ X/Y</span>Com presenças</span>
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />Cancelado</span>
          </div>
        </TabsContent>

        {/* ── HORÁRIOS ── */}
        <TabsContent value="schedules" className="space-y-4 mt-4">
          {/* Season navigation */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon"
                onClick={prevScheduleSeason}
                disabled={!canGoPrevSeason}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-base font-semibold w-20 text-center">{scheduleSeason}</span>
              <Button variant="outline" size="icon" onClick={nextScheduleSeason}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {can('editAttendance') && (
              <div className="flex items-center gap-2">
                {/* Copy from previous season */}
                {canGoPrevSeason && schedules.length === 0 && (
                  <Button variant="outline" size="sm" onClick={copySeason} disabled={copyingSeaon}>
                    {copyingSeaon && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Copiar de {yearToSeason(seasonToYear(scheduleSeason) - 1)}
                  </Button>
                )}
                {/* New schedule — only if there are age groups available */}
                {!allAgeGroupsFilled && (
                  <Button size="sm" onClick={openCreateSchedule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Novo Horário
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* All filled indicator */}
          {allAgeGroupsFilled && can('editAttendance') && (
            <p className="text-sm text-muted-foreground">
              Todos os escalões têm horários para {scheduleSeason}.
            </p>
          )}

          {/* Missing age groups */}
          {!allAgeGroupsFilled && schedules.length > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Sem horários: {availableAgeGroups.map((g) => g.label).join(', ')}
            </p>
          )}

          {Object.keys(groupedSchedules).length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">Sem horários para {scheduleSeason}</p>
              {can('editAttendance') && (
                <div className="flex flex-col items-center gap-2">
                  <Button size="sm" onClick={openCreateSchedule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Criar primeiro horário
                  </Button>
                  {canGoPrevSeason && (
                    <Button variant="outline" size="sm" onClick={copySeason} disabled={copyingSeaon}>
                      {copyingSeaon && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                      Copiar de {yearToSeason(seasonToYear(scheduleSeason) - 1)}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSchedules).sort(([a], [b]) => a.localeCompare(b)).map(([ageGroup, ags]) => (
                <div key={ageGroup} className="rounded-lg border bg-white overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{ageGroupLabel(ageGroup) ?? ageGroup}</h3>
                    <Badge variant="secondary">{ags.length} treino{ags.length !== 1 ? 's' : ''}/semana</Badge>
                  </div>
                  <div className="divide-y">
                    {ags.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-16 text-center">
                            <span className="text-sm font-medium">{DAY_LABELS[s.dayOfWeek]}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                            {s.startTime}{s.endTime ? ` – ${s.endTime}` : ''}
                          </div>
                          {s.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground hidden sm:flex">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {s.location}
                            </div>
                          )}
                          {!s.active && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        {can('editAttendance') && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => openEditSchedule(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="text-destructive"
                              onClick={() => setDeleteScheduleDialog({ open: true, schedule: s })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ESTATÍSTICAS ── */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={statsAgeGroup} onValueChange={setStatsAgeGroup}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os escalões</SelectItem>
                {AGE_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{filteredStats.length} atleta(s) com registos</p>
          </div>

          {statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead className="hidden sm:table-cell">Escalão</TableHead>
                    <TableHead className="text-center">Treinos Próprios</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Outros Escalões</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="hidden sm:table-cell">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem dados de assiduidade</TableCell></TableRow>
                  ) : filteredStats.map((s, i) => {
                    const pct = s.total > 0 ? Math.round((s.totalPresent / s.total) * 100) : 0
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                            <p className="font-medium text-sm">#{s.number} {s.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{ageGroupLabel(s.ageGroup)}</TableCell>
                        <TableCell className="text-center text-sm">{s.ownPresent}/{s.ownSessions}</TableCell>
                        <TableCell className="text-center text-sm hidden md:table-cell">
                          {s.otherPresent > 0 ? <span className="text-amber-700">{s.otherPresent}/{s.otherSessions}</span> : '—'}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-sm">{s.totalPresent}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── SESSION MODAL (calendar cell click) ── */}
      <Dialog open={sessionModal.open} onOpenChange={(o) => !o && setSessionModal({ open: false, date: null, schedule: null, existingSession: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {sessionModal.date && format(sessionModal.date, "EEEE, d 'de' MMMM", { locale: pt })}
            </DialogTitle>
            <DialogDescription>
              {sessionModal.schedule && (
                <span>
                  {ageGroupLabel(sessionModal.schedule.ageGroup)} · {sessionModal.schedule.startTime}
                  {sessionModal.schedule.endTime ? ` – ${sessionModal.schedule.endTime}` : ''}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {sessionModal.existingSession?.cancelled && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
              <p className="font-medium text-red-800 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                Treino cancelado
              </p>
              {sessionModal.existingSession.cancellationReason && (
                <p className="text-red-700 mt-1">{sessionModal.existingSession.cancellationReason}</p>
              )}
            </div>
          )}

          {can('editAttendance') && !sessionModal.existingSession?.cancelled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Motivo de cancelamento (se aplicável)</Label>
              <Input
                placeholder="ex: Pavilhão ocupado, feriado..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {can('editAttendance') && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancelSession}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                {sessionModal.existingSession?.cancelled ? 'Reativar treino' : 'Cancelar treino'}
              </Button>
            )}
            {!sessionModal.existingSession?.cancelled && (sessionModal.existingSession || can('editAttendance')) && (
              <Button onClick={handleOpenAttendance}>
                <Users className="h-4 w-4 mr-1.5" />
                {sessionModal.existingSession ? 'Ver presenças' : 'Registar presenças'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SCHEDULE SHEET ── */}
      <Sheet open={scheduleSheet} onOpenChange={setScheduleSheet}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSchedule ? 'Editar Horário' : 'Novo Horário'}</SheetTitle>
            <SheetDescription>Horário semanal recorrente por escalão e época</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Época *</Label>
                <Input
                  value={scheduleForm.season}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, season: e.target.value }))}
                  placeholder="ex: 2025/26"
                />
              </div>
              <div className="space-y-1">
                <Label>Início da época</Label>
                <Input
                  type="date"
                  value={scheduleForm.seasonStart}
                  onChange={(e) => setScheduleForm((p) => ({ ...p, seasonStart: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Escalão *</Label>
              <Select value={scheduleForm.ageGroup} onValueChange={(v) => setScheduleForm((p) => ({ ...p, ageGroup: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(editingSchedule
                    ? AGE_GROUPS
                    : availableAgeGroups
                  ).map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {!editingSchedule && availableAgeGroups.length < AGE_GROUPS.length && (
                <p className="text-xs text-muted-foreground">
                  Escalões já com horário em {scheduleSeason} estão ocultos
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Dia da semana *</Label>
              <Select value={String(scheduleForm.dayOfWeek)} onValueChange={(v) => setScheduleForm((p) => ({ ...p, dayOfWeek: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_LABELS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hora início *</Label>
                <Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Hora fim</Label>
                <Input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((p) => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pavilhão / Local</Label>
              <Input value={scheduleForm.location} onChange={(e) => setScheduleForm((p) => ({ ...p, location: e.target.value }))} placeholder="ex: Pavilhão de Ponta Delgada" />
            </div>
            <div className="space-y-1">
              <Label>Tipo de Treino</Label>
              <Select value={scheduleForm.sessionType} onValueChange={(v) => setScheduleForm((p) => ({ ...p, sessionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.filter((t) => t.value !== 'SPECIFIC').map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Horário ativo</Label>
              <button
                type="button"
                onClick={() => setScheduleForm((p) => ({ ...p, active: !p.active }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${scheduleForm.active ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${scheduleForm.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setScheduleSheet(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSchedule ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete schedule dialog */}
      <Dialog open={deleteScheduleDialog.open} onOpenChange={(o) => setDeleteScheduleDialog({ open: o, schedule: deleteScheduleDialog.schedule })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Horário</DialogTitle>
            <DialogDescription>
              Tem a certeza que quer eliminar o horário de{' '}
              {deleteScheduleDialog.schedule && <strong>{ageGroupLabel(deleteScheduleDialog.schedule.ageGroup)} às {deleteScheduleDialog.schedule.startTime}</strong>}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteScheduleDialog({ open: false, schedule: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteSchedule}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create specific session dialog */}
      <Dialog open={specificDialog.open} onOpenChange={(o) => setSpecificDialog({ open: o, date: specificDialog.date })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Treino Específico</DialogTitle>
            <DialogDescription>
              {specificDialog.date && format(specificDialog.date, "EEEE, d 'de' MMMM", { locale: pt })}
              {' '}— sessão paga, atletas adicionados manualmente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input
                type="text"
                placeholder="HH:MM"
                maxLength={5}
                value={specificForm.time}
                onChange={(e) => setSpecificForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Título / Descrição</Label>
              <Input
                value={specificForm.title}
                onChange={(e) => setSpecificForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="ex: Treino GR Avançado, Técnica de remate..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecificDialog({ open: false, date: null })}>Cancelar</Button>
            <Button onClick={createSpecificSession} disabled={savingSpecific}>
              {savingSpecific && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Criar e adicionar atletas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
