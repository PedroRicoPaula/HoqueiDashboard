'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import {
  Check, X, Minus, ChevronLeft, ChevronRight,
  Loader2, Euro, AlertTriangle, Users, CheckCircle2, MousePointerClick,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Season: Sep-Jun (10 months, Jul/Aug = férias)
const SEASON_MONTHS: { month: number; label: string; labelFull: string; isSecondYear: boolean }[] = [
  { month: 9,  label: 'Set', labelFull: 'Setembro',  isSecondYear: false },
  { month: 10, label: 'Out', labelFull: 'Outubro',   isSecondYear: false },
  { month: 11, label: 'Nov', labelFull: 'Novembro',  isSecondYear: false },
  { month: 12, label: 'Dez', labelFull: 'Dezembro',  isSecondYear: false },
  { month: 1,  label: 'Jan', labelFull: 'Janeiro',   isSecondYear: true },
  { month: 2,  label: 'Fev', labelFull: 'Fevereiro', isSecondYear: true },
  { month: 3,  label: 'Mar', labelFull: 'Março',     isSecondYear: true },
  { month: 4,  label: 'Abr', labelFull: 'Abril',     isSecondYear: true },
  { month: 5,  label: 'Mai', labelFull: 'Maio',      isSecondYear: true },
  { month: 6,  label: 'Jun', labelFull: 'Junho',     isSecondYear: true },
]

const AGE_GROUPS = [
  { value: 'all', label: 'Todos os escalões' },
  { value: 'SUB11', label: 'Sub-11' },
  { value: 'SUB13', label: 'Sub-13' },
  { value: 'SUB15', label: 'Sub-15' },
  { value: 'SUB17', label: 'Sub-17' },
  { value: 'SUB19', label: 'Sub-19' },
]

const MIN_SEASON = 2025

function getCurrentSeasonStart(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9 ? year : year - 1
}

function getMaxSeasonStart(): number {
  return getCurrentSeasonStart() + 1
}

function getYearForSlot(seasonStart: number, isSecondYear: boolean): number {
  return isSecondYear ? seasonStart + 1 : seasonStart
}

interface AthletePayment {
  id: string
  month: number
  year: number
  paid: boolean
  amount: number | null
  paidAt: string | null
  notes: string | null
}

interface AthleteWithPayments {
  id: string
  number: number
  name: string
  ageGroup: string
  monthlyFee: number
  feeExempt: boolean
  payments: AthletePayment[]
}

interface Summary {
  totalCollected: number
  totalPending: number
  athletesFullyPaid: number
  athletesWithArrears: number
  totalAthletes: number
  exemptAthletes: number
}

interface PaidCellDialog {
  athleteId: string
  athleteName: string
  month: number
  year: number
  labelFull: string
  payment: AthletePayment
  monthlyFee: number
}

