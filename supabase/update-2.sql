-- =====================================================================
-- Daybook update 2: town, breaks, policies, notifications (+ cardio)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- =====================================================================

-- Cardio (same as update-cardio.sql; harmless if already run)
alter table public.workout_sets
  add column if not exists kind         text not null default 'weights' check (kind in ('weights','cardio')),
  add column if not exists duration_min numeric(6,1),
  add column if not exists distance_km  numeric(7,2);

-- Your town + settings (one row per person)
create table if not exists public.profiles (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  town_name      text,
  seen_level     int  not null default -1,
  seen_buildings text[] not null default '{}',
  theme          text not null default 'light',
  notify         jsonb not null default '{"gym": true, "weekly": true, "tasks": false, "max2": true, "quiet_paused": true}',
  created_at     timestamptz not null default now()
);

-- Breaks: ill, holiday, rest days. Streaks freeze and targets shrink while on a break.
create table if not exists public.breaks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  kind        text not null default 'rest' check (kind in ('ill','holiday','rest')),
  start_date  date not null default current_date,
  end_date    date,                                   -- null = "I'll say when"
  created_at  timestamptz not null default now()
);

-- Policies: rules you enact for your town
create table if not exists public.policies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  kind        text not null,
  title       text not null,
  params      jsonb not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Phone notifications
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  key         text not null,
  sent_on     date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists breaks_user_idx on public.breaks (user_id, start_date);
create index if not exists policies_user_idx on public.policies (user_id);
create index if not exists notification_log_user_idx on public.notification_log (user_id, sent_on);

-- Security: only you can see your rows
do $$
declare t text;
begin
  foreach t in array array['profiles','breaks','policies','push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- The notification log is only written by the server
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
