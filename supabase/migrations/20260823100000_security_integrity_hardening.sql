-- Security integrity hardening
drop policy if exists lead_duplicates_owner_all on public.lead_duplicates;
create policy lead_duplicates_owner_all on public.lead_duplicates as permissive for all to authenticated
using (
  exists (select 1 from public.leads l where l.id = lead_duplicates.lead_id and (l.user_id = (select auth.uid()) or private.is_admin()))
  and exists (select 1 from public.leads l where l.id = lead_duplicates.duplicate_lead_id and (l.user_id = (select auth.uid()) or private.is_admin()))
)
with check (
  exists (select 1 from public.leads l where l.id = lead_duplicates.lead_id and (l.user_id = (select auth.uid()) or private.is_admin()))
  and exists (select 1 from public.leads l where l.id = lead_duplicates.duplicate_lead_id and (l.user_id = (select auth.uid()) or private.is_admin()))
);

drop policy if exists audit_logs_owner_all on public.audit_logs;
drop policy if exists audit_logs_owner_select on public.audit_logs;
drop policy if exists audit_logs_owner_insert on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs as permissive for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin());
create policy audit_logs_owner_insert on public.audit_logs as permissive for insert to authenticated
with check (user_id = (select auth.uid()) or private.is_admin());

-- Required Edge Function secrets:
-- AI_PROVIDER_ENCRYPTION_KEY: dedicated secret, separate from SUPABASE_SERVICE_ROLE_KEY
-- ALLOWED_ORIGINS: exact trusted web origins, comma-separated
