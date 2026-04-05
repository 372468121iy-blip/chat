'use client'

import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'

export function Navbar() {
  const { profile, loading } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-[#2d2d4e] bg-[#0f0f1a]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-[#a78bfa] tracking-tight hover:text-[#c4b5fd] transition-colors">
          ⚡ AnonChat
        </Link>

        <div className="flex items-center gap-3">
          {!loading && profile && (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg bg-[#1a1a2e] border border-[#2d2d4e] px-3 py-1.5 text-sm hover:border-[#a78bfa] transition-colors"
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
