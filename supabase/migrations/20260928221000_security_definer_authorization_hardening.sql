create or replace function public.upt_admin_login_success(
  p_login text,
  p_ip text default null,
  p_location text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','upt_private','auth'
as $$
declare
  v_actor uuid:=auth.uid();
  v_key text:=lower(trim(coalesce(p_login,'')));
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Aanmelden vereist.';
  end if;

  select failed_attempts into v_count
  from upt_private.admin_login_attempts
  where login_key=v_key;

  if coalesce(v_count,0)>0 then
    insert into upt_private.admin_login_security_events(
      event_type,login_key,failed_attempts,ip_address,approximate_location,user_agent
    )
    values(
      'successful_login_after_failures',v_key,v_count,
      left(p_ip,128),left(p_location,300),left(p_user_agent,1000)
    );
  end if;

  delete from upt_private.admin_login_attempts where login_key=v_key;
end;
$$;

create or replace function public.upt_event_readiness_details(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public','auth'
as $$
declare
  v_actor uuid:=auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'Aanmelden vereist.';
  end if;

  if not public.upt_is_admin(v_actor)
     and not exists(
       select 1 from public.event_members em
       where em.event_id=p_event and em.user_id=v_actor
     )
     and not public.upt_is_responsible(p_event,null,v_actor) then
    raise exception 'Geen toegang.';
  end if;

  select jsonb_build_object(
    'missingResponsibles',coalesce((
      select jsonb_agg(jsonb_build_object('workplaceId',w.id,'name',w.name) order by w.sort_order,w.name)
      from public.workplaces w
      where w.event_id=p_event and w.is_active=true
        and not exists(
          select 1 from public.responsible_assignments ra
          where ra.event_id=p_event and ra.workplace_id=w.id
        )
    ),'[]'::jsonb),
    'missingBriefings',coalesce((
      select jsonb_agg(jsonb_build_object('workplaceId',w.id,'name',w.name) order by w.sort_order,w.name)
      from public.workplaces w
      where w.event_id=p_event and w.is_active=true
        and not exists(
          select 1 from public.briefings b
          where b.event_id=p_event and (b.workplace_id=w.id or b.workplace_id is null)
        )
    ),'[]'::jsonb),
    'missingOpeningChecklists',coalesce((
      select jsonb_agg(jsonb_build_object('workplaceId',w.id,'name',w.name) order by w.sort_order,w.name)
      from public.workplaces w
      where w.event_id=p_event and w.is_active=true
        and not exists(
          select 1 from public.operational_checklists c
          where c.event_id=p_event and c.workplace_id=w.id and c.kind='opening'
        )
    ),'[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.upt_admin_login_success(text,text,text,text) from public,anon;
grant execute on function public.upt_admin_login_success(text,text,text,text) to authenticated;

revoke all on function public.upt_event_readiness_details(uuid) from public,anon;
grant execute on function public.upt_event_readiness_details(uuid) to authenticated;

notify pgrst,'reload schema';
