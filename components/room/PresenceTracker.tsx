'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

export function PresenceTracker({ roomId }: { roomId: string }) {
  const { user } = useAuth()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (!user || trackedRef.current) return
    trackedRef.current = true

    const supabase = createClient()
    const channelName = `presence-room-${roomId}`

    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const count = Object.keys(channel.presenceState()).length
        supabase
          .from('rooms')
          .update({ online_count: count })
          .eq('id', roomId)
          .then(({ error }) => { if (error) console.error('online_count update error:', error) })
      })
      .subscribe(async (status) => {
        console.log('Presence channel status:', status)
        if (status === 'SUBSCRIBED') {
          const trackResult = await channel.track({ user_id: user.id })
          console.log('Track result:', trackResult)
        }
      })

    // Also increment on enter, decrement on leave as fallback
    supabase.from('rooms').select('online_count').eq('id', roomId).single()
      .then(({ data }) => {
        const current = data?.online_count ?? 0
        supabase.from('rooms').update({ online_count: current + 1 }).eq('id', roomId).then(() => {})
      })

    const handleLeave = () => {
      supabase.from('rooms').select('online_count').eq('id', roomId).single()
        .then(({ data }) => {
          const current = data?.online_count ?? 1
          supabase.from('rooms').update({ online_count: Math.max(0, current - 1) }).eq('id', roomId).then(() => {})
        })
    }

    window.addEventListener('beforeunload', handleLeave)

    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      handleLeave()
      supabase.removeChannel(channel)
      trackedRef.current = false
    }
  }, [user, roomId])

  return null
}
