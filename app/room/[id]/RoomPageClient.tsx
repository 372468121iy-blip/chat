'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageList } from '@/components/room/MessageList'
import { OnlineSidebar } from '@/components/room/OnlineSidebar'
import { PresenceTracker } from '@/components/room/PresenceTracker'
import type { Message, Room, RoomMember } from '@/types'

type Props = {
  room: Room
  initialMessages: Message[]
  initialMembers: RoomMember[]
  currentUserRole: 'member' | 'admin' | 'creator' | null
  isMuted: boolean
}

export function RoomPageClient({ room, initialMessages, initialMembers, currentUserRole, isMuted }: Props) {
  const [members] = useState(initialMembers)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center gap-3 border-b border-[#2d2d4e] bg-[#0f0f1a]/90 px-4 py-3 backdrop-blur-sm">
        <Link href="/" className="text-[#6b7280] hover:text-[#a78bfa] transition-colors text-lg">←</Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[#e2e8f0] truncate">{room.name}</h1>
          {room.description && <p className="text-xs text-[#6b7280] truncate">{room.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-sm text-[#10b981] font-medium">{room.online_count}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6b7280] hover:text-[#a78bfa] hover:bg-[#1a1a2e] transition-colors"
          >
            👥
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <MessageList roomId={room.id} initialMessages={initialMessages} isMuted={isMuted} />
        </div>
        <div className={`
          ${sidebarOpen ? 'flex' : 'hidden'} lg:flex
          w-60 flex-shrink-0 flex-col border-l border-[#2d2d4e] bg-[#0f0f1a]
          fixed right-0 top-14 bottom-0 z-40
          lg:relative lg:top-auto lg:bottom-auto lg:z-auto
        `}>
          <OnlineSidebar
            roomId={room.id}
            members={members}
            currentUserRole={currentUserRole}
            onMembersUpdate={() => {}}
          />
        </div>
      </div>

      <PresenceTracker roomId={room.id} />
    </div>
  )
}
