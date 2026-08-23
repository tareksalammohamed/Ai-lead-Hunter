-- Remove the Grok provider from the global AI provider catalog.
-- This does not affect other providers or user data.
delete from public.admin_ai_providers
where provider = 'grok';

-- Keep historical health rows out of the active provider catalog as well.
delete from public.ai_provider_health
where provider = 'grok';
