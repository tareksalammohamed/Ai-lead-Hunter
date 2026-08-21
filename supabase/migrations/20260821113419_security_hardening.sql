create schema if not exists private;

create or replace function private.handle_new_user()
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
for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
