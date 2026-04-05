'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomCard } from './RoomCard'
import { CreateRoomModal } from './CreateRoomModal'
import type { Room } from '@/types'

export function RoomList({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        if (payload.eventType === 'INSERT') {
          setRooms(prev => [payload.new as Room, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setRooms(prev => prev.map(r => r.id === (payload.new as Room).id ? payload.new as Room : r))
        } else if (payload.eventType === 'DELETE') {
          setRooms(prev => prev.filter(r => r.id !== (payload.old as Room).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = rooms
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.online_count - a.online_count)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-[#1a1a2e] border border-[#2d2d4e] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] hidden sm:block"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] transition-colors"
        >
          <span className="text-base leading-none">＋</span>
          <span className="hidden sm:inline">Create Room</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-[#4b5563]">
          <p className="text-4xl mb-3">💬</p>
          <p>No rooms yet. Be the first to create one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(room => <RoomCard key={room.id} room={room} />)}
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 sm:hidden h-14 w-14 rounded-full bg-[#7c3aed] text-white text-2xl shadow-lg shadow-[#7c3aed]/30 hover:bg-[#6d28d9] transition-colors flex items-center justify-center"
        aria-label="Create room"
      >
        ＋
      </button>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
