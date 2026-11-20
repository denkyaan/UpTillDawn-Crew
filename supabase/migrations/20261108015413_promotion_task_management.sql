-- General promotion work has no event. Keep every existing operational task
-- event-bound and use a separate flag for the new, narrowly scoped exception.
alter table public.tasks add column promotion_only boolean not null default false;
alter table public.tasks alter column event_id drop not null;
alter table public.tasks add constraint tasks_general_promotion_scope
 check (event_id is not null or (promotion_only and workplace_id is null));
alter table public.tasks add constraint tasks_promotion_without_workplace
 check (not promotion_only or workplace_id is null);

create function upt_private.promotion_task_access()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.upt_is_admin() or exists(
  select 1 from public.profiles p join public.portal_role_assignments a on a.user_id=p.id
  where p.id=auth.uid() and p.approved and not coalesce(p.account_blocked,false)
   and a.portal='promotion' and a.approved and a.revoked_at is null
 ));
$$;
revoke all on function upt_private.promotion_task_access() from public,anon;
grant execute on function upt_private.promotion_task_access() to authenticated;

-- The ordinary event feature window remains unchanged. General promotion tasks
-- additionally require current Promotion access and the existing own-row policy.
alter policy upt_role_feature_window on public.tasks using (
 public.upt_is_admin() or case when promotion_only then (select upt_private.promotion_task_access())
 else public.upt_feature_visible('tasks',event_id,workplace_id) end
);
alter policy upt_role_feature_window on public.task_assignments using (
 public.upt_is_admin() or exists(select 1 from public.tasks t where t.id=task_id and (
  case when t.promotion_only then (select upt_private.promotion_task_access())
  else public.upt_feature_visible('tasks',t.event_id,t.workplace_id) end
 ))
);

