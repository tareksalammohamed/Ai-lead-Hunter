-- SMART AI ROUTER & FAILOVER ENGINE
-- Additive migration: preserves all existing application tables and data.

alter table public.research_jobs drop constraint if exists research_jobs_status_check;
alter table public.research_jobs add constraint research_jobs_status_check check (status in ('queued','running','recovering','paused','completed','failed','cancelled'));
alter table public.research_jobs add column if not exists recovery_status text not null default 'idle' check (recovery_status in ('idle','recovering','recovered','failed'));
alter table public.research_jobs add column if not exists active_task_id text;
alter table public.research_jobs add column if not exists last_checkpoint_id uuid;
alter table public.research_jobs add column if not exists context_snapshot jsonb not null default '{}'::jsonb;
alter table public.research_jobs add column if not exists resume_count integer not null default 0;

alter table public.research_job_steps add column if not exists ai_task_id text;
alter table public.research_job_steps add column if not exists checkpoint_id uuid;
alter table public.research_job_steps add column if not exists provider text;
alter table public.research_job_steps add column if not exists model text;
alter table public.research_job_steps add column if not exists input_state jsonb not null default '{}'::jsonb;
alter table public.research_job_steps add column if not exists output_state jsonb not null default '{}'::jsonb;
alter table public.research_job_steps add column if not exists next_step text;

alter table public.ai_runs add column if not exists attempt integer not null default 1;
alter table public.ai_runs add column if not exists error_type text;
alter table public.ai_runs add column if not exists fallback_from text;
alter table public.ai_runs add column if not exists fallback_to text;
alter table public.ai_runs add column if not exists checkpoint_id uuid;
alter table public.ai_runs add column if not exists idempotency_key text;
alter table public.ai_runs add column if not exists started_at timestamptz;
alter table public.ai_runs add column if not exists completed_at timestamptz;

alter table public.admin_ai_providers add column if not exists openrouter_auto_mode boolean not null default false;
alter table public.admin_ai_providers add column if not exists model_fallback_chain text[] not null default '{}';
alter table public.admin_ai_providers add column if not exists capabilities text[] not null default '{}';
alter table public.admin_ai_providers add column if not exists cooldown_ms integer not null default 300000;
alter table public.admin_ai_providers add column if not exists daily_limit integer not null default 0;
alter table public.admin_ai_providers add column if not exists routing_mode text not null default 'SMART_AUTO';
alter table public.admin_ai_providers add column if not exists api_key_encrypted text;

create table if not exists public.ai_task_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.research_jobs(id) on delete cascade,
  task_id text not null,
  step text not null,
  provider text,
  model text,
  status text not null default 'saved' check (status in ('saved','current','completed','failed')),
  input_context jsonb not null default '{}'::jsonb,
  working_state jsonb not null default '{}'::jsonb,
  output text,
  structured_result jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  status text not null default 'HEALTHY' check (status in ('HEALTHY','DEGRADED','FAILING','OFFLINE','DISABLED')),
  success_rate numeric not null default 0,
  failure_rate numeric not null default 0,
  average_latency_ms integer not null default 0,
  consecutive_failures integer not null default 0,
  recent_errors jsonb not null default '[]'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  requests_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_model_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COOLDOWN','DISABLED','DEPRECATED')),
  success_rate numeric not null default 0,
  failure_rate numeric not null default 0,
  average_latency_ms integer not null default 0,
  requests_count integer not null default 0,
  fallback_count integer not null default 0,
  last_error text,
  last_used_at timestamptz,
  last_failure_at timestamptz,
  cooldown_until timestamptz,
  capabilities text[] not null default '{}',
  context_length integer not null default 0,
  is_free boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(provider, model)
);

create table if not exists public.ai_routing_rules (
  id uuid primary key default gen_random_uuid(),
  task text not null unique,
  provider_order text[] not null default '{}',
  model_order text[] not null default '{}',
  required_capabilities text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_routing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task_id text not null,
  job_id uuid references public.research_jobs(id) on delete cascade,
  task text not null,
  event_type text not null check (event_type in ('attempt','failure','checkpoint_saved','provider_switched','context_compressed','context_restored','completed','recovery_failed')),
  from_provider text,
  from_model text,
  to_provider text,
  to_model text,
  error_type text,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.research_jobs(id) on delete cascade,
  task_id text not null,
  step text not null,
  state jsonb not null default '{}'::jsonb,
  compressed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_circuit_breakers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text,
  state text not null default 'CLOSED' check (state in ('CLOSED','OPEN','HALF_OPEN')),
  failure_threshold integer not null default 5,
  consecutive_failures integer not null default 0,
  cooldown_ms integer not null default 300000,
  opened_at timestamptz,
  next_probe_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider, model)
);

