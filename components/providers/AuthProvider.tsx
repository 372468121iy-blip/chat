'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { generateNickname, generateAvatar } from '@/lib/utils/generateAnon'
import type { UserProfile } from '@/types'

const PROFILE_KEY = 'anonchat_profile'

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

function saveProfileLocally(p: UserProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

function loadProfileLocally(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Pre-load from localStorage so avatar shows instantly on refresh
  const [profile, setProfileState] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null
    return loadProfileLocally()
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const setProfile = (p: UserProfile | null) => {
    setProfileState(p)
    if (p) saveProfileLocally(p)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          await loadOrCreateProfile(session.user)
        } else {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) console.error('signInAnonymously error:', error)
          if (data.user) await loadOrCreateProfile(data.user)
        }
      } catch (e) {
        console.error('init error:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
        if (data) setProfile(data)
        // If no DB profile yet, keep the localStorage one (set in state init)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadOrCreateProfile = async (authUser: User) => {
    setUser(authUser)
    try {
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

      // Build new profile — reuse locally saved nickname/avatar if same user
      const saved = loadProfileLocally()
      const newProfile = {
        id: authUser.id,
        nickname: (saved?.id === authUser.id ? saved.nickname : null) ?? generateNickname(),
        avatar: (saved?.id === authUser.id ? saved.avatar : null) ?? generateAvatar(),
        is_bound: false,
      }

      const { data, error } = await supabase
        .from('users').insert(newProfile).select().single()

      if (data) {
        setProfile(data)
      } else {
        console.error('Profile insert error:', error)
        // Fallback: keep working with a local-only profile
        setProfile({
          ...newProfile,
          created_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
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
