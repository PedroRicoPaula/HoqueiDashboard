'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { useDashT } from '@/hooks/useDashT'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Users, UserCheck, CreditCard, Package, Handshake,
  Plane, Building2, Dumbbell, Settings, LogOut, ClipboardList,
  FileBarChart, ClipboardCheck, Shirt, ChevronDown, Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'

function useNavGroups(t: ReturnType<typeof useDashT>) {
  return [
    {
      id: 'desporto',
      label: t('nav.sport'),
      items: [
        { href: '/athletes',   label: t('nav.athletes'),   icon: Users,          permission: 'viewAthletes' },
        { href: '/fees',       label: t('nav.fees'),       icon: CreditCard,     permission: 'viewFees' },
        { href: '/attendance', label: t('nav.attendance'), icon: ClipboardCheck, permission: 'viewAttendance' },
        { href: '/training',   label: t('nav.training'),   icon: Dumbbell,       permission: 'viewTraining' },
      ],
    },
    {
      id: 'materiais',
      label: t('nav.materialsGroup'),
      items: [
        { href: '/materials', label: t('nav.equipment'), icon: Package, permission: 'viewMaterials' },
        { href: '/textiles',  label: t('nav.textiles'),  icon: Shirt,   permission: 'viewTextiles' },
      ],
    },
    {
      id: 'clube',
      label: t('nav.club'),
      items: [
        { href: '/members',   label: t('nav.members'),   icon: UserCheck, permission: 'viewMembers' },
        { href: '/sponsors',  label: t('nav.sponsors'),  icon: Handshake, permission: 'viewSponsors' },
        { href: '/travel',    label: t('nav.travel'),    icon: Plane,     permission: 'viewTravel' },
        { href: '/direction', label: t('nav.direction'), icon: Building2, permission: 'viewDirection' },
      ],
    },
    {
      id: 'gestao',
      label: t('nav.management'),
      items: [
        { href: '/reports',           label: t('nav.reports'),     icon: FileBarChart,  permission: 'viewAthletes' },
        { href: '/settings',          label: t('nav.settings'),    icon: Settings,      permission: 'isAdmin' },
        { href: '/admin/permissions', label: t('nav.permissions'), icon: Settings,      permission: 'isAdmin' },
        { href: '/admin/audit',       label: t('nav.activity'),    icon: ClipboardList, permission: 'isAdmin' },
      ],
    },
  ]
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { can, isAdmin } = usePermissions()
  const { user, logout } = useAuthStore()
  const { open, close } = useSidebarStore()
  const { toast } = useToast()
  const t = useDashT()

  const NAV_GROUPS = useNavGroups(t)

  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => { setPendingHref(null) }, [pathname])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return { desporto: true, materiais: true, clube: true, gestao: true }
    try {
      const stored = localStorage.getItem('sidebar-groups')
      return stored ? JSON.parse(stored) : { desporto: true, materiais: true, clube: true, gestao: true }
    } catch {
      return { desporto: true, materiais: true, clube: true, gestao: true }
    }
  })

  useEffect(() => {
    for (const group of NAV_GROUPS) {
      const isActive = group.items.some((item) => pathname.startsWith(item.href))
      if (isActive && !openGroups[group.id]) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('sidebar-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    logout()
    router.push('/login')
    toast({ title: t('nav.logout') })
  }

  const isItemVisible = (permission: string | null) => {
    if (!permission) return true
    if (isAdmin) return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return can(permission as any)
  }

  const isItemActive = (href: string) => pathname.startsWith(href)

  const clubName = user?.clubName ?? 'HoqueiManager'
  const clubLogo = user?.clubLogoUrl ?? null

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-64 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]',
        'fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Club branding */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        {clubLogo ? (
          <Image
            src={clubLogo}
            alt={clubName}
            width={36}
            height={36}
            className="rounded-full flex-shrink-0 object-contain"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{clubName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate text-white">{clubName}</p>
          <p className="text-xs text-white/50 leading-tight">{t('nav.manage')}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        <Link
          href="/"
          onClick={() => { setPendingHref('/'); close() }}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isItemActive('/')
              ? 'bg-[hsl(var(--club-yellow))] text-black font-semibold'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
        >
          {pendingHref === '/'
            ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
            : <LayoutDashboard className="h-4 w-4 flex-shrink-0" />}
          {t('nav.dashboard')}
        </Link>

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => isItemVisible(item.permission))
          if (visibleItems.length === 0) return null

          const groupHasActive = visibleItems.some((item) => isItemActive(item.href))
          const isOpen = openGroups[group.id]

          return (
            <div key={group.id} className="pt-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                  groupHasActive ? 'text-white/90' : 'text-white/40 hover:text-white/70'
                )}
              >
                <span>{group.label}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen ? 'rotate-0' : '-rotate-90')} />
              </button>

              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const active = isItemActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setPendingHref(item.href); close() }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ml-1',
                          active
                            ? 'bg-[hsl(var(--club-yellow))] text-black font-semibold'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        )}
                      >
                        {pendingHref === item.href
                          ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                          : <Icon className="h-4 w-4 flex-shrink-0" />}
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name ?? 'Utilizador'}</p>
            <p className="text-xs text-white/50 truncate">{user?.email ?? ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t('nav.logout')}
        </Button>
      </div>
    </aside>
  )
}
