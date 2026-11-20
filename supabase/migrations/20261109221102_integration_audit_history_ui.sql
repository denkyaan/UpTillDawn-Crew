-- Audit history for approved Head Admin and Administration; no secrets/ciphertexts.
create or replace function public.upt_integration_audit_recent(p_limit integer default 20)
returns table (
 provider text,
 action text,
 actor_name text,
 occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
 if auth.uid() is null
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.approved = true
        and coalesce(p.account_blocked, false) = false
    )
    or not public.upt_can_manage_administration()
 then
   raise exception 'integration_permission_denied' using errcode = '42501';
 end if;

 return query
 select a.provider, a.action,
        coalesce(nullif(btrim(p.full_name), ''), 'Unknown user') as actor_name,
        a.occurred_at
 from upt_private.integration_connection_audit a
 left join public.profiles p on p.id = a.actor_id
 order by a.occurred_at desc, a.id desc
 limit least(greatest(coalesce(p_limit,20),1),50);
end
$$;
revoke all on function public.upt_integration_audit_recent(integer) from public, anon, authenticated;
grant execute on function public.upt_integration_audit_recent(integer) to authenticated;
