'use client'

import Link from 'next/link'
import type { Room } from '@/types'

export function RoomCard({ room }: { room: Room }) {
  const isHot = room.online_count >= 50

  return (
    <Link href={`/room/${room.id}`} className="block group">
      <div className="flex items-center justify-between rounded-xl border border-[#3a3a5c] bg-[#2D2D44] px-5 py-4 transition-all hover:border-[#00F5FF]/50 hover:bg-[#35355a]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[#e2e8f0] truncate group-hover:text-[#00F5FF] transition-colors">
              {room.name}
            </h2>
            {isHot && (
              <span className="flex-shrink-0 rounded-full bg-[#7C4DFF]/30 border border-[#7C4DFF]/50 px-2 py-0.5 text-[10px] font-medium text-[#00F5FF]">
                🔥 Hot
              </span>
            )}
          </div>
          {room.description && (
            <p className="mt-1 text-sm text-[#6b7280] truncate">{room.description}</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-sm font-medium text-[#10b981]">{room.online_count}</span>
          <span className="text-xs text-[#4b5563] hidden sm:inline">online</span>
        </div>
      </div>
    </Link>
  )
}
