'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

export function PresenceTracker({ roomId }: { roomId: string }) {
  const { user, profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!user || !profile) return

    const channel = supabase.channel(`presence-${roomId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const count = Object.keys(channel.presenceState()).length
        supabase.from('rooms').update({ online_count: count }).eq('id', roomId)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, nickname: profile.nickname })
        }
      })

    return () => { channel.untrack().then(() => supabase.removeChannel(channel)) }
  }, [user, profile, roomId])

  return null
}
