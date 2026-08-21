-- AI Lead Hunter — initial Supabase schema
-- Creates application data, admin configuration, RLS, indexes and auth bootstrap.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  company text,
  role text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id text primary key,
  code text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'Globe',
  auth_type text not null default 'none',
  capabilities text[] not null default '{}',
  is_active boolean not null default true
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null default '',
  country text not null default 'Egypt',
  governorate text,
  city text,
  area text,
  keywords text[] not null default '{}',
  negative_keywords text[] not null default '{}',
  target_audience text,
  sources text[] not null default '{}',
  max_leads integer not null default 100 check (max_leads > 0),
  min_score numeric not null default 0 check (min_score >= 0 and min_score <= 100),
  require_phone boolean not null default false,
  require_egyptian_mobile boolean not null default false,
  ai_instructions text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null references public.sources(id) on delete restrict,
  name text not null,
  credentials jsonb not null default '{}'::jsonb,
  status text not null default 'untested' check (status in ('connected','disconnected','error','untested')),
  last_tested_at timestamptz,
  last_test_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openrouter','openai','gemini','anthropic','huggingface')),
  model text not null,
  api_key_encrypted text,
  priority integer not null default 0,
  is_active boolean not null default true,
  last_used_at timestamptz,
  last_error text,
  last_latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  scoring_config jsonb not null default '{}'::jsonb,
  phone_rules jsonb not null default '{}'::jsonb,
  duplicate_rules jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','paused','completed','failed','cancelled')),
  research_plan jsonb not null default '{}'::jsonb,
  total_records integer not null default 0,
  records_processed integer not null default 0,
  records_failed integer not null default 0,
  leads_created integer not null default 0,
  duplicates_found integer not null default 0,
  current_step text not null default 'planning',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.research_jobs(id) on delete cascade,
  step_name text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','skipped')),
  records_processed integer not null default 0,
  records_failed integer not null default 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, step_name)
);

create table if not exists public.search_queries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.research_jobs(id) on delete cascade,
  source text not null,
  query text not null,
  location text
);

