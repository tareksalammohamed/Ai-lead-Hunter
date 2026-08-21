-- Provider key management: encrypted values are written only by the admin Edge Function.
alter table public.admin_ai_providers
  add column if not exists api_key_encrypted text,
  add column if not exists openrouter_auto_mode boolean not null default false,
  add column if not exists model_fallback_chain text[] not null default '{}',
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists cooldown_ms integer,
  add column if not exists daily_limit integer,
  add column if not exists routing_mode text not null default 'priority';

-- Do not expose the encrypted secret to browser reads. The privileged Edge Function is the only writer/reader.
create unique index if not exists admin_ai_providers_provider_unique on public.admin_ai_providers(provider);

insert into public.admin_ai_providers
  (provider, enabled, api_key_masked, base_url, priority, default_model, fallback_enabled, max_requests, timeout_ms, retry_count, openrouter_auto_mode, model_fallback_chain, capabilities, routing_mode)
values
  ('openrouter', true, '', 'https://openrouter.ai/api/v1', 1, 'openrouter/free', true, 1000, 30000, 3, true,
   array['qwen/qwen3-32b:free','deepseek/deepseek-r1:free','google/gemma-3-27b-it:free'],
   array['chat','structured_outputs','tools'], 'priority'),
  ('grok', false, '', 'https://api.x.ai/v1', 2, 'grok-4.6', true, 1000, 30000, 3, false,
   array['grok-4.6-latest'], array['chat','tools','structured_outputs'], 'priority')
on conflict (provider) do update set
  base_url = excluded.base_url,
  default_model = excluded.default_model,
  model_fallback_chain = excluded.model_fallback_chain,
  capabilities = excluded.capabilities,
  updated_at = now();

insert into public.admin_ai_model_router (task, primary_model, secondary_model, fallback_model)
values
  ('research_planning','openrouter/free','qwen/qwen3-32b:free','deepseek/deepseek-r1:free'),
  ('data_extraction','qwen/qwen3-32b:free','google/gemma-3-27b-it:free','openrouter/free'),
  ('intent_detection','google/gemma-3-27b-it:free','qwen/qwen3-32b:free','openrouter/free'),
  ('lead_scoring','qwen/qwen3-32b:free','deepseek/deepseek-r1:free','openrouter/free'),
  ('entity_matching','qwen/qwen3-32b:free','google/gemma-3-27b-it:free','openrouter/free'),
  ('summarization','deepseek/deepseek-r1:free','qwen/qwen3-32b:free','openrouter/free')
on conflict (task) do update set
  primary_model = excluded.primary_model,
  secondary_model = excluded.secondary_model,
  fallback_model = excluded.fallback_model;

-- Ensure the service role can maintain these rows; browser users continue through RLS/admin checks.
grant select, update on public.admin_ai_providers to service_role;
grant select, insert on public.audit_logs to service_role;
