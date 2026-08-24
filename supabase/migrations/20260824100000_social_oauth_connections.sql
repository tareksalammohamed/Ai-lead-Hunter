-- Secure OAuth state and connection metadata for LinkedIn and Meta/Facebook.
-- OAuth states are server-only and are consumed once by the social-oauth Edge Function.

create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  provider text not null check (provider in ('linkedin','facebook')),
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_states_lookup_idx
  on public.oauth_states (state_hash, provider, expires_at);

alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;
grant select, insert, update, delete on public.oauth_states to service_role;

-- The proxy already relies on this denormalized code when executing a connection.
alter table public.source_connections
  add column if not exists source_code text;
alter table public.source_connections
  add column if not exists external_account_id text;

update public.source_connections sc
set source_code = s.code
from public.sources s
where sc.source_id = s.id and (sc.source_code is null or sc.source_code = '');

create index if not exists source_connections_user_source_idx
  on public.source_connections (user_id, source_id);
create unique index if not exists source_connections_external_account_idx
  on public.source_connections (user_id, source_code, external_account_id)
  where external_account_id is not null;

-- OAuth connections use the same server-only encrypted secret store as API-key connections.
-- Keep the legacy credentials column empty for all new and updated connections.
comment on column public.source_connections.credentials_encrypted is
  'AES-GCM encrypted provider credentials; never expose to anon/authenticated clients';
comment on table public.oauth_states is
  'Single-use server-only OAuth CSRF state records';
