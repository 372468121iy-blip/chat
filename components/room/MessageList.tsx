'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { useAuth } from '@/components/providers/AuthProvider'
import type { Message } from '@/types'

type Props = { roomId: string; initialMessages: Message[]; isMuted: boolean }

export function MessageList({ roomId, initialMessages, isMuted }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async payload => {
        const newMsg = payload.new as Message
        const { data: userRow } = await supabase
          .from('users').select('nickname, avatar').eq('id', newMsg.user_id).single()
        setMessages(prev => [...prev, { ...newMsg, users: userRow }])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  const sendMessage = async (content: string) => {
    if (!user) return
    await supabase.from('messages').insert({ room_id: roomId, user_id: user.id, content })
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
