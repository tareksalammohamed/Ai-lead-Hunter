-- v4.1 Production integrity guards
create unique index if not exists ai_runs_user_idempotency_key_uidx
  on public.ai_runs (user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists leads_user_campaign_phone_uidx
  on public.leads (user_id, campaign_id, normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';

create unique index if not exists leads_user_email_uidx
  on public.leads (user_id, lower(email))
  where email is not null and email <> '';

create index if not exists ai_runs_job_created_idx
  on public.ai_runs (job_id, created_at desc)
  where job_id is not null;

create index if not exists ai_routing_events_job_created_idx
  on public.ai_routing_events (job_id, created_at desc)
  where job_id is not null;

create unique index if not exists research_jobs_one_active_per_campaign_uidx
  on public.research_jobs (user_id, campaign_id)
  where status in ('queued','running','recovering','paused');
