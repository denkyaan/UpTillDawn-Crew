-- Business provider keys belong to the designated organizational Head and
-- explicitly approved Administration, never to Maker ownership alone.
create or replace function public.upt_can_manage_integrations()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists(
   select 1 from public.profiles p
   where p.id=(select auth.uid())
     and p.approved=true
     and coalesce(p.account_blocked,false)=false
     and (
       exists(
         select 1 from public.upt_organization_leadership l
         where l.slot='head' and l.user_id=p.id
       )
       or exists(
         select 1 from public.portal_role_assignments a
         where a.user_id=p.id and a.portal='administration'
           and a.role='administrative_staff'
           and a.approved=true and a.revoked_at is null
       )
     )
 );
$$;
revoke all on function public.upt_can_manage_integrations() from public,anon,authenticated;
grant execute on function public.upt_can_manage_integrations() to authenticated;

-- Keep the existing verified read/write, encryption, and audit code intact;
-- replace only the authorization predicate in both business credential RPCs.
do $migration$
declare
  v_definition text;
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'public.upt_integration_credentials(text,text,text)'::regprocedure,
    'public.upt_integration_audit_recent(integer)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    if position('public.upt_can_manage_administration()' in v_definition)=0 then
       raise exception 'Integration authorization source missing for %',v_signature;
    end if;
    execute replace(v_definition,
      'public.upt_can_manage_administration()',
      'public.upt_can_manage_integrations()');
  end loop;
end
$migration$;
