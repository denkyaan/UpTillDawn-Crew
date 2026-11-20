-- V2.1 privileged portal role provisioning. Caller identity comes exclusively from auth.uid().
-- All writes and their audit event are atomic; clients retain no table mutation privileges.
create or replace function public.upt_admin_set_portal_role(
  p_user_id uuid, p_portal text, p_role text, p_action text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_approved boolean;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles
    where id = v_actor and role = 'admin' and approved = true and account_blocked = false
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'Cannot change your own roles or an empty user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id=p_user_id and approved=true and account_blocked=false) then
    raise exception 'Target user is not approved and active' using errcode = '22023';
  end if;
  if not (
    (p_portal='events' and p_role in ('event_staff','event_responsible','admin'))
    or (p_portal='promotion' and p_role in ('promoter','admin'))
    or (p_portal='administration' and p_role in ('administrative_staff','admin'))
  ) or p_action not in ('assign','approve','revoke') then
    raise exception 'Invalid portal, role or action' using errcode = '22023';
  end if;
  if p_role = 'admin' then
    raise exception 'Admin grants require a separate privileged process' using errcode = '42501';
  end if;
  if p_action='assign' then
    insert into public.portal_role_assignments(user_id,portal,role,approved)
    values(p_user_id,p_portal,p_role,false)
    on conflict(user_id,portal,role) do update
      set approved=false, approved_by=null, approved_at=null, revoked_at=null
    returning id into v_id;
  elsif p_action='approve' then
    update public.portal_role_assignments
      set approved=true,approved_by=v_actor,approved_at=now(),revoked_at=null
    where user_id=p_user_id and portal=p_portal and role=p_role
      and approved=false and revoked_at is null
    returning id into v_id;
  else
    update public.portal_role_assignments
      set approved=false,approved_by=null,approved_at=null,revoked_at=now()
    where user_id=p_user_id and portal=p_portal and role=p_role
      and revoked_at is null
    returning id into v_id;
  end if;
  if v_id is null then
    raise exception 'No matching assignment in the required state' using errcode='22023';
  end if;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'portal_role_'||p_action,'portal_role_assignment',v_id,
      jsonb_build_object('user_id',p_user_id,'portal',p_portal,'role',p_role));
  return v_id;
end;
$$;
revoke all on function public.upt_admin_set_portal_role(uuid,text,text,text) from public,anon;
grant execute on function public.upt_admin_set_portal_role(uuid,text,text,text) to authenticated;
