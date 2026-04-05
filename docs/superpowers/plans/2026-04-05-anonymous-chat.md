# Anonymous Chat Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a fully-functional anonymous real-time chat website — dark cyberpunk UI, mobile-responsive, zero-registration entry, user-created rooms, Supabase Realtime messaging, and optional account binding.

**Architecture:** Next.js 14 (App Router) on Vercel. Supabase provides PostgreSQL database, anonymous Auth, Realtime WebSocket broadcast, and Presence for online counts. Anonymous users get auto-assigned nicknames + emoji avatars via `signInAnonymously()`; optional email/phone binding upgrades their session. Messages retained 30 days via `pg_cron`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v3, `@supabase/supabase-js` v2, `@supabase/ssr`, Node.js 18+

---

## File Map

```
chat/
├── app/
│   ├── layout.tsx                  # Root layout, dark bg, AuthProvider wrapper
│   ├── globals.css                 # Tailwind base + custom scrollbar styles
│   ├── page.tsx                    # Homepage: room list, real-time counts
│   ├── room/[id]/
│   │   └── page.tsx                # Chat room page
│   └── profile/
│       └── page.tsx                # Profile: bind email / phone
├── components/
│   ├── layout/
│   │   └── Navbar.tsx              # Top bar: logo, search, user avatar
│   ├── home/
│   │   ├── RoomList.tsx            # Real-time room list container
│   │   ├── RoomCard.tsx            # Single room list item
│   │   └── CreateRoomModal.tsx     # Modal to create a new room
│   ├── room/
│   │   ├── MessageList.tsx         # Scrollable message history
│   │   ├── MessageBubble.tsx       # Single message bubble
│   │   ├── MessageInput.tsx        # Fixed-bottom input box
│   │   └── OnlineSidebar.tsx       # Online users + admin controls
│   └── providers/
│       └── AuthProvider.tsx        # Supabase auth state, anon sign-in
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client (singleton)
│   │   └── server.ts               # Server Supabase client (SSR cookies)
│   └── utils/
│       └── generateAnon.ts         # Random nickname + avatar generator
├── types/
│   └── index.ts                    # Shared TypeScript types
├── supabase/
│   └── schema.sql                  # Full DB schema + RLS + pg_cron
├── middleware.ts                   # Supabase auth session refresh
├── .env.local                      # Secrets (not committed)
└── .env.example                    # Template for env vars
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `chat/` (Next.js project root)
- Create: `.env.example`
- Create: `.gitignore` addition

- [ ] **Step 1: Verify Node.js is installed**

Run:
```powershell
node --version
npm --version
```
Expected: Node 18+ and npm 9+. If missing, download from https://nodejs.org (LTS version).

- [ ] **Step 2: Scaffold Next.js project in the workspace folder**

```powershell
cd C:\Users\Administrator\Desktop\chat
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

When prompted:
- `Would you like to use src/ directory?` → No  
- `Would you like to customize the default import alias?` → No (press Enter)

- [ ] **Step 3: Install Supabase packages**

```powershell
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 4: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Verify dev server starts**

```powershell
npm run dev
```
Open http://localhost:3000 — should see default Next.js page. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```powershell
git init
git add .
git commit -m "feat: scaffold Next.js 14 + Tailwind + Supabase packages"
```

---

## Task 2: GitHub Repository + Vercel Deploy

**Files:** None (platform config)

- [ ] **Step 1: Create GitHub repository**

Go to https://github.com/new — create a **public** repo named `chat` (no README, no .gitignore).

- [ ] **Step 2: Push to GitHub**

```powershell
git remote add origin https://github.com/YOUR_USERNAME/chat.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Deploy to Vercel**

Go to https://vercel.com/new → Import the `chat` GitHub repo → click **Deploy**.  
Vercel will auto-detect Next.js. Deployment takes ~1 minute.  
You'll get a live URL like `chat-xyz.vercel.app`. Note it down.

---

## Task 3: Supabase Project Setup

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New Project → choose a region close to your users → set a database password → Create.  
Wait ~2 minutes for provisioning.

- [ ] **Step 2: Enable Anonymous Auth**

In Supabase dashboard → **Authentication** → **Providers** → scroll to **Anonymous** → toggle ON → Save.

- [ ] **Step 3: Create schema.sql**