create table if not exists public.raw_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.research_jobs(id) on delete cascade,
  source_code text not null,
  source_url text,
  data jsonb not null default '{}'::jsonb,
  normalized boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  business text,
  raw_phone text,
  normalized_phone text,
  phone_type text,
  email text,
  website text,
  address text,
  city text,
  governorate text,
  country text,
  rating numeric,
  reviews_count integer,
  maps_url text,
  coordinates jsonb,
  social_profiles jsonb not null default '[]'::jsonb,
  score numeric not null default 0,
  score_tier text not null default 'LOW' check (score_tier in ('HOT','HIGH','MEDIUM','LOW')),
  lead_type text not null default 'Other',
  intent text not null default 'UNKNOWN',
  intent_score numeric not null default 0,
  intent_reason text,
  confidence numeric not null default 0,
  potential text not null default '',
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified','invalid','partial')),
  status text not null default 'new' check (status in ('new','contacted','qualified','disqualified','converted')),
  match_score numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in ('phone','email','website','social')),
  value text not null,
  normalized_value text,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_code text not null,
  source_url text not null default '',
  source_type text not null default 'unknown',
  author text,
  context text,
  date timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  score numeric not null,
  tier text not null check (tier in ('HOT','HIGH','MEDIUM','LOW')),
  factors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_intents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  intent text not null,
  intent_score numeric not null default 0,
  reason text not null default '',
  confidence numeric not null default 0,
  potential text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  matched_lead_id uuid not null references public.leads(id) on delete cascade,
  match_score numeric not null,
  match_factors text[] not null default '{}',
  merged boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_duplicates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  duplicate_lead_id uuid not null references public.leads(id) on delete cascade,
  rule text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.research_jobs(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  provider text not null,
  model text not null,
  task text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  success boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'USER' check (role in ('SUPER_ADMIN','ADMIN','MANAGER','RESEARCHER','USER')),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  permissions text[] not null default '{}',
  usage jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_config (
  key text primary key,
  section text not null,
  name text not null,
  description text not null default '',
  value jsonb not null,
  default_value jsonb not null,
  type text not null check (type in ('string','number','boolean','json')),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.admin_config_changes (
  id uuid primary key default gen_random_uuid(),
  key text not null references public.admin_config(key) on delete cascade,
  old_value text not null,
  new_value text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.admin_ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  enabled boolean not null default false,
  api_key_masked text not null default '',
  base_url text,
  priority integer not null default 0,
  default_model text not null default '',
  fallback_enabled boolean not null default true,
  max_requests integer not null default 0,
  timeout_ms integer not null default 30000,
  retry_count integer not null default 3,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_ai_model_router (
  task text primary key,
  primary_model text not null default '',
  secondary_model text not null default '',
  fallback_model text not null default ''
);

create table if not exists public.admin_search_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default false,
  api_key_masked text not null default '',
  priority integer not null default 0,
  daily_limit integer not null default 0,
  requests_per_minute integer not null default 0,
  timeout_ms integer not null default 15000,
  fallback_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_source_connectors (
  code text primary key,
  name text not null,
  enabled boolean not null default true,
  available boolean not null default true,
  auth_type text not null default 'none',
  api_status text not null default 'healthy' check (api_status in ('healthy','warning','error','offline')),
  last_test timestamptz,
  usage_count integer not null default 0,
  limits jsonb not null default '{}'::jsonb
);

create table if not exists public.admin_research_engine (
  id text primary key,
  max_concurrent_jobs integer not null default 5,
  max_leads_per_job integer not null default 1000,
  max_search_depth integer not null default 10,
  request_timeout_ms integer not null default 30000,
  retry_attempts integer not null default 3,
  delay_between_requests_ms integer not null default 1000,
  daily_research_limit integer not null default 100,
  max_sources_per_campaign integer not null default 5,
  ai_qualification_threshold numeric not null default 50
);

create table if not exists public.admin_scoring (
  id text primary key,
  weights jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb
);

create table if not exists public.admin_intent_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  ai_instructions text not null default '',
  weight numeric not null default 0,
  enabled boolean not null default true
);

create table if not exists public.admin_phone_rules (
  id text primary key,
  country_code text not null default '+20',
  mobile_prefixes text[] not null default '{}',
  require_mobile boolean not null default true,
  allow_landline boolean not null default false,
  verify_format boolean not null default true,
  normalize_automatically boolean not null default true,
  reject_invalid boolean not null default true
);

create table if not exists public.admin_duplicate_engine (
  id text primary key,
  phone_match_weight numeric not null default 40,
  email_match_weight numeric not null default 25,
  name_match_weight numeric not null default 20,
  business_match_weight numeric not null default 15,
  location_match_weight numeric not null default 10,
  website_match_weight numeric not null default 20,
  auto_merge_threshold numeric not null default 90,
  potential_duplicate_threshold numeric not null default 60,
  keep_separate_threshold numeric not null default 40
);

create table if not exists public.admin_feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  enabled boolean not null default false,
  scope text not null default 'global' check (scope in ('global','role','user')),
  target_roles text[] not null default '{}',
  target_user_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_health_checks (
  id text primary key,
  component text not null,
  status text not null check (status in ('healthy','warning','error','offline')),
  latency_ms integer not null default 0,
  error_rate numeric not null default 0,
  last_check timestamptz not null default now(),
  message text
);

create table if not exists public.admin_security_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('failed_login','password_reset','api_error','suspicious_activity','token_expired','force_logout','account_disabled')),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  description text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  key text primary key,
  name text not null,
  enabled boolean not null default true,
  recipients text[] not null default '{}',
  severity text not null check (severity in ('low','medium','high','critical'))
);

