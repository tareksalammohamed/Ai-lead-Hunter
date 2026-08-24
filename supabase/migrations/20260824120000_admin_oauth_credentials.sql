-- Server-only OAuth application credentials managed from the Super Admin UI.
create table if not exists public.admin_oauth_credentials (
  provider text primary key check (provider in ('linkedin', 'facebook')),
  client_id_encrypted text not null,
  client_secret_encrypted text not null,
  client_id_masked text not null default '',
  client_secret_masked text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.admin_oauth_credentials enable row level security;
revoke all on public.admin_oauth_credentials from anon, authenticated;
grant select, insert, update, delete on public.admin_oauth_credentials to service_role;
comment on table public.admin_oauth_credentials is 'Encrypted OAuth application credentials; server-only access through admin-provider-secrets and social-oauth';
