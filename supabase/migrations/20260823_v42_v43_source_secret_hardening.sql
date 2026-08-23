-- Source connection secrets are now encrypted and server-only.
create table if not exists public.source_connection_secrets (
  connection_id uuid primary key references public.source_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  credentials_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.source_connection_secrets enable row level security;
revoke all on public.source_connection_secrets from anon, authenticated;
grant select,insert,update,delete on public.source_connection_secrets to service_role;
alter table public.source_connections add column if not exists credentials_encrypted text;
-- Production migration cleared any plaintext source credentials.
