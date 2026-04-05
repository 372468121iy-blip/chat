'use client'

import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'

export function Navbar() {
  const { profile, loading } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-[#3a3a5c] bg-[#0A0A0F]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-[#00F5FF] tracking-tight hover:text-[#00E5EE] transition-colors">
          ⚡ Maskchat
        </Link>

        <div className="flex items-center gap-3">
          {!loading && profile && (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg bg-[#2D2D44] border border-[#3a3a5c] px-3 py-1.5 text-sm hover:border-[#00F5FF] transition-colors"
            >
              <span className="text-base">{profile.avatar}</span>
              <span className="hidden sm:block text-[#9ca3af] max-w-[140px] truncate">
                {profile.nickname}
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
