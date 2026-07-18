'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ShieldCheck, Shield, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface UserWithPermissions {
  id: string
  name: string
  email: string
  createdAt: string
  lastLoginAt?: string | null
  permissions: {
    id: string
    userId: string
    isAdmin: boolean
    viewAthletes: boolean
    editAthletes: boolean
    viewFees: boolean
    editFees: boolean
    viewMembers: boolean
    editMembers: boolean
    viewMaterials: boolean
    editMaterials: boolean
    viewSponsors: boolean
    manageSponsors: boolean
    viewTraining: boolean
    editTraining: boolean
    viewTravel: boolean
    editTravel: boolean
    viewDirection: boolean
    editDirection: boolean
    viewAttendance: boolean
    editAttendance: boolean
    viewTextiles: boolean
    editTextiles: boolean
  } | null
}

interface UserPermissionsTableProps {
  users: UserWithPermissions[]
  onEditPermissions: (user: UserWithPermissions) => void
  onResetPassword: (user: UserWithPermissions) => void
}

function PermBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${enabled ? 'bg-yellow-400' : 'bg-gray-300'}`} />
  )
}

function formatLoginDate(dt?: string | null) {
  if (!dt) return <span className="text-xs text-muted-foreground">Nunca</span>
  const d = new Date(dt)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return <span className="text-xs text-emerald-600">Hoje</span>
  if (diffDays === 1) return <span className="text-xs text-muted-foreground">Ontem</span>
  if (diffDays < 7) return <span className="text-xs text-muted-foreground">{diffDays}d atrás</span>
  return <span className="text-xs text-muted-foreground">{d.toLocaleDateString('pt-PT')}</span>
}

export function UserPermissionsTable({ users, onEditPermissions, onResetPassword }: UserPermissionsTableProps) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilizador</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="hidden sm:table-cell">Atletas</TableHead>
            <TableHead className="hidden md:table-cell">Mensalidades</TableHead>
            <TableHead className="hidden md:table-cell">Sócios</TableHead>
            <TableHead className="hidden lg:table-cell">Materiais</TableHead>
            <TableHead className="hidden lg:table-cell">Treinos</TableHead>
            <TableHead className="hidden xl:table-cell">Último Login</TableHead>
            <TableHead className="w-44">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const p = u.permissions
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {p?.isAdmin ? (
                    <Badge className="bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                      <ShieldCheck className="h-3 w-3" />Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Shield className="h-3 w-3" />Utilizador
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex gap-1 items-center">
                    <PermBadge enabled={p?.viewAthletes ?? false} />
                    <PermBadge enabled={p?.editAthletes ?? false} />
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex gap-1 items-center">
                    <PermBadge enabled={p?.viewFees ?? false} />
                    <PermBadge enabled={p?.editFees ?? false} />
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex gap-1 items-center">
                    <PermBadge enabled={p?.viewMembers ?? false} />
                    <PermBadge enabled={p?.editMembers ?? false} />
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex gap-1 items-center">
                    <PermBadge enabled={p?.viewMaterials ?? false} />
                    <PermBadge enabled={p?.editMaterials ?? false} />
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex gap-1 items-center">
                    <PermBadge enabled={p?.viewTraining ?? false} />
                    <PermBadge enabled={p?.editTraining ?? false} />
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {formatLoginDate(u.lastLoginAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditPermissions(u)}
                    >
                      Permissões
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={u.id === currentUserId ? 'Usa "Mudar palavra-passe" no teu perfil' : 'Redefinir password'}
                      disabled={u.id === currentUserId}
                      onClick={() => onResetPassword(u)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
