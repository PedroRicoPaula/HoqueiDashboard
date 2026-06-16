'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Loader2, ChevronLeft, ChevronRight, Filter, Download, Trash2, AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entity: string
  entityId: string | null
  details: unknown
  ip: string | null
  createdAt: string
}

interface ApiResponse {
  logs: AuditLog[]
  total: number
  page: number
  pages: number
}

interface UserOption {
  id: string
  name: string
  email: string
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGIN_FAIL: 'bg-red-100 text-red-700',
  LOGOUT: 'bg-gray-100 text-gray-800',
  CHANGE_PASSWORD: 'bg-yellow-100 text-yellow-800',
  CHANGE_PERMISSIONS: 'bg-orange-100 text-orange-800',
}

const ENTITY_LABELS: Record<string, string> = {
  Athlete: 'Atleta',
  Member: 'Sócio',
  Material: 'Material Hóquei',
  TextileItem: 'Material Têxtil',
  Sponsor: 'Patrocinador',
  Travel: 'Viagem',
  DirectionMember: 'Direção',
  Training: 'Treino',
  TrainingSession: 'Sessão de Treino',
  TrainingSchedule: 'Horário',
  AttendanceRecord: 'Registo de Presença',
  User: 'Utilizador',
  Quota: 'Quota',
  AthletePayment: 'Mensalidade',
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criar',
  UPDATE: 'Atualizar',
  DELETE: 'Eliminar',
  LOGIN: 'Início de sessão',
  LOGIN_FAIL: 'Tentativa falhada',
  LOGOUT: 'Fim de sessão',
  CHANGE_PASSWORD: 'Alt. Palavra-passe',
  CHANGE_PERMISSIONS: 'Alt. Permissões',
}

const PERMISSION_LABELS: Record<string, string> = {
  viewAthletes: 'Ver Atletas', editAthletes: 'Editar Atletas',
  viewFees: 'Ver Mensalidades', editFees: 'Editar Mensalidades',
  viewMembers: 'Ver Sócios', editMembers: 'Editar Sócios',
  viewMaterials: 'Ver Materiais Hóquei', editMaterials: 'Editar Materiais Hóquei',
  viewSponsors: 'Ver Patrocinadores', manageSponsors: 'Gerir Patrocinadores',
  viewTraining: 'Ver Treinos', editTraining: 'Editar Treinos',
  viewTravel: 'Ver Viagens', editTravel: 'Editar Viagens',
  viewDirection: 'Ver Direção', editDirection: 'Editar Direção',
  viewAttendance: 'Ver Assiduidades', editAttendance: 'Editar Assiduidades',
  viewTextiles: 'Ver Materiais Têxteis', editTextiles: 'Editar Materiais Têxteis',
  isAdmin: 'Administrador',
}

const ENTITIES = [
  'Athlete', 'Member', 'Material', 'TextileItem',
  'Sponsor', 'Travel', 'DirectionMember',
  'Training', 'TrainingSession', 'TrainingSchedule', 'AttendanceRecord',
  'User', 'Quota', 'AthletePayment',
]
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAIL', 'LOGOUT', 'CHANGE_PASSWORD', 'CHANGE_PERMISSIONS']

type DeleteMode = 'all' | 'before'

function buildDetailLines(log: AuditLog): string[] {
  const lines: string[] = []
  const entity = ENTITY_LABELS[log.entity] ?? log.entity
  const action = ACTION_LABELS[log.action] ?? log.action

  lines.push(`Ação: ${action} em ${entity}`)
  if (log.entityId) lines.push(`ID do registo: ${log.entityId}`)

  const d = log.details as Record<string, unknown> | null
  if (!d) return lines

  if (log.action === 'CHANGE_PERMISSIONS') {
    lines.push('')
    lines.push('Permissões alteradas:')
    for (const [key, val] of Object.entries(d)) {
      const label = PERMISSION_LABELS[key] ?? key
      lines.push(`  • ${label}: ${val ? 'Ativado' : 'Desativado'}`)
    }
    return lines
  }

  if (log.action === 'LOGIN' || log.action === 'LOGIN_FAIL' || log.action === 'LOGOUT') {
    if (log.action === 'LOGIN_FAIL') lines.push('Autenticação falhada — credenciais incorretas')
    if (d?.ip) lines.push(`IP: ${d.ip}`)
    return lines
  }

  if (d.name) lines.push(`Nome: ${d.name}`)
  if (d.email) lines.push(`Email: ${d.email}`)
  if (d.roles && Array.isArray(d.roles)) lines.push(`Cargos: ${(d.roles as string[]).join(', ')}`)
  if (d.state) lines.push(`Estado: ${d.state}`)
  if (d.category) lines.push(`Categoria: ${d.category}`)
  if (d.ageGroup) lines.push(`Escalão: ${d.ageGroup}`)
  if (d.month && d.year) lines.push(`Período: ${d.month}/${d.year}`)
  if (d.paid !== undefined) lines.push(`Pago: ${d.paid ? 'Sim' : 'Não'}`)
  if (d.amount !== undefined) lines.push(`Valor: €${Number(d.amount).toFixed(2)}`)
  if (d.opponent) lines.push(`Adversário: ${d.opponent}`)
  if (d.date) lines.push(`Data: ${d.date}`)
  if (d.title) lines.push(`Título: ${d.title}`)

  const knownKeys = new Set(['name', 'email', 'roles', 'state', 'category', 'ageGroup', 'month', 'year', 'paid', 'amount', 'opponent', 'date', 'title'])
  const extras = Object.entries(d).filter(([k]) => !knownKeys.has(k))
  if (extras.length) {
    lines.push('')
    lines.push('Outros campos:')
    for (const [k, v] of extras) {
      lines.push(`  • ${k}: ${JSON.stringify(v)}`)
    }
  }

  return lines
}

