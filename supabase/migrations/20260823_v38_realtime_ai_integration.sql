-- v3.8 integration hardening
-- Realtime publication was enabled directly on the production Supabase project.
-- This migration documents the intended publication state.

-- Safe/idempotent additions:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='research_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.research_jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='research_job_steps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.research_job_steps;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ai_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_runs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ai_routing_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_routing_events;
  END IF;
END $$;