Create file `supabase/schema.sql`:

```sql
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;

-- ─── TABLES ────────────────────────────────────────────────

create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  avatar      text not null default '👤',
  is_bound    boolean not null default false,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.rooms (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text not null default '',
  creator_id   uuid not null references public.users(id) on delete cascade,
  online_count integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.messages (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid references public.users(id) on delete set null,
  content    text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role    text not null check (role in ('member','admin','creator')),
  primary key (room_id, user_id)
);

create table public.mutes (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  muted_by   uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;
alter table public.room_members enable row level security;
alter table public.mutes enable row level security;

-- users: anyone can read; only owner can update
create policy "users_read" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (auth.uid() = id);
create policy "users_update" on public.users for update using (auth.uid() = id);

-- rooms: anyone can read; any authenticated user can create
create policy "rooms_read" on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (auth.uid() is not null);
create policy "rooms_update" on public.rooms for update using (true); -- online_count update via server

-- messages: anyone can read; authenticated users can insert
create policy "messages_read" on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (auth.uid() is not null);

-- room_members: anyone can read; authenticated users can insert their own
create policy "members_read" on public.room_members for select using (true);
create policy "members_insert" on public.room_members for insert with check (auth.uid() = user_id);

-- mutes: anyone can read; admins/creator can insert (enforced in app logic)
create policy "mutes_read" on public.mutes for select using (true);
create policy "mutes_insert" on public.mutes for insert with check (auth.uid() is not null);
create policy "mutes_delete" on public.mutes for delete using (auth.uid() = muted_by);

-- ─── REALTIME ───────────────────────────────────────────────

-- Allow realtime subscriptions on rooms and messages
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.messages;

-- ─── AUTO CLEANUP (pg_cron) ─────────────────────────────────

-- Delete expired messages daily at 3am UTC
select cron.schedule(
  'delete-expired-messages',
  '0 3 * * *',
  $$delete from public.messages where expires_at < now()$$
);

-- Delete unbound users inactive for 5+ days (and cascade their data)
select cron.schedule(
  'delete-unbound-users',
  '0 4 * * *',
  $$delete from auth.users
    where id in (
      select id from public.users
      where is_bound = false
      and last_seen_at < now() - interval '5 days'
    )$$
);
```

- [ ] **Step 4: Run schema in Supabase SQL Editor**

In Supabase dashboard → **SQL Editor** → New query → paste the full contents of `supabase/schema.sql` → Run.  
All statements should succeed with no errors.

- [ ] **Step 5: Get API keys**

In Supabase dashboard → **Settings** → **API**:
- Copy **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 6: Add env vars locally**

Create `.env.local` (never commit this file):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-key...
```

- [ ] **Step 7: Add env vars to Vercel**

In Vercel dashboard → your project → **Settings** → **Environment Variables** → add both vars from step 6 → Save → **Redeploy**.

- [ ] **Step 8: Commit schema**

```powershell
git add supabase/schema.sql .env.example
git commit -m "feat: add database schema, RLS policies, pg_cron cleanup"
```

---

## Task 4: Supabase Client Utilities + Types

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `types/index.ts`
- Create: `lib/utils/generateAnon.ts`

- [ ] **Step 1: Create browser Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create middleware for session refresh**

Create `middleware.ts` in project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Create shared TypeScript types**

Create `types/index.ts`:

```typescript
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
```

- [ ] **Step 5: Create random nickname + avatar generator**

Create `lib/utils/generateAnon.ts`:

```typescript
const adjectives = [
  'Silent', 'Midnight', 'Shadow', 'Crystal', 'Neon', 'Storm',
  'Phantom', 'Ghost', 'Digital', 'Cyber', 'Void', 'Dark',
  'Blazing', 'Wild', 'Lost', 'Hidden', 'Frozen', 'Solar',
]

const nouns = [
  'Fox', 'Wolf', 'Raven', 'Hawk', 'Dragon', 'Tiger',
  'Panda', 'Cat', 'Bear', 'Eagle', 'Shark', 'Phoenix',
  'Viper', 'Cobra', 'Lynx', 'Owl', 'Crow', 'Falcon',
]

