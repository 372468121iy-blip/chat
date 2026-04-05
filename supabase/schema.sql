-- ─── EXTENSIONS ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── TABLES ──────────────────────────────────────────────────

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  nickname      text not null,
  avatar        text not null default '👤',
  is_bound      boolean not null default false,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table public.rooms (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text not null default '',
  creator_id    uuid not null references public.users(id) on delete cascade,
  online_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table public.messages (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

create table public.room_members (
  room_id  uuid not null references public.rooms(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  role     text not null check (role in ('member','admin','creator')),
  primary key (room_id, user_id)
);

create table public.mutes (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  muted_by    uuid not null references public.users(id) on delete cascade,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;
alter table public.room_members enable row level security;
alter table public.mutes enable row level security;

-- users
create policy "users_read"   on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (auth.uid() = id);
create policy "users_update" on public.users for update using (auth.uid() = id);

-- rooms
create policy "rooms_read"   on public.rooms for select using (true);
create policy "rooms_insert" on public.rooms for insert with check (auth.uid() is not null);
create policy "rooms_update" on public.rooms for update using (true);

-- messages
create policy "messages_read"   on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (auth.uid() is not null);

-- room_members
create policy "members_read"   on public.room_members for select using (true);
create policy "members_insert" on public.room_members for insert with check (auth.uid() = user_id);
create policy "members_delete" on public.room_members for delete using (auth.uid() is not null);

-- mutes
create policy "mutes_read"   on public.mutes for select using (true);
create policy "mutes_insert" on public.mutes for insert with check (auth.uid() is not null);
create policy "mutes_delete" on public.mutes for delete using (auth.uid() = muted_by);

-- ─── REALTIME ────────────────────────────────────────────────

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.messages;
