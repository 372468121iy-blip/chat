'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

export function PresenceTracker({ roomId }: { roomId: string }) {
  const { user } = useAuth()
  const didMount = useRef(false)

  useEffect(() => {
    if (!user || didMount.current) return
    didMount.current = true

    const supabase = createClient()

    // Atomic increment when entering
    supabase.rpc('increment_online_count', { room_id: roomId })

    const handleLeave = () => {
      supabase.rpc('decrement_online_count', { room_id: roomId })
    }

    window.addEventListener('beforeunload', handleLeave)
    window.addEventListener('pagehide', handleLeave)

    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      window.removeEventListener('pagehide', handleLeave)
      handleLeave()
      didMount.current = false
    }
  }, [user, roomId])

  return null
}
