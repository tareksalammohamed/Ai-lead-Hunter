# v3.8 Integration Hardening

Production Supabase was updated directly.

## Edge Functions
- ai-orchestrator v7
- openrouter-model-discovery v3
- admin-user-management v3
- admin-provider-secrets v5

All remain JWT-protected.

## CORS
Wildcard `Access-Control-Allow-Origin: *` was removed from the hardened functions.
Allowed defaults include Capacitor/local development origins. Production Vercel domains should be supplied through:
`CORS_ALLOWED_ORIGINS=https://your-domain.vercel.app,https://your-custom-domain.com`

## Realtime
Enabled for research_jobs, research_job_steps, ai_runs and ai_routing_events.

## Security
Supabase Security Advisor currently reports zero lints.
