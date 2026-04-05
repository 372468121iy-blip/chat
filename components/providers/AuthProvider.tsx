'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { generateNickname, generateAvatar } from '@/lib/utils/generateAnon'
import type { UserProfile } from '@/types'

type AuthContextType = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await loadOrCreateProfile(session.user)
      } else {
        const { data } = await supabase.auth.signInAnonymously()
        if (data.user) await loadOrCreateProfile(data.user)
      }
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
        if (data) setProfile(data)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadOrCreateProfile = async (authUser: User) => {
    setUser(authUser)
    try {
      // Try to load existing profile
      const { data: existing } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()

      if (existing) {
        setProfile(existing)
        supabase.from('users')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', authUser.id)
          .then(() => {})
        return
      }

      // Create new profile — retry once on failure
      const newProfile = {
        id: authUser.id,
        nickname: generateNickname(),
        avatar: generateAvatar(),
        is_bound: false,
      }

      const { data, error } = await supabase
        .from('users').insert(newProfile).select().single()

      if (data) {
        setProfile(data)
      } else {
        console.error('Profile insert error:', error)
        // Fallback: set a local profile so UI is not broken
        setProfile({ ...newProfile, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
      }
    } catch (e) {
      console.error('loadOrCreateProfile error:', e)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
