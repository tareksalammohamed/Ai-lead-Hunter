# AI Lead Hunter v3.7 — Security Hardened

Implemented:
- Supabase: revoked PUBLIC EXECUTE on `private.is_admin()` and granted it only to `authenticated`.
- Edge AI orchestrator: request-size, task/message/candidate validation and bounded retry count.
- Edge AI orchestrator: provider/internal error text is no longer returned as the final API error.
- Provider-secret function: fixed an invalid `decryptSecret` call signature.
- Vercel: added clickjacking and cross-origin isolation headers.
- Android native dependency remains removed; target is Vercel + Capacitor.

Verified in Supabase:
- public tables have RLS enabled.
- `private.is_admin()` no longer has PUBLIC EXECUTE.
