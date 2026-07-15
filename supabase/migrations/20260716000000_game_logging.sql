-- The Box: past game sessions + turns + image storage

create extension if not exists "pgcrypto";

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  title text not null default 'Untitled box',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.game_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  turn_index integer not null,
  mode text not null check (mode in ('default', 'addition')),
  prompt text,
  history jsonb not null default '[]'::jsonb,
  image_path text,
  image_public_url text,
  revised_prompt text,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index if not exists game_sessions_updated_at_idx
  on public.game_sessions (updated_at desc);

create index if not exists game_turns_session_id_idx
  on public.game_turns (session_id, turn_index);

create or replace function public.set_game_session_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.game_sessions
  set updated_at = now()
  where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists game_turns_touch_session on public.game_turns;
create trigger game_turns_touch_session
  after insert on public.game_turns
  for each row
  execute function public.set_game_session_updated_at();

-- Storage bucket for generated box photos
insert into storage.buckets (id, name, public)
values ('box-images', 'box-images', true)
on conflict (id) do update set public = excluded.public;

-- Public read for gallery; writes go through service role on the API server
drop policy if exists "Public read box images" on storage.objects;
create policy "Public read box images"
  on storage.objects for select
  using (bucket_id = 'box-images');

-- Anon can read game history (public gallery style app)
alter table public.game_sessions enable row level security;
alter table public.game_turns enable row level security;

drop policy if exists "Anyone can read game sessions" on public.game_sessions;
create policy "Anyone can read game sessions"
  on public.game_sessions for select
  using (true);

drop policy if exists "Anyone can read game turns" on public.game_turns;
create policy "Anyone can read game turns"
  on public.game_turns for select
  using (true);

-- Inserts/updates only via service role (bypasses RLS) from the Express API
