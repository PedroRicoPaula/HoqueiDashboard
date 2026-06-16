import type { ReactNode } from 'react'
import Link from 'next/link'
import { Building2, LogOut } from 'lucide-react'

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-green-700">HoqueiManager</span>
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded">
            Platform Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/platform" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <Building2 className="w-4 h-4" />
            Clubes
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