export default function FeesPage() {
  const [seasonStart, setSeasonStart] = useState(getCurrentSeasonStart())
  const [ageGroupFilter, setAgeGroupFilter] = useState('all')
  const [athletes, setAthletes] = useState<AthleteWithPayments[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Per-cell loading: Set of "${athleteId}-${month}-${year}"
  const [cellLoading, setCellLoading] = useState<Set<string>>(new Set())

  // Dialog for paid cells only
  const [paidDialog, setPaidDialog] = useState<PaidCellDialog | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [dialogSaving, setDialogSaving] = useState(false)

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Array<{ athleteId: string; month: number; year: number }>>([])
  const [batchDialog, setBatchDialog] = useState(false)
  const [batchNotes, setBatchNotes] = useState('')
  const [batchSaving, setBatchSaving] = useState(false)

  // Single-click confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    athlete: AthleteWithPayments; month: number; year: number; labelFull: string
  } | null>(null)
  const [confirmSaving, setConfirmSaving] = useState(false)
  const [confirmNotes, setConfirmNotes] = useState('')

  // Column bulk state
  const [columnBulkDialog, setColumnBulkDialog] = useState<{
    open: boolean; month: number; year: number; labelFull: string
    unpaid: AthleteWithPayments[]
  } | null>(null)
  const [columnBulkNotes, setColumnBulkNotes] = useState('')
  const [columnBulkSaving, setColumnBulkSaving] = useState(false)

  const { can } = usePermissions()
  const { toast } = useToast()
  const canEdit = can('editFees')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const isMonthPast = (month: number, year: number) =>
    year < currentYear || (year === currentYear && month < currentMonth)

  const isMonthCurrent = (month: number, year: number) =>
    month === currentMonth && year === currentYear

  const fetchData = useCallback(async (p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ season: String(seasonStart), page: String(p) })
    if (ageGroupFilter !== 'all') params.set('ageGroup', ageGroupFilter)
    const res = await fetch(`/api/fees?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAthletes(data.athletes)
      setSummary(data.summary)
      setPages(data.pages ?? 1)
      setTotal(data.total ?? 0)
      setPage(p)
    }
    setLoading(false)
  }, [seasonStart, ageGroupFilter, page])

  useEffect(() => { fetchData(1) }, [seasonStart, ageGroupFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedCells([]) }, [seasonStart, ageGroupFilter])

  const isCellSelected = (athleteId: string, month: number, year: number) =>
    selectedCells.some((c) => c.athleteId === athleteId && c.month === month && c.year === year)

  const toggleCellSelection = (athleteId: string, month: number, year: number) => {
    setSelectedCells((prev) => {
      const exists = prev.some((c) => c.athleteId === athleteId && c.month === month && c.year === year)
      if (exists) return prev.filter((c) => !(c.athleteId === athleteId && c.month === month && c.year === year))
      return [...prev, { athleteId, month, year }]
    })
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedCells([])
  }

  const handleBatchRegister = async () => {
    setBatchSaving(true)
    try {
      const results = await Promise.all(
        selectedCells.map(({ athleteId, month, year }) => {
          const athlete = athletes.find((a) => a.id === athleteId)
          return fetch(`/api/athletes/${athleteId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, year, paid: true, amount: athlete?.monthlyFee ?? null, notes: batchNotes || null }),
          })
        })
      )
      const failed = results.filter((r) => !r.ok).length
      const succeeded = results.length - failed
      if (failed > 0) {
        toast({
          title: `${succeeded} registado${succeeded !== 1 ? 's' : ''}, ${failed} falhado${failed !== 1 ? 's' : ''}`,
          variant: 'destructive',
        })
      } else {
        toast({ title: `${succeeded} pagamento${succeeded !== 1 ? 's' : ''} registado${succeeded !== 1 ? 's' : ''}` })
      }
      setBatchDialog(false)
      exitSelectionMode()
      fetchData()
    } catch {
      toast({ title: 'Erro ao registar pagamentos', variant: 'destructive' })
    } finally {
      setBatchSaving(false)
    }
  }

  const getPayment = (athlete: AthleteWithPayments, month: number, year: number) =>
    athlete.payments.find((p) => p.month === month && p.year === year) ?? null

  const handleColumnBulkClick = (month: number, year: number, labelFull: string) => {
    if (!canEdit) return
    const unpaid = athletes.filter(
      (a) => !a.feeExempt && a.monthlyFee > 0 && !getPayment(a, month, year)?.paid
    )
    if (unpaid.length === 0) {
      toast({ title: `Todos os atletas já têm ${labelFull} ${year} registado` })
      return
    }
    setColumnBulkNotes('')
    setColumnBulkDialog({ open: true, month, year, labelFull, unpaid })
  }

  const handleColumnBulkConfirm = async () => {
    if (!columnBulkDialog) return
    setColumnBulkSaving(true)
    try {
      const { month, year, unpaid } = columnBulkDialog
      const results = await Promise.all(
        unpaid.map((a) =>
          fetch(`/api/athletes/${a.id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month, year, paid: true, amount: a.monthlyFee, notes: columnBulkNotes || null }),
          })
        )
      )
      const failed = results.filter((r) => !r.ok).length
      const succeeded = results.length - failed
      if (failed > 0) {
        toast({ title: `${succeeded} registado${succeeded !== 1 ? 's' : ''}, ${failed} falhado${failed !== 1 ? 's' : ''}`, variant: 'destructive' })
      } else {
        toast({ title: `${succeeded} pagamento${succeeded !== 1 ? 's' : ''} registado${succeeded !== 1 ? 's' : ''}` })
      }
      setColumnBulkDialog(null)
      fetchData()
    } catch {
      toast({ title: 'Erro ao registar pagamentos', variant: 'destructive' })
    } finally {
      setColumnBulkSaving(false)
    }
  }

  // Click on an UNPAID cell → open confirm dialog
  const handleUnpaidClick = (
    athlete: AthleteWithPayments,
    month: number,
    year: number,
    labelFull: string,
  ) => {
    if (!canEdit || athlete.feeExempt) return
    setConfirmNotes('')
    setConfirmDialog({ athlete, month, year, labelFull })
  }

  const handleConfirmRegister = async () => {
    if (!confirmDialog) return
    const { athlete, month, year } = confirmDialog
    setConfirmSaving(true)
    const cellKey = `${athlete.id}-${month}-${year}`
    setCellLoading((prev) => new Set(prev).add(cellKey))
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, paid: true, amount: athlete.monthlyFee, notes: confirmNotes || null }),
      })
      if (res.ok) {
        setConfirmDialog(null)
        fetchData(page)
      } else {
        const json = await res.json()
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
      }
    } finally {
      setConfirmSaving(false)
      setCellLoading((prev) => { const next = new Set(prev); next.delete(cellKey); return next })
    }
  }

  // Click on a PAID cell → open dialog with remove/update options
  const handlePaidClick = (
    athlete: AthleteWithPayments,
    month: number,
    year: number,
    labelFull: string,
    payment: AthletePayment,
  ) => {
    if (!canEdit) return
    setPaidDialog({
      athleteId: athlete.id,
      athleteName: athlete.name,
      month,
      year,
      labelFull,
      payment,
      monthlyFee: athlete.monthlyFee,
    })
    setEditAmount(payment.amount != null ? String(payment.amount) : String(athlete.monthlyFee))
    setEditNotes(payment.notes ?? '')
  }

  const handleDialogAction = async (paid: boolean) => {
    if (!paidDialog) return
    setDialogSaving(true)
    try {
      const res = await fetch(`/api/athletes/${paidDialog.athleteId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: paidDialog.month,
          year: paidDialog.year,
          paid,
          amount: paid ? parseFloat(editAmount) || paidDialog.monthlyFee : null,
          notes: editNotes || null,
        }),
      })
      if (res.ok) {
        toast({ title: paid ? 'Valor atualizado' : 'Pagamento removido' })
        setPaidDialog(null)
        fetchData()
      } else {
        const json = await res.json()
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
      }
    } finally {
      setDialogSaving(false)
    }
  }

  const CellContent = ({
    athlete,
    month,
    year,
  }: {
    athlete: AthleteWithPayments
    month: number
    year: number
  }) => {
    const cellKey = `${athlete.id}-${month}-${year}`
    const isLoading = cellLoading.has(cellKey)

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        </div>
      )
    }

    if (athlete.feeExempt) {
      return (
        <div className="flex items-center justify-center h-full">
          <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">Isento</Badge>
        </div>
      )
    }

    const payment = getPayment(athlete, month, year)
    const past = isMonthPast(month, year)
    const curr = isMonthCurrent(month, year)
    const hasConfiguredFee = athlete.monthlyFee > 0
    const selected = selectionMode && isCellSelected(athlete.id, month, year)

    if (selectionMode && !payment?.paid) {
      return (
        <div className="flex items-center justify-center h-full">
          {selected ? (
            <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded border-2 border-gray-300" />
          )}
        </div>
      )
    }

    if (payment?.paid) {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5 h-full relative">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          {payment.amount != null && (
            <span className="text-[10px] text-emerald-700 font-medium leading-none">
              {payment.amount.toFixed(0)}€
            </span>
          )}
          {payment.notes && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" title={payment.notes} />
          )}
        </div>
      )
    }

    if (past && hasConfiguredFee) {
      return (
        <div className="flex items-center justify-center h-full">
          <X className="h-3.5 w-3.5 text-red-500" />
        </div>
      )
    }

    if (curr) {
      return (
        <div className="flex items-center justify-center h-full">
          <Minus className="h-3 w-3 text-amber-400" />
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center h-full">
        <Minus className="h-3 w-3 text-gray-300" />
      </div>
    )
  }

  const getCellBg = (athlete: AthleteWithPayments, month: number, year: number) => {
    if (selectionMode && !athlete.feeExempt && isCellSelected(athlete.id, month, year)) return 'bg-blue-100 hover:bg-blue-200'
    if (athlete.feeExempt) return 'bg-gray-50'
    const payment = getPayment(athlete, month, year)
    if (payment?.paid) return 'bg-emerald-50 hover:bg-emerald-100'
    if (isMonthPast(month, year) && athlete.monthlyFee > 0) return 'bg-red-50 hover:bg-red-100'
    if (isMonthCurrent(month, year)) return 'bg-amber-50 hover:bg-amber-100'
    return 'bg-white hover:bg-gray-50'
  }

  const getCellClickHandler = (athlete: AthleteWithPayments, month: number, year: number, labelFull: string) => {
    if (athlete.feeExempt) return undefined
    if (selectionMode) {
      if (!canEdit) return undefined
      const payment = getPayment(athlete, month, year)
      if (payment?.paid) return undefined
      return () => toggleCellSelection(athlete.id, month, year)
    }
    if (!canEdit) return undefined
    const payment = getPayment(athlete, month, year)
    if (payment?.paid) {
      return () => handlePaidClick(athlete, month, year, labelFull, payment)
    }
    return () => handleUnpaidClick(athlete, month, year, labelFull)
  }

  const seasonLabel = `${seasonStart}/${(seasonStart + 1).toString().slice(-2)}`
  const maxSeason = getMaxSeasonStart()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSeasonStart((s) => s - 1)}
            disabled={seasonStart <= MIN_SEASON}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center w-24">
            <span className="text-xl font-bold">{seasonLabel}</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">época desportiva</p>
          </div>
          {seasonStart < maxSeason ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSeasonStart((s) => s + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-9" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            >
              <MousePointerClick className="h-4 w-4 mr-1" />
              {selectionMode ? 'Cancelar' : 'Seleção múltipla'}
            </Button>
          )}
          <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" />
                Total Cobrado
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-emerald-600">
                {summary.totalCollected.toFixed(2)}€
              </p>
              <p className="text-xs text-muted-foreground">época {seasonLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Em Falta
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-red-600">
                {summary.totalPending.toFixed(2)}€
              </p>
              <p className="text-xs text-muted-foreground">meses em atraso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Em Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{summary.athletesFullyPaid}</p>
              <p className="text-xs text-muted-foreground">de {summary.totalAthletes} atletas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Com Atraso
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-red-600">{summary.athletesWithArrears}</p>
              {summary.exemptAthletes > 0 && (
                <p className="text-xs text-muted-foreground">{summary.exemptAthletes} isentos</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Nenhum atleta encontrado</div>
      ) : (
        <div className="rounded-lg border bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-8 sticky left-0 bg-gray-50 z-10">N.º</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground min-w-40 sticky left-8 bg-gray-50 z-10">Nome</th>
                <th className="text-left px-2 py-2.5 font-medium text-muted-foreground w-20">Escalão</th>
                <th className="text-right px-2 py-2.5 font-medium text-muted-foreground w-16">Mens.</th>
                {SEASON_MONTHS.map((sm) => {
                  const year = getYearForSlot(seasonStart, sm.isSecondYear)
                  const curr = isMonthCurrent(sm.month, year)
                  const past = isMonthPast(sm.month, year)
                  const canMarkColumn = canEdit && !selectionMode && (past || curr)
                  return (
                    <th
                      key={`${sm.month}-${year}`}
                      className={cn(
                        'text-center px-1 py-2.5 font-medium w-12 text-xs select-none',
                        curr ? 'text-amber-600' : past ? 'text-muted-foreground' : 'text-gray-300',
                        canMarkColumn && 'cursor-pointer hover:bg-primary/10 hover:text-primary rounded transition-colors'
                      )}
                      title={canMarkColumn ? `Marcar todos como pagos — ${sm.labelFull} ${year}` : `${sm.labelFull} ${year}`}
                      onClick={canMarkColumn ? () => handleColumnBulkClick(sm.month, year, sm.labelFull) : undefined}
                    >
                      {sm.label}
                    </th>
                  )
                })}
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-20 sticky right-0 bg-gray-50 z-10">Total</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((athlete, idx) => (
                <tr
                  key={athlete.id}
                  className={cn('border-b last:border-0', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground sticky left-0 bg-inherit z-10">
                    {athlete.number}
                  </td>
                  <td className="px-3 py-2 font-medium sticky left-8 bg-inherit z-10">
                    <div className="flex items-center gap-2">
                      {athlete.name}
                      {athlete.feeExempt && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Isento</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {athlete.ageGroup.replace('SUB', 'S-')}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                    {athlete.feeExempt ? '—' : `${athlete.monthlyFee.toFixed(0)}€`}
                  </td>
                  {SEASON_MONTHS.map((sm) => {
                    const year = getYearForSlot(seasonStart, sm.isSecondYear)
                    const onClick = getCellClickHandler(athlete, sm.month, year, sm.labelFull)
                    const payment = getPayment(athlete, sm.month, year)
                    const cellKey = `${athlete.id}-${sm.month}-${year}`
                    return (
                      <td
                        key={`${sm.month}-${year}`}
                        className={cn(
                          'px-0 py-0 h-10 w-12 text-center',
                          getCellBg(athlete, sm.month, year),
                          onClick ? 'cursor-pointer' : '',
                          cellLoading.has(cellKey) ? 'pointer-events-none opacity-70' : '',
                        )}
                        onClick={onClick}
                        title={
                          athlete.feeExempt
                            ? 'Atleta isento'
                            : payment?.paid
                            ? `${sm.labelFull} ${year} — pago${payment.amount != null ? ` (${payment.amount}€)` : ''}`
                            : canEdit && !athlete.feeExempt
                            ? `Registar pagamento — ${sm.labelFull} ${year}`
                            : undefined
                        }
                      >
                        <CellContent athlete={athlete} month={sm.month} year={year} />
                      </td>
                    )
                  })}
                  {/* Total column */}
                  {(() => {
                    if (athlete.feeExempt) return (
                      <td key="total" className="px-3 py-2 text-right text-xs sticky right-0 bg-inherit z-10">
                        <span className="text-muted-foreground">—</span>
                      </td>
                    )
                    const paidTotal = SEASON_MONTHS.reduce((sum, sm) => {
                      const yr = getYearForSlot(seasonStart, sm.isSecondYear)
                      const p = getPayment(athlete, sm.month, yr)
                      return sum + (p?.paid && p.amount != null ? p.amount : 0)
                    }, 0)
                    const pendingTotal = SEASON_MONTHS.filter((sm) => {
                      const yr = getYearForSlot(seasonStart, sm.isSecondYear)
                      const p = getPayment(athlete, sm.month, yr)
                      return athlete.monthlyFee > 0 && isMonthPast(sm.month, yr) && !p?.paid
                    }).length * athlete.monthlyFee
                    return (
                      <td key="total" className="px-3 py-2 text-right text-xs sticky right-0 bg-inherit z-10">
                        <div className="flex flex-col items-end gap-0.5">
                          {paidTotal > 0 && <span className="text-emerald-600 font-medium">{paidTotal.toFixed(0)}€</span>}
                          {pendingTotal > 0 && <span className="text-red-500">-{pendingTotal.toFixed(0)}€</span>}
                          {paidTotal === 0 && pendingTotal === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                    )
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} atleta{total !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => fetchData(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {pages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= pages}
              onClick={() => fetchData(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
          Pago
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          Em atraso
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
          Mês atual
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white border border-gray-200" />
          Futuro
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          Isento
        </div>
        {canEdit && (
          <span className="ml-2 italic">
            Clica numa célula não paga para registar · Célula paga para editar · Cabeçalho do mês para marcar toda a coluna
          </span>
        )}
      </div>

      {/* Sticky bottom bar for batch selection */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 bg-white border-t shadow-lg px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedCells.length === 0
              ? 'Clica nas células para selecionar'
              : `${selectedCells.length} mês${selectedCells.length !== 1 ? 'es' : ''} selecionado${selectedCells.length !== 1 ? 's' : ''}`}
          </span>
          <div className="flex gap-2">
            {selectedCells.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedCells([])}>
                Limpar
              </Button>
            )}
            <Button
              size="sm"
              disabled={selectedCells.length === 0}
              onClick={() => { setBatchNotes(''); setBatchDialog(true) }}
            >
              <Check className="h-4 w-4 mr-1" />
              Registar como pagos
            </Button>
          </div>
        </div>
      )}

      {/* Single-click confirm dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registar pagamento</DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-medium">{confirmDialog.athlete.name}</div>
                <div className="text-muted-foreground">
                  {confirmDialog.labelFull} {confirmDialog.year}
                </div>
                <div className="text-xs text-muted-foreground">
                  Mensalidade: {confirmDialog.athlete.monthlyFee.toFixed(2)}€
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notas (opcional)</Label>
                <Input
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="ex: pago em numerário"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button onClick={handleConfirmRegister} disabled={confirmSaving}>
              {confirmSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Check className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch confirm dialog */}
      <Dialog open={batchDialog} onOpenChange={(o) => !o && setBatchDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registar {selectedCells.length} pagamentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cada mês será marcado como pago com o valor da mensalidade configurada de cada atleta.
            </p>
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Input
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                placeholder="ex: pago em numerário"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialog(false)}>Cancelar</Button>
            <Button onClick={handleBatchRegister} disabled={batchSaving}>
              {batchSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column bulk confirm dialog */}
      <Dialog open={!!columnBulkDialog?.open} onOpenChange={(o) => !o && setColumnBulkDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Marcar {columnBulkDialog?.labelFull} {columnBulkDialog?.year}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {columnBulkDialog?.unpaid.length} atleta{columnBulkDialog?.unpaid.length !== 1 ? 's' : ''} não pago{columnBulkDialog?.unpaid.length !== 1 ? 's' : ''} serão registados com o valor da mensalidade de cada um.
            </p>
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Input
                value={columnBulkNotes}
                onChange={(e) => setColumnBulkNotes(e.target.value)}
                placeholder="ex: pago em numerário"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColumnBulkDialog(null)}>Cancelar</Button>
            <Button onClick={handleColumnBulkConfirm} disabled={columnBulkSaving}>
              {columnBulkSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for PAID cells only */}
      <Dialog open={!!paidDialog} onOpenChange={(o) => !o && setPaidDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagamento registado</DialogTitle>
          </DialogHeader>

          {paidDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-medium">{paidDialog.athleteName}</div>
                <div className="text-muted-foreground">
                  {paidDialog.labelFull} {paidDialog.year}
                </div>
                {paidDialog.payment.paidAt && (
                  <div className="text-xs text-emerald-600">
                    Registado em {new Date(paidDialog.payment.paidAt).toLocaleDateString('pt-PT')}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Valor pago (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Notas (opcional)</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ex: pago em numerário"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 sm:mr-auto"
              onClick={() => handleDialogAction(false)}
              disabled={dialogSaving}
            >
              {dialogSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              Retirar pagamento
            </Button>
            <Button
              onClick={() => handleDialogAction(true)}
              disabled={dialogSaving}
            >
              {dialogSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Atualizar valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
