# v4.2 — Real Integration Hardening

- Added server-side `source-connector-proxy-v2` Edge Function (JWT protected).
- Source API credentials are encrypted server-side and never returned to the browser.
- Google Maps and Tavily/Web Search requests now execute server-side when Supabase is configured.
- Existing plaintext `source_connections.credentials` were cleared in production; connections must be re-saved once.
- Added `source_connection_secrets` with RLS and no client grants.
- Realtime remains enabled for Research Jobs, Job Steps, AI Runs and Routing Events.
- TypeScript/TSX syntax diagnostics across `src` and `supabase/functions` are clean using TypeScript 5.8 parser.
- Android native project remains intentionally excluded; Vercel + Capacitor retained.
