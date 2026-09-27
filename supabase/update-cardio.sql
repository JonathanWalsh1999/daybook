-- Daybook update: cardio logging (run once in Supabase → SQL Editor)
alter table public.workout_sets
  add column if not exists kind         text not null default 'weights' check (kind in ('weights','cardio')),
  add column if not exists duration_min numeric(6,1),
  add column if not exists distance_km  numeric(7,2);
