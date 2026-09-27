-- =====================================================================
-- Daybook: database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Every row belongs to the logged-in user (user_id), and row-level
-- security means each person can only ever read or change their own rows.
-- =====================================================================

-- ---------- Goals & plans -------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  area         text not null default 'personal',       -- personal, freelance, gym, money, house
  target_date  date,
  status       text not null default 'active' check (status in ('active','done','dropped')),
  created_at   timestamptz not null default now()
);

create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id     uuid not null references public.goals on delete cascade,
  title       text not null,
  sort_order  int  not null default 0,
  done        boolean not null default false,
  done_at     timestamptz
);

-- ---------- Tasks (house, admin, personal, freelance…) --------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  area        text not null default 'personal',
  due_date    date,
  goal_id     uuid references public.goals on delete set null,
  done        boolean not null default false,
  done_at     timestamptz,
  times_moved int not null default 0,                  -- powers "what slipped" in the weekly review
  created_at  timestamptz not null default now()
);

-- ---------- Habits ---------------------------------------------------
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id  uuid not null references public.habits on delete cascade,
  log_date  date not null default current_date,
  unique (habit_id, log_date)
);

-- ---------- Gym ------------------------------------------------------
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text,                                    -- e.g. "Leg day"
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text
);

create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id  uuid not null references public.workouts on delete cascade,
  exercise    text not null,                           -- e.g. "Back squat"
  set_number  int  not null,
  weight_kg   numeric(6,2),
  reps        int,
  kind        text not null default 'weights' check (kind in ('weights','cardio')),
  duration_min numeric(6,1),                           -- cardio
  distance_km  numeric(7,2),                           -- cardio
  created_at  timestamptz not null default now()
);

-- ---------- Money ----------------------------------------------------
create table if not exists public.expense_categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  monthly_budget  numeric(10,2),
  sort_order      int not null default 0,
  unique (user_id, name)
);

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  spent_on      date not null default current_date,
  amount        numeric(10,2) not null check (amount >= 0),
  category_id   uuid references public.expense_categories on delete set null,
  description   text,
  is_recurring  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- Freelance ------------------------------------------------
create table if not exists public.work_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  session_on  date not null default current_date,
  minutes     int  not null check (minutes > 0),
  kind        text not null default 'full' check (kind in ('full','minimum','volunteer')),
  project     text,                                    -- e.g. "Case study 2", "Portfolio"
  next_step   text,                                    -- the sticky note for next time
  notes       text,
  created_at  timestamptz not null default now()
);

-- Planned days off (weekends away) so they don't count as misses
create table if not exists public.days_off (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  off_date date not null,
  reason   text,
  unique (user_id, off_date)
);

-- ---------- Weekly review --------------------------------------------
create table if not exists public.weekly_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  week_start   date not null,                          -- the Monday of that week
  went_well    text,
  slipped      text,
  commitments  text[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------- Reminders (e.g. Monday 6.15pm "home → 1 hour at the PC") -
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  weekday     int  not null check (weekday between 1 and 7),   -- 1 = Monday
  remind_at   time not null,
  active      boolean not null default true
);

-- ---------- Indexes for the common "this week / this month" lookups --
create index if not exists tasks_user_due_idx        on public.tasks (user_id, done, due_date);
create index if not exists habit_logs_user_date_idx  on public.habit_logs (user_id, log_date);
create index if not exists workouts_user_start_idx   on public.workouts (user_id, started_at);
create index if not exists workout_sets_workout_idx  on public.workout_sets (workout_id);
create index if not exists expenses_user_date_idx    on public.expenses (user_id, spent_on);
create index if not exists work_sessions_user_idx    on public.work_sessions (user_id, session_on);
create index if not exists milestones_goal_idx       on public.milestones (goal_id);

-- ---------- Security: only you can see your rows ----------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals','milestones','tasks','habits','habit_logs','workouts','workout_sets',
    'expense_categories','expenses','work_sessions','days_off','weekly_reviews','reminders'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    -- logged-in users can use the table (still limited to their own rows by the policy);
    -- logged-out visitors get nothing at all
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Done. The app fills in your starter habits, budget categories and the
-- Monday reminder the first time you log in.