create index if not exists ai_task_checkpoints_task_idx on public.ai_task_checkpoints(task_id, created_at desc);
create index if not exists ai_task_checkpoints_job_idx on public.ai_task_checkpoints(job_id, created_at desc);
create unique index if not exists ai_task_checkpoints_idempotency_idx on public.ai_task_checkpoints(idempotency_key) where idempotency_key is not null;
create index if not exists ai_runs_job_task_idx on public.ai_runs(job_id, task, created_at desc);
create index if not exists ai_runs_provider_idx on public.ai_runs(provider, created_at desc);
create index if not exists ai_routing_events_task_idx on public.ai_routing_events(task_id, created_at desc);
create index if not exists ai_routing_events_job_idx on public.ai_routing_events(job_id, created_at desc);
create index if not exists ai_context_snapshots_task_idx on public.ai_context_snapshots(task_id, created_at desc);
create index if not exists ai_circuit_breakers_provider_idx on public.ai_circuit_breakers(provider, state);

create or replace function public.smart_ai_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists ai_provider_health_updated_at on public.ai_provider_health;
create trigger ai_provider_health_updated_at before update on public.ai_provider_health for each row execute procedure public.smart_ai_updated_at();
drop trigger if exists ai_model_health_updated_at on public.ai_model_health;
create trigger ai_model_health_updated_at before update on public.ai_model_health for each row execute procedure public.smart_ai_updated_at();
drop trigger if exists ai_routing_rules_updated_at on public.ai_routing_rules;
create trigger ai_routing_rules_updated_at before update on public.ai_routing_rules for each row execute procedure public.smart_ai_updated_at();
drop trigger if exists ai_circuit_breakers_updated_at on public.ai_circuit_breakers;
create trigger ai_circuit_breakers_updated_at before update on public.ai_circuit_breakers for each row execute procedure public.smart_ai_updated_at();

insert into public.ai_provider_health(provider, status) values
  ('openrouter','HEALTHY'), ('gemini','HEALTHY'), ('openai','HEALTHY'), ('anthropic','HEALTHY'), ('huggingface','HEALTHY')
on conflict (provider) do nothing;

insert into public.ai_circuit_breakers(provider, model) values
  ('openrouter', null), ('gemini', null), ('openai', null), ('anthropic', null), ('huggingface', null)
on conflict (provider, model) do nothing;

insert into public.ai_routing_rules(task, provider_order, model_order, required_capabilities) values
  ('research_planning', array['openrouter','gemini','openai','anthropic'], array['openrouter/free'], array['text']),
  ('query_generation', array['openrouter','gemini','openai'], array['openrouter/free'], array['text']),
  ('data_extraction', array['openrouter','gemini','openai','huggingface'], array['openrouter/free'], array['structured_output']),
  ('intent_detection', array['openrouter','gemini','huggingface','openai'], array['openrouter/free'], array['json']),
  ('lead_scoring', array['openrouter','gemini','openai'], array['openrouter/free'], array['structured_output']),
  ('entity_matching', array['openrouter','gemini','openai'], array['openrouter/free'], array['json']),
  ('deduplication', array['openrouter','gemini','openai'], array['openrouter/free'], array['json']),
  ('summarization', array['openrouter','gemini','openai','anthropic'], array['openrouter/free'], array['text']),
  ('lead_qualification', array['openrouter','gemini','openai'], array['openrouter/free'], array['structured_output']),
  ('agent_reasoning', array['openrouter','gemini','openai','anthropic'], array['openrouter/free'], array['reasoning'])
on conflict (task) do nothing;