create function upt_private.require_promotion_task_member(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 perform p.id from public.profiles p join public.portal_role_assignments a on a.user_id=p.id
 where p.id=p_user and p.approved and not coalesce(p.account_blocked,false)
  and a.portal='promotion' and a.approved and a.revoked_at is null
  and not exists(select 1 from public.promotion_discipline d where d.user_id=p.id
   and (d.permanently_blocked or d.blocked_until>now()))
 order by a.role limit 1 for share of p,a;
 if not found then raise exception 'Active promotion member required' using errcode='42501'; end if;
end;
$$;
revoke all on function upt_private.require_promotion_task_member(uuid) from public,anon,authenticated;

create function upt_private.admin_promotion_task_members()
returns table(user_id uuid,full_name text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 return query select p.id,p.full_name from public.profiles p
 where p.approved and not coalesce(p.account_blocked,false)
 and exists(select 1 from public.portal_role_assignments a where a.user_id=p.id
  and a.portal='promotion' and a.approved and a.revoked_at is null)
 and not exists(select 1 from public.promotion_discipline d where d.user_id=p.id
  and (d.permanently_blocked or d.blocked_until>now()));
end;
$$;

create function upt_private.admin_assign_promotion_task(p_task uuid,p_user uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_assignment uuid;
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 perform 1 from public.tasks where id=p_task and promotion_only and event_id is null for update;
 if not found then raise exception 'General promotion task not found' using errcode='22023'; end if;
 perform upt_private.require_promotion_task_member(p_user);
 insert into public.task_assignments(task_id,user_id,assigned_by,status)
 values(p_task,p_user,auth.uid(),'NOT STARTED') on conflict(task_id,user_id) do nothing
 returning id into v_assignment;
 if v_assignment is null then
  select id into v_assignment from public.task_assignments where task_id=p_task and user_id=p_user;
 else
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'PROMOTION_TASK_ASSIGNED','task_assignment',v_assignment,
   jsonb_build_object('task_id',p_task,'user_id',p_user));
 end if;
 return v_assignment;
end;
$$;

create function upt_private.admin_create_promotion_task(p_request uuid,p_title text,p_description text,p_users uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype; v_user uuid; v_users uuid[]; v_inserted uuid;
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 if p_request is null or p_title is null or length(btrim(p_title)) not between 1 and 200
  or length(coalesce(p_description,''))>4000 or coalesce(cardinality(p_users),0) not between 1 and 100
  or array_position(p_users,null) is not null then
  raise exception 'Invalid promotion task' using errcode='22023';
 end if;
 select array_agg(u order by u) into v_users from (select distinct unnest(p_users) u) s;
 insert into public.tasks(id,event_id,workplace_id,promotion_only,title,description,created_by)
 values(p_request,null,null,true,btrim(p_title),coalesce(p_description,''),auth.uid())
 on conflict(id) do nothing returning id into v_inserted;
 select * into v_task from public.tasks where id=p_request for update;
 if v_inserted is null then
  if not v_task.promotion_only or v_task.event_id is not null or v_task.created_by is distinct from auth.uid()
   or v_task.title is distinct from btrim(p_title) or v_task.description is distinct from coalesce(p_description,'')
   or (select array_agg(user_id order by user_id) from public.task_assignments where task_id=p_request) is distinct from v_users then
   raise exception 'Conflicting promotion task request' using errcode='22023';
  end if;
  return p_request;
 end if;
 foreach v_user in array v_users loop
  perform upt_private.admin_assign_promotion_task(p_request,v_user);
 end loop;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'PROMOTION_TASK_CREATED','task',p_request,jsonb_build_object('members',cardinality(v_users)));
 return p_request;
end;
$$;

create function upt_private.admin_update_promotion_task(p_task uuid,p_title text,p_description text,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype;
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or length(coalesce(p_description,''))>4000 then
  raise exception 'Invalid promotion task' using errcode='22023';
 end if;
 select * into v_task from public.tasks where id=p_task and promotion_only and event_id is null for update;
 if not found then raise exception 'General promotion task not found' using errcode='22023'; end if;
 if p_expected_updated_at is null or v_task.updated_at is distinct from p_expected_updated_at then
  raise exception 'Promotion task changed; reload before editing' using errcode='40001';
 end if;
 update public.tasks set title=btrim(p_title),description=coalesce(p_description,''),updated_at=clock_timestamp() where id=p_task;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'PROMOTION_TASK_UPDATED','task',p_task,jsonb_build_object('old_title',v_task.title,'new_title',btrim(p_title),
  'old_description',v_task.description,'new_description',coalesce(p_description,'')));
 return p_task;
end;
$$;

create function upt_private.start_promotion_task(p_assignment uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype; v_assignment public.task_assignments%rowtype; v_task_id uuid;
begin
 if auth.uid() is null or not upt_private.promotion_task_access() or public.upt_promotion_is_blocked() then
  raise exception 'Promotion access denied' using errcode='42501';
 end if;
 select task_id into v_task_id from public.task_assignments where id=p_assignment and user_id=auth.uid();
 select * into v_task from public.tasks where id=v_task_id for share;
 if not found then raise exception 'Assigned task not found' using errcode='42501'; end if;
 select * into v_assignment from public.task_assignments where id=p_assignment and user_id=auth.uid() for update;
 if not found or v_assignment.status not in ('NOT STARTED','IN PROGRESS') then
  raise exception 'Only open assigned promotion work can be started' using errcode='42501';
 end if;
 if v_task.event_id is not null and (
  not upt_private.event_operational(v_task.event_id)
  or not exists(select 1 from public.event_members where event_id=v_task.event_id and user_id=auth.uid())
  or (v_task.workplace_id is not null and not exists(select 1 from public.shifts where event_id=v_task.event_id
    and workplace_id=v_task.workplace_id and user_id=auth.uid() and status<>'cancelled'))
  or not public.upt_feature_allowed('tasks',v_task.event_id,v_task.workplace_id)
 ) then raise exception 'Event task access denied' using errcode='42501'; end if;
 if v_assignment.status='IN PROGRESS' and v_assignment.confirmed_at is not null then return p_assignment; end if;
 update public.task_assignments set status='IN PROGRESS',confirmed_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_assignment;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'PROMOTION_TASK_STARTED','task_assignment',p_assignment,jsonb_build_object('task_id',v_task.id));
 return p_assignment;
end;
$$;

-- Public RPCs are invoker wrappers; all privileged logic stays in upt_private.
create function public.upt_admin_promotion_task_members()
returns table(user_id uuid,full_name text) language sql stable security invoker set search_path='' as $$
 select * from upt_private.admin_promotion_task_members(); $$;
create function public.upt_admin_create_promotion_task(p_request uuid,p_title text,p_description text,p_users uuid[])
returns uuid language sql security invoker set search_path='' as $$
 select upt_private.admin_create_promotion_task(p_request,p_title,p_description,p_users); $$;
create function public.upt_admin_assign_promotion_task(p_task uuid,p_user uuid)
returns uuid language sql security invoker set search_path='' as $$
 select upt_private.admin_assign_promotion_task(p_task,p_user); $$;
create function public.upt_admin_update_promotion_task(p_task uuid,p_title text,p_description text,p_expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path='' as $$
 select upt_private.admin_update_promotion_task(p_task,p_title,p_description,p_expected_updated_at); $$;
create function public.upt_start_promotion_task(p_assignment uuid)
returns uuid language sql security invoker set search_path='' as $$
 select upt_private.start_promotion_task(p_assignment); $$;

revoke all on function upt_private.admin_promotion_task_members(),upt_private.admin_create_promotion_task(uuid,text,text,uuid[]),upt_private.admin_assign_promotion_task(uuid,uuid),upt_private.admin_update_promotion_task(uuid,text,text,timestamptz),upt_private.start_promotion_task(uuid) from public,anon;
grant execute on function upt_private.admin_promotion_task_members(),upt_private.admin_create_promotion_task(uuid,text,text,uuid[]),upt_private.admin_assign_promotion_task(uuid,uuid),upt_private.admin_update_promotion_task(uuid,text,text,timestamptz),upt_private.start_promotion_task(uuid) to authenticated;
revoke all on function public.upt_admin_promotion_task_members(),public.upt_admin_create_promotion_task(uuid,text,text,uuid[]),public.upt_admin_assign_promotion_task(uuid,uuid),public.upt_admin_update_promotion_task(uuid,text,text,timestamptz),public.upt_start_promotion_task(uuid) from public,anon;
grant execute on function public.upt_admin_promotion_task_members(),public.upt_admin_create_promotion_task(uuid,text,text,uuid[]),public.upt_admin_assign_promotion_task(uuid,uuid),public.upt_admin_update_promotion_task(uuid,text,text,timestamptz),public.upt_start_promotion_task(uuid) to authenticated;

create or replace function public.upt_notify_task_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype;
begin
 select * into v_task from public.tasks where id=new.task_id;
 insert into public.crew_notifications(user_id,title,body,kind,link)
 values(new.user_id,'Nieuwe taak',v_task.title,'task',case when v_task.promotion_only then '/portals/promotion/tasks' else '/tasks' end);
 return new;
end;
$$;
create or replace function public.upt_task_reconfirm_after_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if row(new.title,new.description,new.workplace_id) is distinct from row(old.title,old.description,old.workplace_id) then
  update public.task_assignments set confirmed_at=null,updated_at=now() where task_id=new.id;
  insert into public.crew_notifications(user_id,title,body,kind,link)
  select ta.user_id,'Taak gewijzigd — bevestig opnieuw',new.title,'task',
   case when new.promotion_only then '/portals/promotion/tasks' else '/tasks' end
  from public.task_assignments ta where ta.task_id=new.id;
 end if;
 return new;
end;
$$;

create function upt_private.promotion_evidence_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.task_assignments a join public.tasks t on t.id=a.task_id
  where a.id=new.assignment_id and t.promotion_only and a.confirmed_at is null) then
  raise exception 'Confirm the current promotion task before submitting evidence' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function upt_private.promotion_evidence_confirmation() from public,anon,authenticated;
create trigger upt_promotion_evidence_confirmation before insert on public.promotion_evidence
 for each row execute function upt_private.promotion_evidence_confirmation();
notify pgrst,'reload schema';
