create or replace function public.upt_feature_visible(
  p_feature text,
  p_event uuid default null,
  p_workplace uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  v_user uuid:=auth.uid();
  v_role text;
  v_rule public.role_ui_rules%rowtype;
begin
  if v_user is null or not public.upt_is_approved() then return false; end if;

  v_role:=public.upt_effective_role(v_user);
  if v_role='employee' then v_role:='staff'; end if;
  if v_role not in ('staff','responsible_lead','admin') then return false; end if;

  select * into v_rule
  from public.role_ui_rules r
  where r.role=v_role and r.feature_key=p_feature;

  if not found or not v_rule.visible then return false; end if;

  case v_rule.condition_key
    when 'always' then return true;
    when 'assigned_event' then
      return exists(
        select 1 from public.event_members em
        where em.user_id=v_user
          and (p_event is null or em.event_id=p_event)
          and exists(
            select 1 from public.events e
            where e.id=em.event_id and e.status<>'archived' and now()<=e.end_at
          )
      );
    when 'assigned_workplace_role' then
      return exists(
        select 1
        from public.shifts s join public.events e on e.id=s.event_id
        where s.user_id=v_user and s.status<>'cancelled'
          and (p_event is null or s.event_id=p_event)
          and (p_workplace is null or s.workplace_id=p_workplace)
          and e.status<>'archived' and now()<=e.end_at
      ) or exists(
        select 1
        from public.responsible_assignments r join public.events e on e.id=r.event_id
        where r.user_id=v_user
          and (p_event is null or r.event_id=p_event)
          and (p_workplace is null or r.workplace_id=p_workplace)
          and e.status<>'archived' and now()<=e.end_at
      );
    when 'event_active' then
      return exists(
        select 1
        from public.event_members em join public.events e on e.id=em.event_id
        where em.user_id=v_user
          and (p_event is null or e.id=p_event)
          and e.status<>'archived'
          and now() between e.start_at and e.end_at
      );
    when 'shift_active' then
      return exists(
        select 1
        from public.shifts s join public.events e on e.id=s.event_id
        where s.user_id=v_user and s.status<>'cancelled'
          and (p_event is null or s.event_id=p_event)
          and (p_workplace is null or s.workplace_id=p_workplace)
          and now() between s.scheduled_start and s.scheduled_end
          and e.status<>'archived'
      );
    when 'never' then return false;
    else return false;
  end case;
end;
$$;

create or replace function public.upt_feature_allowed(
  p_feature text,
  p_event uuid default null,
  p_workplace uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  v_role text;
  v_enabled boolean;
begin
  if auth.uid() is null or not public.upt_is_approved() then return false; end if;

  v_role:=public.upt_effective_role(auth.uid());
  if v_role='employee' then v_role:='staff'; end if;
  if v_role not in ('staff','responsible_lead','admin') then return false; end if;

  if not public.upt_feature_visible(p_feature,p_event,p_workplace) then return false; end if;

  select enabled into v_enabled
  from public.role_ui_rules
  where role=v_role and feature_key=p_feature;

  return coalesce(v_enabled,false);
end;
$$;

notify pgrst,'reload schema';
