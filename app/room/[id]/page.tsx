import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoomPageClient } from './RoomPageClient'
import type { Message, Room, RoomMember } from '@/types'

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: room } = await supabase.from('rooms').select('*').eq('id', params.id).single()
  if (!room) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*, users(nickname, avatar)')
    .eq('room_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: members } = await supabase
    .from('room_members')
    .select('*, users(nickname, avatar)')
    .eq('room_id', params.id)

  const currentMember = members?.find(m => m.user_id === user?.id)

  const now = new Date().toISOString()
  const { data: activeMutes } = user
    ? await supabase.from('mutes').select('id')
        .eq('room_id', params.id).eq('user_id', user.id)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
    : { data: [] }

  return (
    <RoomPageClient
      room={room as Room}
      initialMessages={(messages as Message[]) ?? []}
      initialMembers={(members as RoomMember[]) ?? []}
      currentUserRole={currentMember?.role ?? null}
      isMuted={(activeMutes?.length ?? 0) > 0}
    />
  )
}