export default function AuditPage() {
  const { toast } = useToast()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('all')
  const [action, setAction] = useState('all')
  const [userId, setUserId] = useState('all')
  const [users, setUsers] = useState<UserOption[]>([])
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; mode: DeleteMode }>({ open: false, mode: 'all' })
  const [beforeDate, setBeforeDate] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [detailsLog, setDetailsLog] = useState<AuditLog | null>(null)

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.ok ? r.json() : [])
      .then((list: { id: string; name: string; email: string }[]) => setUsers(list))
      .catch(() => {})
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (entity !== 'all') params.set('entity', entity)
    if (action !== 'all') params.set('action', action)
    if (userId !== 'all') params.set('userId', userId)
    const res = await fetch(`/api/admin/audit?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [page, entity, action, userId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (entity !== 'all') params.set('entity', entity)
      if (action !== 'all') params.set('action', action)
      if (userId !== 'all') params.set('userId', userId)
      const res = await fetch(`/api/admin/audit/export?${params}`)
      if (!res.ok) { toast({ title: 'Erro ao exportar', variant: 'destructive' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `auditoria-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Exportado com sucesso' })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const body: Record<string, unknown> = { mode: deleteDialog.mode }
      if (deleteDialog.mode === 'before') {
        if (!beforeDate) { toast({ title: 'Seleciona uma data', variant: 'destructive' }); return }
        body.before = new Date(beforeDate).toISOString()
      }
      const res = await fetch('/api/admin/audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro ao apagar', variant: 'destructive' }); return }
      toast({ title: `${json.deleted} registos apagados` })
      setDeleteDialog({ open: false, mode: 'all' })
      setPage(1)
      fetchLogs()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Atividade</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tentativas de login (todos os utilizadores) · Ações dos utilizadores não-administradores
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABELS[e] ?? e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>)}
          </SelectContent>
        </Select>

        {users.length > 0 && (
          <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Utilizador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os utilizadores</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {data && (
          <span className="text-sm text-muted-foreground">{data.total} registos</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Exportar JSON
          </Button>
          <Button
            variant="outline" size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteDialog({ open: true, mode: 'before' })}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Apagar antes de...
          </Button>
          <Button
            variant="outline" size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteDialog({ open: true, mode: 'all' })}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Apagar tudo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Utilizador</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ação</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Entidade</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">IP</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">Det.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Sem registos de atividade
                  </td>
                </tr>
              )}
              {data?.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), 'dd/MM/yy HH:mm', { locale: pt })}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[130px] truncate" title={log.userEmail ?? ''}>
                    {log.userEmail ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs hidden sm:table-cell">
                    <span className="font-medium">{ENTITY_LABELS[log.entity] ?? log.entity}</span>
                    {log.entityId && (
                      <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                        {log.entityId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">
                    {log.ip ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDetailsLog(log)}
                      title="Ver detalhes"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-xs text-muted-foreground">Página {data.page} de {data.pages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details dialog */}
      <Dialog open={!!detailsLog} onOpenChange={(o) => !o && setDetailsLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[detailsLog?.action ?? ''] ?? 'bg-gray-100 text-gray-800'}`}>
                {ACTION_LABELS[detailsLog?.action ?? ''] ?? detailsLog?.action}
              </span>
              <span className="text-sm font-medium">{ENTITY_LABELS[detailsLog?.entity ?? ''] ?? detailsLog?.entity}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {detailsLog && format(new Date(detailsLog.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: pt })}
              {detailsLog?.userEmail && ` · ${detailsLog.userEmail}`}
              {detailsLog?.ip && ` · IP: ${detailsLog.ip}`}
            </DialogDescription>
          </DialogHeader>

          {detailsLog && (
            <div className="rounded-lg bg-gray-50 border p-4 space-y-1 text-sm max-h-80 overflow-y-auto">
              {buildDetailLines(detailsLog).map((line, i) =>
                line === '' ? (
                  <div key={i} className="h-2" />
                ) : line.endsWith(':') ? (
                  <p key={i} className="font-semibold text-gray-700 mt-1">{line}</p>
                ) : (
                  <p key={i} className="text-gray-600">{line}</p>
                )
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsLog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog(d => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {deleteDialog.mode === 'all' ? 'Apagar todos os registos' : 'Apagar registos antes de uma data'}
            </DialogTitle>
            <DialogDescription>
              {deleteDialog.mode === 'all'
                ? 'Todos os registos de atividade serão eliminados permanentemente. Esta ação não pode ser revertida.'
                : 'Os registos anteriores à data selecionada serão eliminados permanentemente.'}
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.mode === 'before' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Apagar registos antes de:</label>
              <Input type="date" value={beforeDate} onChange={e => setBeforeDate(e.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(d => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
