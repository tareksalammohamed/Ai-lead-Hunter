# AI Lead Hunter v4.1 — Real Runtime Fixes

Implemented code and database changes (not documentation-only):

- Mission Control now subscribes to Supabase Realtime for research jobs, job steps, and AI runs while retaining polling as a resilience fallback.
- Research jobs are race-safe: only one queued/running/recovering/paused job can exist per user/campaign.
- AI runs are idempotent per user/idempotency key at the database layer.
- Leads are protected against duplicate normalized phone per campaign and duplicate email per user.
- Added job-scoped indexes for AI runs and routing events.
- Campaign deletion now verifies ownership before deleting the campaign.
- Android native project remains intentionally removed; Web/Vercel + Capacitor retained.
