'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { Download, Users, Euro, Package, UserCheck, Loader2, ClipboardCheck, Shirt } from 'lucide-react'
import { AGE_GROUPS } from '@/lib/constants'

const ALL_AGE_GROUP_OPTIONS = [
  { value: 'all', label: 'Todos os escalões' },
  { value: 'SUB11', label: 'Sub-11' },
  { value: 'SUB13', label: 'Sub-13' },
  { value: 'SUB15', label: 'Sub-15' },
  { value: 'SUB17', label: 'Sub-17' },
  { value: 'SUB19', label: 'Sub-19' },
  { value: 'SENIORS', label: 'Seniores' },
]

function getCurrentSeason() {
  const m = new Date().getMonth() + 1
  return m >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1
}

function buildSeasons() {
  const current = getCurrentSeason()
  return Array.from({ length: 5 }, (_, i) => current - i)
}

async function downloadFile(url: string, filename: string, toast: ReturnType<typeof useToast>['toast']) {
  const res = await fetch(url)
  if (!res.ok) { toast({ title: 'Erro ao exportar', variant: 'destructive' }); return }
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(href)
}

export default function ReportsPage() {
  const { can } = usePermissions()
  const { toast } = useToast()
  const [athleteAgeGroup, setAthleteAgeGroup] = useState('all')
  const [financialSeason, setFinancialSeason] = useState(String(getCurrentSeason()))
  const [membersYear, setMembersYear] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [attendanceAgeGroup, setAttendanceAgeGroup] = useState('all')
  const [textilesSeasonFilter, setTextilesSeasonFilter] = useState('all')

  const currentYear = new Date().getFullYear()
  const memberYears = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  const setLoad = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }))

  const handleAthletes = async () => {
    setLoad('athletes', true)
    try {
      const params = new URLSearchParams()
      if (athleteAgeGroup !== 'all') params.set('ageGroup', athleteAgeGroup)
      await downloadFile(`/api/reports/athletes?${params}`, `atletas-${new Date().toISOString().split('T')[0]}.xlsx`, toast)
      toast({ title: 'Lista de atletas exportada' })
    } finally { setLoad('athletes', false) }
  }

  const handleFinancial = async () => {
    setLoad('financial', true)
    try {
      await downloadFile(`/api/reports/financial?season=${financialSeason}`, `financeiro-${financialSeason}-${Number(financialSeason) + 1}.xlsx`, toast)
      toast({ title: 'Relatório financeiro exportado' })
    } finally { setLoad('financial', false) }
  }

  const handleMembers = async () => {
    setLoad('members', true)
    try {
      await downloadFile(`/api/reports/members?year=${membersYear}`, `socios-${membersYear}.xlsx`, toast)
      toast({ title: 'Lista de sócios exportada' })
    } finally { setLoad('members', false) }
  }

  const handleMaterials = async () => {
    setLoad('materials', true)
    try {
      await downloadFile('/api/reports/materials', `materiais-${new Date().toISOString().split('T')[0]}.xlsx`, toast)
      toast({ title: 'Inventário exportado' })
    } finally { setLoad('materials', false) }
  }

  const handleAttendance = async () => {
    setLoad('attendance', true)
    try {
      const params = new URLSearchParams()
      if (attendanceAgeGroup !== 'all') params.set('ageGroup', attendanceAgeGroup)
      await downloadFile(`/api/reports/attendance?${params}`, `assiduidades-${new Date().toISOString().split('T')[0]}.xlsx`, toast)
      toast({ title: 'Relatório de assiduidades exportado' })
    } finally { setLoad('attendance', false) }
  }

  const handleTextiles = async () => {
    setLoad('textiles', true)
    try {
      const params = new URLSearchParams()
      if (textilesSeasonFilter !== 'all') params.set('season', textilesSeasonFilter)
      await downloadFile(`/api/reports/textiles?${params}`, `texteis-${new Date().toISOString().split('T')[0]}.xlsx`, toast)
      toast({ title: 'Relatório de têxteis exportado' })
    } finally { setLoad('textiles', false) }
  }

  const seasons = buildSeasons()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm text-muted-foreground">
          Exporta dados do clube em formato Excel (.xlsx).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Athletes */}
        {can('viewAthletes') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Lista de Atletas
              </CardTitle>
              <CardDescription>
                Exporta todos os atletas com dados pessoais, contacto, encarregado e mensalidade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={athleteAgeGroup} onValueChange={setAthleteAgeGroup}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_AGE_GROUP_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAthletes} disabled={loading.athletes}>
                  {loading.athletes
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: N.º, Nome, Escalão, Data Nascimento, Idade, Telefone, Email, NIF, CC/BI, Morada, Escola, Encarregado, Mensalidade, Isento
              </p>
            </CardContent>
          </Card>
        )}

        {/* Members */}
        {can('viewMembers') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Lista de Sócios
              </CardTitle>
              <CardDescription>
                Exporta todos os sócios com estado de quotas mês a mês para o ano selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={membersYear} onValueChange={setMembersYear}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {memberYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleMembers} disabled={loading.members}>
                  {loading.members
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: N.º, Nome, Telefone, Email, Morada, Quota Mensal, Jan–Dez (valor pago), Total Pago, Em Atraso
              </p>
            </CardContent>
          </Card>
        )}

        {/* Financial */}
        {can('viewFees') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Resumo Financeiro de Mensalidades
              </CardTitle>
              <CardDescription>
                Exporta o estado de pagamentos de cada atleta para a época selecionada, mês a mês.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={financialSeason} onValueChange={setFinancialSeason}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}/{s + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleFinancial} disabled={loading.financial}>
                  {loading.financial
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: N.º, Nome, Escalão, Isento, Mensalidade, Set–Jun (valor pago por mês), Total Pago, Em Falta
              </p>
            </CardContent>
          </Card>
        )}

        {/* Materials */}
        {can('viewMaterials') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Inventário de Materiais
              </CardTitle>
              <CardDescription>
                Exporta todo o inventário com estado atual e atleta atribuído.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleMaterials} disabled={loading.materials}>
                  {loading.materials
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: Nome, Categoria, Tipo, Estado, Atleta N.º, Atleta Nome, Notas
              </p>
            </CardContent>
          </Card>
        )}

        {/* Attendance */}
        {can('viewAttendance') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Assiduidades
              </CardTitle>
              <CardDescription>
                Exporta estatísticas de assiduidade por atleta: presenças totais, treinos próprios vs outros escalões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={attendanceAgeGroup} onValueChange={setAttendanceAgeGroup}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                    <SelectItem value="all">Todos os escalões</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAttendance} disabled={loading.attendance}>
                  {loading.attendance
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: N.º, Nome, Escalão, Total Sessões, Presenças, Faltas, % Assiduidade, Treinos Próprios, Outros Escalões
              </p>
            </CardContent>
          </Card>
        )}

        {/* Textiles */}
        {can('viewTextiles') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shirt className="h-4 w-4" />
                Materiais Têxteis
              </CardTitle>
              <CardDescription>
                Exporta o inventário de equipamento têxtil com estado, atleta atribuído e custos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Época (ex: 2025/26 ou vazio = todas)"
                  className="w-48"
                  value={textilesSeasonFilter === 'all' ? '' : textilesSeasonFilter}
                  onChange={(e) => setTextilesSeasonFilter(e.target.value || 'all')}
                />
                <Button onClick={handleTextiles} disabled={loading.textiles}>
                  {loading.textiles
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportar XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campos: Época, Categoria, Tipo, Tamanho, Nº Camisola, Personalizado, Estado, Atleta, Custo Total, Pago Atleta
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
