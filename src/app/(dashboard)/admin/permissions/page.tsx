'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { UserPermissionsTable } from '@/components/admin/UserPermissionsTable'
import { PermissionsModal } from '@/components/admin/PermissionsModal'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, KeyRound } from 'lucide-react'

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

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Palavra-passe deve ter pelo menos 6 caracteres'),
})
type CreateUserForm = z.infer<typeof createUserSchema>

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As palavras-passe não coincidem',
  path: ['confirmPassword'],
})
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

export default function AdminPermissionsPage() {
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null)
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithPermissions | null>(null)
  const [resetSaving, setResetSaving] = useState(false)
  const { toast } = useToast()

  const {
    register, handleSubmit, reset, formState: { errors },
  } = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema) })

  const {
    register: registerReset, handleSubmit: handleSubmitReset, reset: resetReset, formState: { errors: errorsReset },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) as any })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/permissions')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openPermissionsModal = (user: UserWithPermissions) => {
    setSelectedUser(user)
    setPermModalOpen(true)
  }

  const openResetPassword = (user: UserWithPermissions) => {
    setResetPasswordUser(user)
    resetReset()
  }

  const onCreateUser = async (data: CreateUserForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Utilizador criado' })
      setCreateUserOpen(false)
      reset()
      fetchUsers()
    } finally { setSaving(false) }
  }

  const onResetPassword = async (data: ResetPasswordForm) => {
    if (!resetPasswordUser) return
    setResetSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: data.password }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
        return
      }
      toast({ title: `Password de ${resetPasswordUser.name} redefinida` })
      setResetPasswordUser(null)
    } finally { setResetSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground hidden sm:block">
          Gerir permissões de acesso dos utilizadores ao sistema.
        </p>
        <Button onClick={() => { reset(); setCreateUserOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Utilizador
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      ) : (
        <UserPermissionsTable
          users={users}
          onEditPermissions={openPermissionsModal}
          onResetPassword={openResetPassword}
        />
      )}

      {selectedUser && (
        <PermissionsModal
          open={permModalOpen}
          onClose={() => setPermModalOpen(false)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          permissions={selectedUser.permissions}
          onSaved={fetchUsers}
        />
      )}

      {/* Create user dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Utilizador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateUser)} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Palavra-passe *</Label>
              <Input type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(o) => !o && setResetPasswordUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Redefinir Password
            </DialogTitle>
          </DialogHeader>
          {resetPasswordUser && (
            <p className="text-sm text-muted-foreground">
              Nova password para <strong>{resetPasswordUser.name}</strong>. A sessão atual deste utilizador será invalidada.
            </p>
          )}
          <form onSubmit={handleSubmitReset(onResetPassword)} className="space-y-3">
            <div className="space-y-1">
              <Label>Nova Password *</Label>
              <Input type="password" {...registerReset('password')} autoFocus />
              {errorsReset.password && <p className="text-xs text-destructive">{errorsReset.password.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Confirmar Password *</Label>
              <Input type="password" {...registerReset('confirmPassword')} />
              {errorsReset.confirmPassword && <p className="text-xs text-destructive">{errorsReset.confirmPassword.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetPasswordUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={resetSaving}>
                {resetSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Redefinir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