insert into public.admin_config(key, section, name, description, value, default_value, type, updated_by) values
 ('ai.routing_mode','ai','وضع التوجيه','طريقة اختيار المسار',to_jsonb('SMART_AUTO'::text),to_jsonb('SMART_AUTO'::text),'string','system'),
 ('ai.smart_routing','ai','التوجيه الذكي','تشغيل Smart Router',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.openrouter_enabled','ai','OpenRouter مفعل','تفعيل OpenRouter',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.openrouter_free_enabled','ai','OpenRouter Free','السماح بالنماذج المجانية',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.openrouter_auto_mode','ai','OpenRouter Auto Mode','استخدام openrouter/free',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.dynamic_free_model_discovery','ai','اكتشاف النماذج المجانية','تحديث قائمة النماذج المجانية',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.global_failover','ai','Global Failover','التحويل بين المزودين',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.context_preservation','ai','حفظ السياق','استعادة المهمة من checkpoint',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.checkpointing','ai','Checkpointing','حفظ الحالة بعد كل خطوة',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.auto_retry','ai','إعادة المحاولة','إعادة المحاولة الذكية',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.circuit_breaker','ai','Circuit Breaker','إيقاف المزود المتعطل مؤقتاً',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.model_health','ai','صحة النماذج','تسجيل صحة النماذج',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.provider_health','ai','صحة المزودين','تسجيل صحة المزودين',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.cost_control','ai','التحكم في التكلفة','تطبيق الميزانيات',to_jsonb(true),to_jsonb(true),'boolean','system'),
 ('ai.max_retries','ai','الحد الأقصى للمحاولات','عدد المحاولات قبل التحويل',to_jsonb(2),to_jsonb(2),'number','system'),
 ('ai.retry_delay_ms','ai','تأخير الإعادة','التأخير الأساسي بالمللي ثانية',to_jsonb(350),to_jsonb(350),'number','system'),
 ('ai.max_cooldown_ms','ai','أقصى Cooldown','مدة إيقاف المزود',to_jsonb(300000),to_jsonb(300000),'number','system'),
 ('ai.circuit_failure_threshold','ai','حد Circuit Breaker','عدد الإخفاقات المتتالية',to_jsonb(5),to_jsonb(5),'number','system'),
 ('ai.daily_ai_budget_usd','ai','ميزانية AI اليومية','صفر يعني غير محدودة',to_jsonb(0),to_jsonb(0),'number','system'),
 ('ai.monthly_ai_budget_usd','ai','ميزانية AI الشهرية','صفر يعني غير محدودة',to_jsonb(0),to_jsonb(0),'number','system'),
 ('ai.stop_paid_fallback_on_budget','ai','إيقاف البديل المدفوع','منع البديل المدفوع عند بلوغ الميزانية',to_jsonb(true),to_jsonb(true),'boolean','system')
on conflict (key) do nothing;

alter table public.ai_task_checkpoints enable row level security;
alter table public.ai_provider_health enable row level security;
alter table public.ai_model_health enable row level security;
alter table public.ai_routing_rules enable row level security;
alter table public.ai_routing_events enable row level security;
alter table public.ai_context_snapshots enable row level security;
alter table public.ai_circuit_breakers enable row level security;
grant select, insert, update on public.ai_task_checkpoints to authenticated;
grant select, insert, update on public.ai_routing_events to authenticated;
grant select on public.ai_provider_health, public.ai_model_health, public.ai_routing_rules to authenticated;
grant select, update on public.ai_circuit_breakers to authenticated;

drop policy if exists ai_checkpoints_owner_or_admin on public.ai_task_checkpoints;
create policy ai_checkpoints_owner_or_admin on public.ai_task_checkpoints for all to authenticated using (user_id = (select auth.uid()) or (select private.is_admin())) with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists ai_events_owner_or_admin on public.ai_routing_events;
create policy ai_events_owner_or_admin on public.ai_routing_events for all to authenticated using (user_id = (select auth.uid()) or (select private.is_admin())) with check (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists ai_context_owner_or_admin on public.ai_context_snapshots;
create policy ai_context_owner_or_admin on public.ai_context_snapshots for all to authenticated using (user_id = (select auth.uid()) or (select private.is_admin())) with check (user_id = (select auth.uid()) or (select private.is_admin()));

do $$ declare t text; begin foreach t in array array['ai_provider_health','ai_model_health','ai_routing_rules','ai_circuit_breakers'] loop execute format('drop policy if exists %I on public.%I', t || '_admin_all', t); execute format('create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_admin_all', t); end loop; end $$;
