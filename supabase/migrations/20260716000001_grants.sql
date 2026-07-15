-- Ensure API roles can use the game logging tables

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select on table public.game_sessions to anon, authenticated;
grant select on table public.game_turns to anon, authenticated;

grant all on table public.game_sessions to service_role, postgres;
grant all on table public.game_turns to service_role, postgres;

grant usage, select on all sequences in schema public to service_role, postgres;
