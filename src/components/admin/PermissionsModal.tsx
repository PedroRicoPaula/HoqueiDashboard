'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/authStore'
import { Loader2, ShieldAlert } from 'lucide-react'

interface UserPermissions {
  id: string
  userId: string
  viewAthletes: boolean
  editAthletes: boolean
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
  viewFees: boolean
  editFees: boolean
  viewAttendance: boolean
  editAttendance: boolean
  viewTextiles: boolean
  editTextiles: boolean
  isAdmin: boolean
}

interface PermissionsModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userName: string
  permissions: UserPermissions | null
  onSaved: () => void
}

const PERMISSION_GROUPS = [
  {
    label: 'Atletas',
    view: 'viewAthletes' as keyof UserPermissions,
    edit: 'editAthletes' as keyof UserPermissions,
  },
  {
    label: 'Mensalidades',
    view: 'viewFees' as keyof UserPermissions,
    edit: 'editFees' as keyof UserPermissions,
  },
  {
    label: 'Sócios',
    view: 'viewMembers' as keyof UserPermissions,
    edit: 'editMembers' as keyof UserPermissions,
  },
  {
    label: 'Materiais',
    view: 'viewMaterials' as keyof UserPermissions,
    edit: 'editMaterials' as keyof UserPermissions,
  },
  {
    label: 'Patrocinadores',
    view: 'viewSponsors' as keyof UserPermissions,
    edit: 'manageSponsors' as keyof UserPermissions,
  },
  {
    label: 'Treinos',
    view: 'viewTraining' as keyof UserPermissions,
    edit: 'editTraining' as keyof UserPermissions,
  },
  {
    label: 'Viagens',
    view: 'viewTravel' as keyof UserPermissions,
    edit: 'editTravel' as keyof UserPermissions,
  },
  {
    label: 'Direção',
    view: 'viewDirection' as keyof UserPermissions,
    edit: 'editDirection' as keyof UserPermissions,
  },
  {
    label: 'Assiduidades',
    view: 'viewAttendance' as keyof UserPermissions,
    edit: 'editAttendance' as keyof UserPermissions,
  },
  {
    label: 'Materiais Têxteis',
    view: 'viewTextiles' as keyof UserPermissions,
    edit: 'editTextiles' as keyof UserPermissions,
  },
]

export function PermissionsModal({
  open, onClose, userId, userName, permissions, onSaved,
}: PermissionsModalProps) {
  const { toast } = useToast()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isSelf = userId === currentUserId
  const [saving, setSaving] = useState(false)
  const [perms, setPerms] = useState<Record<string, boolean>>(
    permissions
      ? {
          viewAthletes: permissions.viewAthletes,
          editAthletes: permissions.editAthletes,
          viewFees: permissions.viewFees,
          editFees: permissions.editFees,
          viewMembers: permissions.viewMembers,
          editMembers: permissions.editMembers,
          viewMaterials: permissions.viewMaterials,
          editMaterials: permissions.editMaterials,
          viewSponsors: permissions.viewSponsors,
          manageSponsors: permissions.manageSponsors,
          viewTraining: permissions.viewTraining,
          editTraining: permissions.editTraining,
          viewTravel: permissions.viewTravel,
          editTravel: permissions.editTravel,
          viewDirection: permissions.viewDirection,
          editDirection: permissions.editDirection,
          viewAttendance: permissions.viewAttendance,
          editAttendance: permissions.editAttendance,
          viewTextiles: permissions.viewTextiles,
          editTextiles: permissions.editTextiles,
          isAdmin: permissions.isAdmin,
        }
      : {}
  )

  const toggle = (key: string) => {
    if (key === 'isAdmin' && isSelf) return // não se pode auto-remover admin — ver PUT .../route.ts
    setPerms((prev) => {
      const newVal = !prev[key]
      const updates: Record<string, boolean> = { [key]: newVal }
      // Enabling edit → also enable view
      if (newVal) {
        const group = PERMISSION_GROUPS.find((g) => (g.edit as string) === key)
        if (group) updates[group.view as string] = true
      }
      // Disabling view → also disable edit
      if (!newVal) {
        const group = PERMISSION_GROUPS.find((g) => (g.view as string) === key)
        if (group) updates[group.edit as string] = false
      }
      return { ...prev, ...updates }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/permissions/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perms),
      })
      if (res.ok) {
        toast({ title: 'Permissões atualizadas' })
        onSaved()
        onClose()
      } else {
        const json = await res.json()
        toast({ title: 'Erro', description: json.error, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões - {userName}</DialogTitle>
        </DialogHeader>

        {/* Admin toggle */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <div>
                <Label className="text-sm font-semibold text-red-700">Administrador</Label>
                <p className="text-xs text-red-500">
                  {isSelf ? 'Não pode remover admin da sua própria conta' : 'Acesso total a todas as funcionalidades'}
                </p>
              </div>
            </div>
            <Switch
              checked={perms.isAdmin ?? false}
              disabled={isSelf}
              onCheckedChange={() => toggle('isAdmin')}
            />
          </div>
        </div>

        {!perms.isAdmin && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground pb-2 px-1">
                <span>Módulo</span>
                <span className="text-center">Ver</span>
                <span className="text-center">Editar</span>
              </div>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="grid grid-cols-3 gap-2 items-center py-2 px-1 rounded hover:bg-gray-50">
                  <span className="text-sm font-medium">{group.label}</span>
                  <div className="flex justify-center">
                    <Switch
                      checked={perms[group.view as string] ?? false}
                      onCheckedChange={() => toggle(group.view as string)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={perms[group.edit as string] ?? false}
                      onCheckedChange={() => toggle(group.edit as string)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
