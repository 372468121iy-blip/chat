'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Message } from '@/types'

type Props = {
  roomId: string
  initialMessages: Message[]
  isMuted: boolean
  onOnlineCountChange?: (count: number) => void
}

export function MessageList({ roomId, initialMessages, isMuted, onOnlineCountChange }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const { user, profile } = useAuth()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user) return
    const supabase = supabaseRef.current
    const channel = supabase.channel(`room-${roomId}`)
    channelRef.current = channel

    // Real-time messages via Broadcast (no publication config needed)
    channel.on('broadcast', { event: 'new-message' }, ({ payload }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === payload.message.id)) return prev
        return [...prev, payload.message]
      })
    })

    // Online count via Presence
    channel.on('presence', { event: 'sync' }, () => {
      const count = Object.keys(channel.presenceState()).length
      onOnlineCountChange?.(count)
      // Also update DB for homepage card
      supabase.rpc('increment_online_count', { room_id: roomId }).then(() => {})
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const trackData = {
          user_id: user.id,
          nickname: profile?.nickname ?? 'Anonymous',
          avatar: profile?.avatar ?? '👤',
        }
        await channel.track(trackData)
      }
    })

    // Reset count on leave
    const handleLeave = () => {
      supabase.rpc('decrement_online_count', { room_id: roomId })
    }
    window.addEventListener('beforeunload', handleLeave)
    window.addEventListener('pagehide', handleLeave)

    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      window.removeEventListener('pagehide', handleLeave)
      handleLeave()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user, roomId])

  // Re-track when profile becomes available
  useEffect(() => {
    if (!profile || !channelRef.current) return
    channelRef.current.track({
      user_id: user?.id,
      nickname: profile.nickname,
      avatar: profile.avatar,
    })
  }, [profile])

  const sendMessage = async (content: string) => {
    if (!user || !profile) return

    const message: Message = {
      id: crypto.randomUUID(),
      room_id: roomId,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      users: { nickname: profile.nickname, avatar: profile.avatar },
    }

    // Show immediately (optimistic update)
    setMessages(prev => [...prev, message])

    // Broadcast to all users in room (real-time)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-message',
      payload: { message },
    })

    // Persist to database
    supabaseRef.current.from('messages').insert({
      id: message.id,
      room_id: roomId,
      user_id: user.id,
      content,
      created_at: message.created_at,
      expires_at: message.expires_at,
    }).then(() => {})
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-[#4b5563] text-sm py-10">No messages yet. Say hello! 👋</p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.user_id === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={sendMessage} disabled={isMuted} />
    </div>
  )
}
