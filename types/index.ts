export type Room = {
  id: string
  name: string
  description: string
  creator_id: string
  online_count: number
  created_at: string
}

export type Message = {
  id: string
  room_id: string
  user_id: string | null
  content: string
  created_at: string
  expires_at: string
  users?: {
    nickname: string
    avatar: string
  } | null
}

export type UserProfile = {
  id: string
  nickname: string
  avatar: string
  is_bound: boolean
  created_at: string
  last_seen_at: string
}

export type RoomMember = {
  room_id: string
  user_id: string
  role: 'member' | 'admin' | 'creator'
  users?: UserProfile
}

export type Mute = {
  id: string
  room_id: string
  user_id: string
  muted_by: string
  expires_at: string | null
  created_at: string
}
