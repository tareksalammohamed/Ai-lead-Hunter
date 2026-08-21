-- Covering indexes for Smart AI Router foreign keys.
create index if not exists ai_context_snapshots_job_id_idx on public.ai_context_snapshots(job_id);
create index if not exists ai_context_snapshots_user_id_idx on public.ai_context_snapshots(user_id);
create index if not exists ai_routing_events_user_id_idx on public.ai_routing_events(user_id);
create index if not exists ai_task_checkpoints_user_id_idx on public.ai_task_checkpoints(user_id);
