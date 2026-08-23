# Security hardening release

## Included
- Removed hard-coded Super Admin email authorization.
- Added strict Edge Function origin allowlisting.
- Added dedicated provider-secret encryption key with backward-compatible legacy decryption.
- Hardened lead duplicate and audit-log RLS.
- Optimized new RLS policies with `(select auth.uid())`.
- Added CI and secret scanning.

## Required Supabase Edge Function secrets
`AI_PROVIDER_ENCRYPTION_KEY` and `ALLOWED_ORIGINS`.
