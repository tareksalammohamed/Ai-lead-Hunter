-- AI Lead Hunter v3.5 performance indexes
create index if not exists leads_user_status_score_idx on public.leads (user_id, status, score desc);
create index if not exists leads_user_intent_idx on public.leads (user_id, intent);
create index if not exists research_jobs_user_status_updated_idx on public.research_jobs (user_id, status, updated_at desc);
create index if not exists research_job_steps_job_status_idx on public.research_job_steps (job_id, status);
create index if not exists ai_runs_user_created_idx on public.ai_runs (user_id, created_at desc);
create index if not exists ai_routing_events_user_created_idx on public.ai_routing_events (user_id, created_at desc);
