'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const bindEmail = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ email: email.trim() })
    if (err) { setError(err.message); setLoading(false); return }
    if (user) await supabase.from('users').update({ is_bound: true }).eq('id', user.id)
    setEmailSent(true)
    setLoading(false)
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-[calc(100vh-56px)]">
      <p className="text-[#4b5563]">Loading…</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-[#6b7280] hover:text-[#00F5FF] text-lg">←</Link>
        <h1 className="text-xl font-bold text-[#00F5FF]">Your Profile</h1>
      </div>

      <div className="mb-6 rounded-2xl border border-[#3a3a5c] bg-[#2D2D44] p-6 flex items-center gap-4">
        <span className="text-5xl">{profile.avatar}</span>
        <div>
          <p className="font-semibold text-[#e2e8f0]">{profile.nickname}</p>
          <p className="text-sm text-[#6b7280] mt-0.5">
            {profile.is_bound ? '✅ Account linked' : '⚠️ Anonymous — not linked'}
          </p>
        </div>
      </div>

      {!profile.is_bound ? (
        <div className="rounded-2xl border border-[#3a3a5c] bg-[#2D2D44] p-6">
          <h2 className="font-semibold text-[#e2e8f0] mb-1">Link your account</h2>
          <p className="text-sm text-[#6b7280] mb-5">
            Link an email to return as the same person from any device. Your nickname stays the same.
          </p>
          {emailSent ? (
            <div className="rounded-xl bg-[#064e3b]/40 border border-[#10b981]/30 px-4 py-3 text-sm text-[#10b981]">
              ✅ Check your inbox — click the link to confirm your email.
            </div>
          ) : (
            <>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[#0A0A0F] border border-[#3a3a5c] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#00F5FF] mb-3"
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button
                onClick={bindEmail}
                disabled={!email.trim() || loading}
                className="w-full rounded-lg bg-[#7C4DFF] py-2.5 text-sm font-semibold text-white hover:bg-[#6B3FE0] disabled:opacity-40 transition-colors"
              >
                {loading ? 'Sending…' : 'Send verification email'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#10b981]/30 bg-[#064e3b]/20 p-5 text-sm text-[#10b981]">
          ✅ Your account is linked. You can return as this identity from any device.
        </div>
      )}

      <p className="mt-8 text-xs text-center text-[#4b5563]">
        {profile.is_bound
          ? 'Your data will be kept as long as your account is active.'
          : 'Anonymous accounts without a link are deleted after 5 days of inactivity.'}
      </p>
    </div>
  )
}
