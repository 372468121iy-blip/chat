'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

type Props = { onClose: () => void }

export function CreateRoomModal({ onClose }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim() || !user) return
    setLoading(true)
    setError('')

    try {
      // Ensure user profile exists before creating room (guards against race condition)
      const { data: existingProfile } = await supabase
        .from('users').select('id').eq('id', user.id).single()

      if (!existingProfile) {
        const { generateNickname, generateAvatar } = await import('@/lib/utils/generateAnon')
        const { error: profileErr } = await supabase.from('users').insert({
          id: user.id,
          nickname: generateNickname(),
          avatar: generateAvatar(),
          is_bound: false,
        })
        if (profileErr) { setError('Profile error: ' + profileErr.message); setLoading(false); return }
      }

      const { data, error: roomErr } = await supabase
        .from('rooms')
        .insert({ name: name.trim(), description: description.trim(), creator_id: user.id })
        .select()
        .single()

      if (roomErr) { setError('Room error: ' + roomErr.message); setLoading(false); return }

      const { error: memberErr } = await supabase.from('room_members').insert({
        room_id: data.id, user_id: user.id, role: 'creator'
      })

      if (memberErr) { setError('Member error: ' + memberErr.message); setLoading(false); return }

      setLoading(false)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2d2d4e] bg-[#1a1a2e] p-6">
        <h2 className="text-lg font-bold text-[#c4b5fd] mb-5">Create a Room</h2>

        <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-1">
          Room Name <span className="text-[#f472b6]">*</span>
        </label>
        <input
          type="text"
          maxLength={30}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Late Night Insomnia"
          className="w-full rounded-lg bg-[#0f0f1a] border border-[#2d2d4e] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] mb-4"
        />

        <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-1">
          Description
        </label>
        <input
          type="text"
          maxLength={100}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this room about?"
          className="w-full rounded-lg bg-[#0f0f1a] border border-[#2d2d4e] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] mb-5"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-[#2d2d4e] py-2.5 text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || loading}
            className="flex-1 rounded-lg bg-[#7c3aed] py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-40 transition-colors">
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