create table if not exists public.admin_maintenance (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  status text not null check (status in ('pending','running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result text,
  initiated_by uuid not null references auth.users(id) on delete restrict
);

-- Auth bootstrap: create the profile and an application user row for every new account.
-- The first registered account becomes SUPER_ADMIN so a fresh private deployment is usable.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  first_user boolean;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set full_name = excluded.full_name, updated_at = now();

  select not exists (select 1 from public.admin_users) into first_user;
  insert into public.admin_users (id, email, full_name, role, status, permissions, usage, limits)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when first_user then 'SUPER_ADMIN' else 'USER' end,
    'active',
    case when first_user then array['view_dashboard','create_campaign','run_agent','view_leads','edit_leads','delete_leads','export_leads','manage_sources','manage_ai','manage_users','manage_settings','view_analytics','view_audit_logs','manage_billing','access_super_admin']::text[] else array['view_dashboard','view_leads']::text[] end,
    '{"daily_searches":0,"monthly_searches":0,"daily_leads":0,"monthly_leads":0,"ai_requests":0,"export_count":0,"active_jobs":0}'::jsonb,
    '{"max_daily_searches":50,"max_monthly_searches":1000,"max_daily_leads":500,"max_monthly_leads":10000,"max_ai_requests":200,"max_exports":20,"max_active_jobs":3}'::jsonb
  )
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create schema if not exists private;
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = (select auth.uid())
      and status = 'active'
      and role in ('SUPER_ADMIN','ADMIN')
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns for each row execute procedure public.set_updated_at();
drop trigger if exists source_connections_updated_at on public.source_connections;
create trigger source_connections_updated_at before update on public.source_connections for each row execute procedure public.set_updated_at();
drop trigger if exists ai_providers_updated_at on public.ai_providers;
create trigger ai_providers_updated_at before update on public.ai_providers for each row execute procedure public.set_updated_at();
drop trigger if exists system_settings_updated_at on public.system_settings;
create trigger system_settings_updated_at before update on public.system_settings for each row execute procedure public.set_updated_at();
drop trigger if exists research_jobs_updated_at on public.research_jobs;
create trigger research_jobs_updated_at before update on public.research_jobs for each row execute procedure public.set_updated_at();
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads for each row execute procedure public.set_updated_at();
drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at before update on public.admin_users for each row execute procedure public.set_updated_at();
drop trigger if exists admin_roles_updated_at on public.admin_roles;
create trigger admin_roles_updated_at before update on public.admin_roles for each row execute procedure public.set_updated_at();
drop trigger if exists admin_ai_providers_updated_at on public.admin_ai_providers;
create trigger admin_ai_providers_updated_at before update on public.admin_ai_providers for each row execute procedure public.set_updated_at();
drop trigger if exists admin_search_providers_updated_at on public.admin_search_providers;
create trigger admin_search_providers_updated_at before update on public.admin_search_providers for each row execute procedure public.set_updated_at();
drop trigger if exists admin_feature_flags_updated_at on public.admin_feature_flags;
create trigger admin_feature_flags_updated_at before update on public.admin_feature_flags for each row execute procedure public.set_updated_at();

insert into public.sources (id, code, name, description, icon, auth_type, capabilities, is_active) values
('src-google-maps','google_maps','Google Maps','قوائم الأنشطة التجارية مع الهاتف والعنوان والتقييم','MapPin','api_key',array['search','extract','normalize'],true),
('src-web-search','web_search','Web Search','نتائج محرك البحث عن الأشخاص والأنشطة','Globe','api_key',array['search','extract','normalize'],true),
('src-facebook','facebook','Facebook','الصفحات والمجموعات والمناقشات العامة','Facebook','oauth',array['search','extract','normalize'],true),
('src-linkedin','linkedin','LinkedIn','الملفات الشخصية المهنية وبيانات الشركات','Linkedin','oauth',array['search','extract','normalize'],true),
('src-website','website','Website','استخراج محتوى الموقع مباشرة','FileText','none',array['extract','normalize'],true)
on conflict (id) do update set name = excluded.name, description = excluded.description, capabilities = excluded.capabilities, is_active = excluded.is_active;

-- Indexes for ownership, joins and RLS evaluation.
create index if not exists campaigns_user_id_idx on public.campaigns(user_id);
create index if not exists source_connections_user_id_idx on public.source_connections(user_id);
create index if not exists ai_providers_user_id_idx on public.ai_providers(user_id);
create index if not exists research_jobs_user_id_idx on public.research_jobs(user_id);
create index if not exists research_jobs_campaign_id_idx on public.research_jobs(campaign_id);
create index if not exists research_job_steps_job_id_idx on public.research_job_steps(job_id);
create index if not exists search_queries_job_id_idx on public.search_queries(job_id);
create index if not exists raw_records_job_id_idx on public.raw_records(job_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_campaign_id_idx on public.leads(campaign_id);
create index if not exists leads_normalized_phone_idx on public.leads(normalized_phone);
create index if not exists lead_contacts_lead_id_idx on public.lead_contacts(lead_id);
create index if not exists lead_sources_lead_id_idx on public.lead_sources(lead_id);
create index if not exists lead_scores_lead_id_idx on public.lead_scores(lead_id);
create index if not exists lead_intents_lead_id_idx on public.lead_intents(lead_id);
create index if not exists lead_matches_lead_id_idx on public.lead_matches(lead_id);
create index if not exists lead_duplicates_duplicate_lead_id_idx on public.lead_duplicates(duplicate_lead_id);
create index if not exists ai_runs_user_id_idx on public.ai_runs(user_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists admin_users_role_idx on public.admin_users(role);

-- Exposed public tables must use RLS.
do $$ declare t text; begin
  foreach t in array array['profiles','sources','campaigns','source_connections','ai_providers','system_settings','research_jobs','research_job_steps','search_queries','raw_records','leads','lead_contacts','lead_sources','lead_scores','lead_intents','lead_matches','lead_duplicates','ai_runs','audit_logs','admin_users','admin_roles','admin_config','admin_config_changes','admin_ai_providers','admin_ai_model_router','admin_search_providers','admin_source_connectors','admin_research_engine','admin_scoring','admin_intent_categories','admin_phone_rules','admin_duplicate_engine','admin_feature_flags','admin_health_checks','admin_security_events','admin_notifications','admin_maintenance'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select on public.sources to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Static source catalog.
drop policy if exists sources_authenticated_read on public.sources;
create policy sources_authenticated_read on public.sources for select to authenticated using (true);

-- User-owned tables.
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Tables identified by user_id.
do $$ declare t text; begin
  foreach t in array array['campaigns','source_connections','ai_providers','system_settings','research_jobs','leads','ai_runs','audit_logs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id or (select private.is_admin())) with check ((select auth.uid()) = user_id or (select private.is_admin()))', t || '_owner_all', t);
  end loop;
end $$;

-- Child rows are reachable through the owner's parent row.
drop policy if exists job_steps_owner_all on public.research_job_steps;
create policy job_steps_owner_all on public.research_job_steps for all to authenticated
using (exists (select 1 from public.research_jobs j where j.id = job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (exists (select 1 from public.research_jobs j where j.id = job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))));

drop policy if exists queries_owner_all on public.search_queries;
create policy queries_owner_all on public.search_queries for all to authenticated
using (job_id is null or exists (select 1 from public.research_jobs j where j.id = search_queries.job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (job_id is null or exists (select 1 from public.research_jobs j where j.id = search_queries.job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))));

drop policy if exists raw_records_owner_all on public.raw_records;
create policy raw_records_owner_all on public.raw_records for all to authenticated
using (exists (select 1 from public.research_jobs j where j.id = job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (exists (select 1 from public.research_jobs j where j.id = job_id and (j.user_id = (select auth.uid()) or (select private.is_admin()))));

do $$ declare t text; begin
  foreach t in array array['lead_contacts','lead_sources','lead_scores','lead_intents','lead_matches'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = (select auth.uid()) or (select private.is_admin())))) with check (exists (select 1 from public.leads l where l.id = lead_id and (l.user_id = (select auth.uid()) or (select private.is_admin()))))', t || '_owner_all', t);
  end loop;
end $$;

drop policy if exists lead_duplicates_owner_all on public.lead_duplicates;
create policy lead_duplicates_owner_all on public.lead_duplicates for all to authenticated
using (exists (select 1 from public.leads l where l.id = lead_duplicates.lead_id and (l.user_id = (select auth.uid()) or (select private.is_admin()))) or exists (select 1 from public.leads l where l.id = lead_duplicates.duplicate_lead_id and (l.user_id = (select auth.uid()) or (select private.is_admin()))))
with check (exists (select 1 from public.leads l where l.id = lead_duplicates.duplicate_lead_id and (l.user_id = (select auth.uid()) or (select private.is_admin()))));

-- Admin tables are readable/writable only by active ADMIN or SUPER_ADMIN users.
do $$ declare t text; begin
  foreach t in array array['admin_users','admin_roles','admin_config','admin_config_changes','admin_ai_providers','admin_ai_model_router','admin_search_providers','admin_source_connectors','admin_research_engine','admin_scoring','admin_intent_categories','admin_phone_rules','admin_duplicate_engine','admin_feature_flags','admin_health_checks','admin_security_events','admin_notifications','admin_maintenance'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_admin_all', t);
  end loop;
end $$;
