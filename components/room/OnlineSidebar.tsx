'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { RoomMember } from '@/types'

type Props = {
  roomId: string
  members: RoomMember[]
  currentUserRole: 'member' | 'admin' | 'creator' | null
  onMembersUpdate: () => void
}

export function OnlineSidebar({ roomId, members, currentUserRole, onMembersUpdate }: Props) {
  const { user } = useAuth()
  const supabase = createClient()
  const canModerate = currentUserRole === 'admin' || currentUserRole === 'creator'

  const muteUser = async (targetUserId: string, duration: number | null) => {
    const expiresAt = duration ? new Date(Date.now() + duration).toISOString() : null
    await supabase.from('mutes').insert({
      room_id: roomId, user_id: targetUserId, muted_by: user?.id, expires_at: expiresAt,
    })
    onMembersUpdate()
  }

  const kickUser = async (targetUserId: string) => {
    await supabase.from('room_members').delete()
      .eq('room_id', roomId).eq('user_id', targetUserId)
    onMembersUpdate()
  }

  const promoteToAdmin = async (targetUserId: string) => {
    await supabase.from('room_members')
      .update({ role: 'admin' })
      .eq('room_id', roomId).eq('user_id', targetUserId)
    onMembersUpdate()
  }

  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4b5563] mb-3">
        Members — {members.length}
      </h3>
      <div className="space-y-1">
        {members.map(member => (
          <MemberRow
            key={member.user_id}
            member={member}
            isCurrentUser={member.user_id === user?.id}
            canModerate={canModerate && member.user_id !== user?.id &&
              (currentUserRole === 'creator' ? member.role !== 'creator' : member.role === 'member')}
            isCreator={currentUserRole === 'creator'}
            onMute={dur => muteUser(member.user_id, dur)}
            onKick={() => kickUser(member.user_id)}
            onPromote={() => promoteToAdmin(member.user_id)}
          />
        ))}
      </div>
    </div>
  )
}

function MemberRow({ member, isCurrentUser, canModerate, isCreator, onMute, onKick, onPromote }: {
  member: RoomMember; isCurrentUser: boolean; canModerate: boolean
  isCreator: boolean; onMute: (d: number | null) => void; onKick: () => void; onPromote: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const roleBadge = member.role === 'creator' ? '👑' : member.role === 'admin' ? '🛡️' : null

  return (
    <div className="relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#2D2D44] group">
      <span className="text-lg">{member.users?.avatar ?? '👤'}</span>
      <span className={`flex-1 text-sm truncate ${isCurrentUser ? 'text-[#00F5FF]' : 'text-[#9ca3af]'}`}>
        {member.users?.nickname ?? 'Unknown'} {isCurrentUser && '(you)'}
      </span>
      {roleBadge && <span className="text-xs">{roleBadge}</span>}
      {canModerate && (
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="opacity-0 group-hover:opacity-100 text-[#4b5563] hover:text-[#9ca3af] text-xs transition-opacity">
          ⋮
        </button>
      )}
      {menuOpen && (
        <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-[#3a3a5c] bg-[#2D2D44] shadow-xl overflow-hidden">
          {[
            { label: '🔇 Mute 5 min', action: () => onMute(5 * 60 * 1000) },
            { label: '🔇 Mute 1 hour', action: () => onMute(60 * 60 * 1000) },
            { label: '🔇 Mute forever', action: () => onMute(null) },
          ].map(item => (
            <button key={item.label} onClick={() => { item.action(); setMenuOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-[#9ca3af] hover:bg-[#3a3a5c]">
              {item.label}
            </button>
          ))}
          <button onClick={() => { onKick(); setMenuOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#3a3a5c]">
            🚫 Kick
          </button>
          {isCreator && member.role === 'member' && (
            <button onClick={() => { onPromote(); setMenuOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-[#00F5FF] hover:bg-[#3a3a5c]">
              🛡️ Make Admin
            </button>
          )}
        </div>
      )}
    </div>
  )
}
