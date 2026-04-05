import { createClient } from '@/lib/supabase/server'
import { RoomList } from '@/components/home/RoomList'
import type { Room } from '@/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .order('online_count', { ascending: false })

  return <RoomList initialRooms={(rooms as Room[]) ?? []} />
}
