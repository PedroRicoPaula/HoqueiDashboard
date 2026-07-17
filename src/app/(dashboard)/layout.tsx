'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSidebarStore } from '@/store/sidebarStore'
import { useAuthStore } from '@/store/authStore'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { open, close } = useSidebarStore()
  const pathname = usePathname()
  const clubPrimaryColor = useAuthStore((s) => s.user?.clubPrimaryColor)

  useEffect(() => { close() }, [pathname, close])

  const primaryHsl = clubPrimaryColor ?? '142 71% 45%'
  const isDark = (() => {
    const l = parseFloat(primaryHsl.split(' ')[2] ?? '45')
    return l < 55
  })()

  return (
    <div
      className="flex h-screen overflow-hidden bg-gray-50"
      style={{
        '--club-primary': primaryHsl,
        '--club-primary-fg': isDark ? '0 0% 100%' : '0 0% 5%',
        '--sidebar-active': primaryHsl,
        '--sidebar-active-fg': isDark ? '0 0% 100%' : '0 0% 5%',
      } as React.CSSProperties}
    >
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50 overscroll-contain">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