const avatars = [
  '🦊', '🐺', '🐼', '🦅', '🐉', '🦁', '🐯', '🌙',
  '⚡', '🔥', '❄️', '🌊', '👾', '🤖', '🎭', '🦋',
  '🐦‍⬛', '🦚', '🐸', '🦝',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateNickname(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${pick(adjectives)} ${pick(nouns)} #${num}`
}

export function generateAvatar(): string {
  return pick(avatars)
}
```

- [ ] **Step 6: Commit**

```powershell
git add lib/ middleware.ts types/
git commit -m "feat: add Supabase clients, middleware, types, anon generator"
```

---

## Task 5: Root Layout + Dark Theme + Navbar

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/layout/Navbar.tsx`
- Create: `components/providers/AuthProvider.tsx`

- [ ] **Step 1: Update globals.css**

Replace `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0f0f1a;
  --bg-card: #1a1a2e;
  --bg-card-hover: #1e1e35;
  --border: #2d2d4e;
  --accent: #a78bfa;
  --accent-bright: #c4b5fd;
  --green: #10b981;
  --pink: #f472b6;
  --text-muted: #6b7280;
}

* { box-sizing: border-box; }

body {
  background-color: var(--bg-primary);
  color: #e2e8f0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #4b5563; }
```

- [ ] **Step 2: Create AuthProvider**

Create `components/providers/AuthProvider.tsx`:

```typescript
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
      // Get existing session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        await loadOrCreateProfile(session.user)
      } else {
        // Sign in anonymously — zero friction
        const { data, error } = await supabase.auth.signInAnonymously()
        if (data.user) {
          await loadOrCreateProfile(data.user)
        }
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

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (existing) {
      setProfile(existing)
      // Update last_seen_at
      await supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', authUser.id)
    } else {
      // Create new profile with random identity
      const newProfile = {
        id: authUser.id,
        nickname: generateNickname(),
        avatar: generateAvatar(),
        is_bound: false,
      }
      const { data } = await supabase.from('users').insert(newProfile).select().single()
      if (data) setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 3: Create Navbar**

Create `components/layout/Navbar.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'

export function Navbar() {
  const { profile, loading } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-[#2d2d4e] bg-[#0f0f1a]/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-[#a78bfa] tracking-tight hover:text-[#c4b5fd] transition-colors">
          ⚡ AnonChat
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Search icon (mobile) */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6b7280] hover:text-[#a78bfa] hover:bg-[#1a1a2e] transition-colors sm:hidden"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            🔍
          </button>

          {/* User avatar */}
          {!loading && profile && (
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg bg-[#1a1a2e] border border-[#2d2d4e] px-3 py-1.5 text-sm hover:border-[#a78bfa] transition-colors"
            >
              <span className="text-base">{profile.avatar}</span>
              <span className="hidden sm:block text-[#9ca3af] max-w-[140px] truncate">
                {profile.nickname}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile search bar (expands below nav) */}
      {searchOpen && (
        <div className="border-t border-[#2d2d4e] px-4 py-2">
          <input
            type="text"
            placeholder="Search rooms..."
            className="w-full rounded-lg bg-[#1a1a2e] border border-[#2d2d4e] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa]"
          />
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: Update root layout**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Navbar } from '@/components/layout/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AnonChat — Anonymous Chat Rooms',
  description: 'Jump into any chat room instantly. No signup, no tracking.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0f0f1a]`}>
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Test locally**

```powershell
npm run dev
```
Open http://localhost:3000 — should see dark navbar with "⚡ AnonChat" logo and a user avatar (auto-signed in anonymously). Check Supabase dashboard → **Authentication** → **Users** — a new anonymous user should appear.

- [ ] **Step 6: Commit**

```powershell
git add app/ components/
git commit -m "feat: dark layout, AuthProvider with anonymous sign-in, Navbar"
```

---

## Task 6: Homepage — Room List

**Files:**
- Modify: `app/page.tsx`
- Create: `components/home/RoomList.tsx`
- Create: `components/home/RoomCard.tsx`
- Create: `components/home/CreateRoomModal.tsx`

- [ ] **Step 1: Create RoomCard component**

Create `components/home/RoomCard.tsx`:

```typescript
'use client'

import Link from 'next/link'
import type { Room } from '@/types'

export function RoomCard({ room }: { room: Room }) {
  const isHot = room.online_count >= 50

  return (
    <Link href={`/room/${room.id}`} className="block group">
      <div className="flex items-center justify-between rounded-xl border border-[#2d2d4e] bg-[#1a1a2e] px-5 py-4 transition-all hover:border-[#a78bfa]/50 hover:bg-[#1e1e35]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[#e2e8f0] truncate group-hover:text-[#c4b5fd] transition-colors">
              {room.name}
            </h2>
            {isHot && (
              <span className="flex-shrink-0 rounded-full bg-[#7c3aed]/30 border border-[#7c3aed]/50 px-2 py-0.5 text-[10px] font-medium text-[#c4b5fd]">
                🔥 Hot
              </span>
            )}
          </div>
          {room.description && (
            <p className="mt-1 text-sm text-[#6b7280] truncate">{room.description}</p>
          )}
        </div>

        <div className="ml-4 flex-shrink-0 flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-sm font-medium text-[#10b981]">{room.online_count}</span>
          <span className="text-xs text-[#4b5563] hidden sm:inline">online</span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Create CreateRoomModal**

Create `components/home/CreateRoomModal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

type Props = { onClose: () => void; onCreated: () => void }

export function CreateRoomModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim() || !user) return
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('rooms')
      .insert({ name: name.trim(), description: description.trim(), creator_id: user.id })
      .select()
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    // Insert creator as 'creator' in room_members
    await supabase.from('room_members').insert({ room_id: data.id, user_id: user.id, role: 'creator' })

    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2d2d4e] bg-[#1a1a2e] p-6">
        <h2 className="text-lg font-bold text-[#c4b5fd] mb-5">Create a Room</h2>

        <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-1">
          Room Name <span className="text-[#f472b6]">*</span>
        </label>
        <input
          type="text"
          maxLength={30}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Late Night Insomnia"
          className="w-full rounded-lg bg-[#0f0f1a] border border-[#2d2d4e] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] mb-4"
        />

        <label className="block text-xs font-medium text-[#9ca3af] uppercase tracking-wide mb-1">
          Description
        </label>
        <input
          type="text"
          maxLength={100}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this room about?"
          className="w-full rounded-lg bg-[#0f0f1a] border border-[#2d2d4e] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] mb-5"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#2d2d4e] py-2.5 text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 rounded-lg bg-[#7c3aed] py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-40 transition-colors"
          >
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create RoomList (with real-time subscription)**

Create `components/home/RoomList.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoomCard } from './RoomCard'
import { CreateRoomModal } from './CreateRoomModal'
import type { Room } from '@/types'

export function RoomList({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to real-time changes on rooms table (online_count updates, new rooms)
    const channel = supabase
      .channel('rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
        if (payload.eventType === 'INSERT') {
          setRooms(prev => [payload.new as Room, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setRooms(prev =>
            prev.map(r => r.id === (payload.new as Room).id ? (payload.new as Room) : r)
          )
        } else if (payload.eventType === 'DELETE') {
          setRooms(prev => prev.filter(r => r.id !== (payload.old as Room).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = rooms
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.online_count - a.online_count)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header row */}
      <div className="mb-5 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-[#1a1a2e] border border-[#2d2d4e] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] hidden sm:block"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] transition-colors"
        >
          <span className="text-base leading-none">＋</span>
          <span className="hidden sm:inline">Create Room</span>
        </button>
      </div>

      {/* Room list */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-[#4b5563]">
          <p className="text-4xl mb-3">💬</p>
          <p>No rooms yet. Be the first to create one!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(room => <RoomCard key={room.id} room={room} />)}
        </div>
      )}

      {/* Floating create button (mobile) */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 sm:hidden h-14 w-14 rounded-full bg-[#7c3aed] text-white text-2xl shadow-lg shadow-[#7c3aed]/30 hover:bg-[#6d28d9] transition-colors flex items-center justify-center"
        aria-label="Create room"
      >
        ＋
      </button>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {}} // rooms update via realtime subscription
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update homepage**

Replace `app/page.tsx`:

```typescript
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
```

- [ ] **Step 5: Test locally**

```powershell
npm run dev
```
Open http://localhost:3000 — should see empty room list with "Create Room" button. Create a room — it should appear instantly. On mobile size (browser devtools responsive mode) — floating "＋" button should appear at bottom-right.

- [ ] **Step 6: Commit**

```powershell
git add app/page.tsx components/home/
git commit -m "feat: homepage room list with real-time updates and create room modal"
```

---

## Task 7: Chat Room Page + Real-time Messaging

**Files:**
- Create: `app/room/[id]/page.tsx`
- Create: `components/room/MessageList.tsx`
- Create: `components/room/MessageBubble.tsx`
- Create: `components/room/MessageInput.tsx`
- Create: `components/room/OnlineSidebar.tsx`

- [ ] **Step 1: Create MessageBubble**

Create `components/room/MessageBubble.tsx`:

```typescript
import type { Message } from '@/types'

type Props = {
  message: Message
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: Props) {
  const nickname = message.users?.nickname ?? 'Deleted User'
  const avatar = message.users?.avatar ?? '👤'
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="flex-shrink-0 text-xl leading-none mt-1">{avatar}</div>
      <div className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280]">{isOwn ? 'You' : nickname}</span>
          <span className="text-[10px] text-[#4b5563]">{time}</span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-[#7c3aed] text-white rounded-tr-sm'
              : 'bg-[#1a1a2e] border border-[#2d2d4e] text-[#e2e8f0] rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MessageInput**

Create `components/room/MessageInput.tsx`:

```typescript
'use client'

import { useState } from 'react'

type Props = { onSend: (content: string) => Promise<void>; disabled?: boolean }

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const content = value.trim()
    if (!content || sending || disabled) return
    setSending(true)
    await onSend(content)
    setValue('')
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[#2d2d4e] bg-[#0f0f1a] px-4 py-3">
      {disabled && (
        <p className="mb-2 text-center text-xs text-red-400">You are muted in this room.</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none rounded-xl bg-[#1a1a2e] border border-[#2d2d4e] px-4 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] disabled:opacity-40 max-h-32"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending || disabled}
          className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#7c3aed] text-white disabled:opacity-40 hover:bg-[#6d28d9] transition-colors flex items-center justify-center"
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MessageList**

Create `components/room/MessageList.tsx`:

```typescript
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
}

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
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async payload => {
        const newMsg = payload.new as Message
        // Fetch user info for the new message
        const { data: userRow } = await supabase
          .from('users')
          .select('nickname, avatar')
          .eq('id', newMsg.user_id)
          .single()
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
    <div className="flex flex-col h-full">
      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-[#4b5563] text-sm py-10">No messages yet. Say hello! 👋</p>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.user_id === user?.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} disabled={isMuted} />
    </div>
  )
}
```

- [ ] **Step 4: Create OnlineSidebar**

Create `components/room/OnlineSidebar.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'
import type { RoomMember } from '@/types'

type Props = {
  roomId: string
  members: RoomMember[]
  currentUserRole: 'member' | 'admin' | 'creator' | null
  onMembersUpdate: () => void
}

export function OnlineSidebar({ roomId, members, currentUserRole, onMembersUpdate }: Props) {
  const { user } = useAuth()
  const supabase = createClient()
  const canModerate = currentUserRole === 'admin' || currentUserRole === 'creator'

  const muteUser = async (targetUserId: string, duration: number | null) => {
    const expiresAt = duration ? new Date(Date.now() + duration).toISOString() : null
    await supabase.from('mutes').insert({
      room_id: roomId,
      user_id: targetUserId,
      muted_by: user?.id,
      expires_at: expiresAt,
    })
    onMembersUpdate()
  }

  const kickUser = async (targetUserId: string) => {
    await supabase.from('room_members').delete()
      .eq('room_id', roomId).eq('user_id', targetUserId)
    onMembersUpdate()
  }

  const promoteToAdmin = async (targetUserId: string) => {
    await supabase.from('room_members')
      .update({ role: 'admin' })
      .eq('room_id', roomId).eq('user_id', targetUserId)
    onMembersUpdate()
  }

  const onlineMembers = members.filter(m => m.users)

  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4b5563] mb-3">
        Online — {onlineMembers.length}
      </h3>
      <div className="space-y-1">
        {onlineMembers.map(member => (
          <MemberRow
            key={member.user_id}
            member={member}
            isCurrentUser={member.user_id === user?.id}
            canModerate={canModerate && currentUserRole === 'creator'
              ? member.role !== 'creator'
              : canModerate && member.role === 'member'}
            onMute={(dur) => muteUser(member.user_id, dur)}
            onKick={() => kickUser(member.user_id)}
            onPromote={() => promoteToAdmin(member.user_id)}
            isCreator={currentUserRole === 'creator'}
          />
        ))}
      </div>
    </div>
  )
}

function MemberRow({ member, isCurrentUser, canModerate, onMute, onKick, onPromote, isCreator }: {
  member: RoomMember
  isCurrentUser: boolean
  canModerate: boolean
  onMute: (duration: number | null) => void
  onKick: () => void
  onPromote: () => void
  isCreator: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const roleBadge = member.role === 'creator' ? '👑' : member.role === 'admin' ? '🛡️' : null

  return (
    <div className="relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#1a1a2e] group">
      <span className="text-lg">{member.users?.avatar ?? '👤'}</span>
      <span className={`flex-1 text-sm truncate ${isCurrentUser ? 'text-[#a78bfa]' : 'text-[#9ca3af]'}`}>
        {member.users?.nickname ?? 'Unknown'} {isCurrentUser && '(you)'}
      </span>
      {roleBadge && <span className="text-xs">{roleBadge}</span>}

      {canModerate && !isCurrentUser && (
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="opacity-0 group-hover:opacity-100 text-[#4b5563] hover:text-[#9ca3af] text-xs transition-opacity"
        >
          ⋮
        </button>
      )}

      {menuOpen && (
        <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-[#2d2d4e] bg-[#1a1a2e] shadow-xl overflow-hidden">
          <button onClick={() => { onMute(5 * 60 * 1000); setMenuOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-[#9ca3af] hover:bg-[#2d2d4e]">
            🔇 Mute 5 min
          </button>
          <button onClick={() => { onMute(60 * 60 * 1000); setMenuOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-[#9ca3af] hover:bg-[#2d2d4e]">
            🔇 Mute 1 hour
          </button>
          <button onClick={() => { onMute(null); setMenuOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-[#9ca3af] hover:bg-[#2d2d4e]">
            🔇 Mute forever
          </button>
          <button onClick={() => { onKick(); setMenuOpen(false) }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2d2d4e]">
            🚫 Kick
          </button>
          {isCreator && member.role === 'member' && (
            <button onClick={() => { onPromote(); setMenuOpen(false) }}
              className="w-full px-4 py-2 text-left text-sm text-[#a78bfa] hover:bg-[#2d2d4e]">
              🛡️ Make Admin
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create chat room page**

Create `app/room/[id]/page.tsx`:

```typescript
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

  const activeMutes = user ? await supabase
    .from('mutes')
    .select('*')
    .eq('room_id', params.id)
    .eq('user_id', user.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`) : null

  const isMuted = (activeMutes?.data?.length ?? 0) > 0

  return (
    <RoomPageClient
      room={room as Room}
      initialMessages={(messages as Message[]) ?? []}
      initialMembers={(members as RoomMember[]) ?? []}
      currentUserRole={currentMember?.role ?? null}
      isMuted={isMuted}
    />
  )
}
```

- [ ] **Step 6: Create RoomPageClient**

Create `app/room/[id]/RoomPageClient.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageList } from '@/components/room/MessageList'
import { OnlineSidebar } from '@/components/room/OnlineSidebar'
import type { Message, Room, RoomMember } from '@/types'

type Props = {
  room: Room
  initialMessages: Message[]
  initialMembers: RoomMember[]
  currentUserRole: 'member' | 'admin' | 'creator' | null
  isMuted: boolean
}

export function RoomPageClient({ room, initialMessages, initialMembers, currentUserRole, isMuted }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Room header */}
      <div className="flex items-center gap-3 border-b border-[#2d2d4e] bg-[#0f0f1a]/90 px-4 py-3 backdrop-blur-sm">
        <Link href="/" className="text-[#6b7280] hover:text-[#a78bfa] transition-colors text-lg">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-[#e2e8f0] truncate">{room.name}</h1>
          {room.description && (
            <p className="text-xs text-[#6b7280] truncate">{room.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-sm text-[#10b981] font-medium">{room.online_count}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6b7280] hover:text-[#a78bfa] hover:bg-[#1a1a2e] transition-colors"
            aria-label="Online users"
          >
            👥
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MessageList
            roomId={room.id}
            initialMessages={initialMessages}
            isMuted={isMuted}
          />
        </div>

        {/* Sidebar — hidden by default on mobile, shown on lg screens */}
        <div className={`
          ${sidebarOpen ? 'flex' : 'hidden'}
          lg:flex w-60 flex-shrink-0 flex-col border-l border-[#2d2d4e] bg-[#0f0f1a]
          fixed right-0 top-14 bottom-0 z-40
          lg:relative lg:top-auto lg:bottom-auto lg:z-auto
        `}>
          <OnlineSidebar
            roomId={room.id}
            members={members}
            currentUserRole={currentUserRole}
            onMembersUpdate={() => {}}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Test locally**

```powershell
npm run dev
```
- Create a room from homepage → click it → should see chat room with message input
- Send a message → should appear instantly
- Open in two browser tabs → message sent in one should appear in the other in real-time

- [ ] **Step 8: Commit**

```powershell
git add app/room/ components/room/
git commit -m "feat: chat room page with real-time messaging and admin sidebar"
```

---

## Task 8: Online Presence (Real-time User Count)

**Files:**
- Create: `components/room/PresenceTracker.tsx`
- Modify: `app/room/[id]/RoomPageClient.tsx`

- [ ] **Step 1: Create PresenceTracker**

Create `components/room/PresenceTracker.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/AuthProvider'

type Props = { roomId: string }

export function PresenceTracker({ roomId }: Props) {
  const { user, profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!user || !profile) return

    const channel = supabase.channel(`presence-${roomId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const count = Object.keys(state).length
        // Update online_count in DB (any client can do this; Supabase handles concurrency)
        supabase.from('rooms').update({ online_count: count }).eq('id', roomId)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, nickname: profile.nickname, avatar: profile.avatar })
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [user, profile, roomId])

  return null // No UI — runs silently
}
```

- [ ] **Step 2: Add PresenceTracker to RoomPageClient**

In `app/room/[id]/RoomPageClient.tsx`, add import and render inside the component:

```typescript
// Add import at top:
import { PresenceTracker } from '@/components/room/PresenceTracker'

// Add inside return, just before closing </div>:
<PresenceTracker roomId={room.id} />
```

- [ ] **Step 3: Test presence**

Open the same room in 2 different browser tabs → online count in room header and homepage card should both update in real-time when tabs are opened/closed.

- [ ] **Step 4: Commit**

```powershell
git add components/room/PresenceTracker.tsx app/room/
git commit -m "feat: Supabase Presence tracking with real-time online_count updates"
```

---

## Task 9: Profile Page (Bind Email / Phone)

**Files:**
- Create: `app/profile/page.tsx`

- [ ] **Step 1: Create profile page**

Create `app/profile/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
    setEmailSent(true)
    setLoading(false)
    // Mark account as bound
    if (user) await supabase.from('users').update({ is_bound: true }).eq('id', user.id)
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-[#6b7280] hover:text-[#a78bfa] text-lg">←</Link>
        <h1 className="text-xl font-bold text-[#c4b5fd]">Your Profile</h1>
      </div>

      {/* Identity card */}
      <div className="mb-6 rounded-2xl border border-[#2d2d4e] bg-[#1a1a2e] p-6 flex items-center gap-4">
        <span className="text-5xl">{profile.avatar}</span>
        <div>
          <p className="font-semibold text-[#e2e8f0]">{profile.nickname}</p>
          <p className="text-sm text-[#6b7280] mt-0.5">
            {profile.is_bound ? '✅ Account linked' : '⚠️ Anonymous — not linked'}
          </p>
        </div>
      </div>

      {!profile.is_bound && (
        <div className="rounded-2xl border border-[#2d2d4e] bg-[#1a1a2e] p-6">
          <h2 className="font-semibold text-[#e2e8f0] mb-1">Link your account</h2>
          <p className="text-sm text-[#6b7280] mb-5">
            Link an email so you can return as the same person from any device. Your nickname stays the same.
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
                className="w-full rounded-lg bg-[#0f0f1a] border border-[#2d2d4e] px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4b5563] outline-none focus:border-[#a78bfa] mb-3"
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button
                onClick={bindEmail}
                disabled={!email.trim() || loading}
                className="w-full rounded-lg bg-[#7c3aed] py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-40 transition-colors"
              >
                {loading ? 'Sending…' : 'Send verification email'}
              </button>
            </>
          )}
        </div>
      )}

      {profile.is_bound && (
        <div className="rounded-2xl border border-[#10b981]/30 bg-[#064e3b]/20 p-5 text-sm text-[#10b981]">
          ✅ Your account is linked. You can return as this identity from any device by logging in.
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
```

- [ ] **Step 2: Enable Email Auth in Supabase**

In Supabase dashboard → **Authentication** → **Providers** → **Email** → ensure it is enabled. Under **Email Templates** you can optionally customize the confirmation email.

- [ ] **Step 3: Test profile page**

```powershell
npm run dev
```
Click the user avatar in navbar → should go to `/profile`. Enter an email address and click "Send verification email". Check that a confirmation email arrives (may go to spam folder during development).

- [ ] **Step 4: Commit**

```powershell
git add app/profile/
git commit -m "feat: profile page with email binding via Supabase Auth"
```

---

## Task 10: Push to Vercel + Auto-Deploy

**Files:** None (git operations)

- [ ] **Step 1: Push all commits to GitHub**

```powershell
git push origin main
```

- [ ] **Step 2: Verify Vercel auto-deploys**

Open your Vercel dashboard — it should show a new deployment triggered automatically. Wait ~1 minute. Click the deployment URL and test on both desktop and mobile browser.

- [ ] **Step 3: Smoke test on live URL**

- Homepage loads with dark theme ✅
- Can create a room ✅
- Can enter a room and send a message ✅
- Online count updates when opening/closing tabs ✅
- Profile page works ✅
- Mobile layout looks correct ✅

---

## Task 11: Custom Domain (Optional)

**Files:** None (platform config)

- [ ] **Step 1: Buy a domain on GoDaddy**

Go to https://godaddy.com → search for your desired domain (e.g. `anonchat.chat`, `freetalks.app`) → purchase.

- [ ] **Step 2: Add domain to Vercel**

In Vercel dashboard → your project → **Settings** → **Domains** → Add domain → enter your domain name.

Vercel will show you DNS records to configure.

- [ ] **Step 3: Configure DNS in GoDaddy**

In GoDaddy dashboard → your domain → **DNS** → add the records Vercel shows:
- **Type A** record pointing to Vercel's IP, or
- **CNAME** record pointing to `cname.vercel-dns.com`

DNS propagation takes 5–30 minutes.

- [ ] **Step 4: Verify HTTPS**

Once DNS propagates, visit your domain — Vercel auto-issues an SSL certificate. The site should load at `https://yourdomain.com`.

---

## Spec Coverage Check

| Spec Requirement | Implemented In |
|---|---|
| Dark cyberpunk UI | Task 5 (globals.css, layout.tsx) |
| List layout sorted by online count | Task 6 (RoomList.tsx) |
| Cards: name, description, online count | Task 6 (RoomCard.tsx) |
| Hot badge (≥50 online) | Task 6 (RoomCard.tsx) |
| Auto random nickname + avatar | Task 4 (generateAnon.ts) |
| Supabase anonymous sign-in | Task 5 (AuthProvider.tsx) |
| Optional email binding | Task 9 (profile/page.tsx) |
| Unbound user deleted after 5 days | Task 3 (schema.sql pg_cron) |
| User-created rooms | Task 6 (CreateRoomModal.tsx) |
| Real-time messaging | Task 7 (MessageList.tsx) |
| Messages retained 30 days | Task 3 (schema.sql expires_at + pg_cron) |
| Real-time online count (homepage) | Tasks 8 + 6 (PresenceTracker + RoomList subscription) |
| Creator appoints admins | Task 7 (OnlineSidebar.tsx promoteToAdmin) |
| Mute users (5min / 1hr / forever) | Task 7 (OnlineSidebar.tsx muteUser) |
| Kick users | Task 7 (OnlineSidebar.tsx kickUser) |
| Mobile responsive | Tasks 5–9 (Tailwind responsive classes) |
| Default language English | All UI text in English |
| Vercel deployment | Task 2, Task 10 |
| Custom domain | Task 11 |
