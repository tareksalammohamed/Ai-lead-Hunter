alter table public.admin_search_providers
  add column if not exists api_key_encrypted text;

comment on column public.admin_search_providers.api_key_encrypted is 'Encrypted search provider API key; never expose to clients.';

revoke select (api_key_encrypted) on public.admin_search_providers from authenticated;

create index if not exists admin_search_providers_name_idx on public.admin_search_providers (lower(name));

update public.admin_search_providers
set api_key_encrypted = null
where api_key_encrypted = '';

-- Keep existing RLS and admin-only policies; Edge Functions use the service role for secret operations.

notify pgrst, 'reload schema';

-- Search-provider secret operations are handled by admin-provider-secrets Edge Function.
-- This migration intentionally does not copy or expose any plaintext key.

-- End of migration.

-- Add a stable uniqueness guard for seeded provider names if absent.
create unique index if not exists admin_search_providers_name_unique_idx on public.admin_search_providers (lower(name));

-- No plaintext API keys are introduced by this migration.

-- Deployment marker.
comment on table public.admin_search_providers is 'Admin search providers with encrypted API key storage.';

-- Final schema refresh.
notify pgrst, 'reload schema';

-- Safe no-op marker.
select 1;

-- Done.

-- Note: the final SELECT is harmless in migration execution.

-- EOF

