-- Additional OpenAI-compatible provider pool.
insert into public.admin_ai_providers
  (provider, enabled, api_key_masked, base_url, priority, default_model, fallback_enabled, max_requests, timeout_ms, retry_count, model_fallback_chain, capabilities, routing_mode)
values
  ('groq', false, '', 'https://api.groq.com/openai/v1', 3, 'llama-3.3-70b-versatile', true, 1000, 30000, 3, array['openai/gpt-oss-120b'], array['chat','structured_outputs','tools'], 'priority'),
  ('cerebras', false, '', 'https://api.cerebras.ai/v1', 4, 'llama-3.3-70b', true, 1000, 30000, 3, array['qwen-3-32b'], array['chat','structured_outputs','tools'], 'priority'),
  ('mistral', false, '', 'https://api.mistral.ai/v1', 5, 'mistral-small-latest', true, 1000, 30000, 3, array['mistral-large-latest'], array['chat','structured_outputs','tools'], 'priority')
on conflict (provider) do update set
  base_url = excluded.base_url,
  default_model = excluded.default_model,
  model_fallback_chain = excluded.model_fallback_chain,
  capabilities = excluded.capabilities,
  updated_at = now();

-- OpenRouter remains a single-key provider. The Free Router selects the actual free model internally.
update public.admin_ai_providers
set enabled = true,
    default_model = 'openrouter/free',
    openrouter_auto_mode = true,
    model_fallback_chain = array[]::text[],
    base_url = 'https://openrouter.ai/api/v1',
    updated_at = now()
where provider = 'openrouter';
