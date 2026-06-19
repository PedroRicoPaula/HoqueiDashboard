'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { useDashT } from '@/hooks/useDashT'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { LogOut, KeyRound, User, Menu } from 'lucide-react'

function usePageTitle(t: ReturnType<typeof useDashT>) {
  const PAGE_TITLES: Record<string, string> = {
    '/': t('nav.dashboard'),
    '/athletes': t('nav.athletes'),
    '/fees': t('nav.fees'),
    '/attendance': t('nav.attendance'),
    '/training': t('nav.training'),
    '/members': t('nav.members'),
    '/materials': t('nav.equipment'),
    '/textiles': t('nav.textiles'),
    '/sponsors': t('nav.sponsors'),
    '/travel': t('nav.travel'),
    '/direction': t('nav.direction'),
    '/reports': t('nav.reports'),
    '/settings': t('nav.settings'),
    '/admin/permissions': t('nav.permissions'),
    '/admin/audit': t('nav.activity'),
  }
  return PAGE_TITLES
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { toggle } = useSidebarStore()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const t = useDashT()

  const pageTitles = usePageTitle(t)

  const getTitle = (path: string): string => {
    if (pageTitles[path]) return pageTitles[path]
    for (const [key, title] of Object.entries(pageTitles)) {
      if (key !== '/' && path.startsWith(key)) return title
    }
    return 'HoqueiManager'
  }

  const title = getTitle(pathname)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logout()
    router.push('/login')
  }

  return (
    <>
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggle}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base lg:text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                {t('auth.changePassword')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                {t('nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  )
}
