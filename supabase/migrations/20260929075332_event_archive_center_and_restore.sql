alter table public.events
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid,
  add column if not exists pre_archive_status text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='events_archived_by_fkey') then
    alter table public.events
      add constraint events_archived_by_fkey foreign key (archived_by) references public.profiles(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='events_restored_by_fkey') then
    alter table public.events
      add constraint events_restored_by_fkey foreign key (restored_by) references public.profiles(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='events_archive_reason_length') then
    alter table public.events
      add constraint events_archive_reason_length check (archive_reason is null or length(archive_reason)<=1000);
  end if;
end $$;

create index if not exists events_archive_center_idx
  on public.events(status, archived_at desc);

update public.events
set archived_at=coalesce(archived_at,updated_at),
    pre_archive_status=coalesce(pre_archive_status,case when end_at<=now() then 'closed' else 'draft' end)
where status='archived';

create or replace function public.upt_archive_event(p_event uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid(); v_status text;
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement archiveren.'; end if;
 select status into v_status from public.events where id=p_event for update;
 if v_status is null then raise exception 'Evenement niet gevonden.'; end if;
 if v_status='archived' then return; end if;
 if v_status<>'closed' then raise exception 'Sluit het evenement eerst af voordat je het archiveert.'; end if;
 if exists(select 1 from public.work_sessions where event_id=p_event and ended_at is null) then raise exception 'Sluit eerst alle actieve werkuren.'; end if;
 update public.events set pre_archive_status=v_status,status='archived',archived_at=now(),archived_by=v_actor,archive_reason=null,restored_at=null,restored_by=null,updated_at=now() where id=p_event;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_actor,'event.archived','event',p_event,jsonb_build_object('forced',false,'previousStatus',v_status));
end;$$;
revoke all on function public.upt_archive_event(uuid) from public,anon;
grant execute on function public.upt_archive_event(uuid) to authenticated;

create or replace function public.upt_force_archive_event(p_event uuid,p_reason text)
returns void language plpgsql security definer set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid(); v_status text; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement geforceerd archiveren.'; end if;
 if v_reason is null or length(v_reason)<5 then raise exception 'Geef een reden van minstens 5 tekens voor geforceerd archiveren.'; end if;
 select status into v_status from public.events where id=p_event for update;
 if v_status is null then raise exception 'Evenement niet gevonden.'; end if;
 if v_status='archived' then return; end if;
 if exists(select 1 from public.work_sessions where event_id=p_event and ended_at is null) then raise exception 'Sluit eerst alle actieve werkuren.'; end if;
 update public.events set pre_archive_status=v_status,status='archived',archived_at=now(),archived_by=v_actor,archive_reason=left(v_reason,1000),restored_at=null,restored_by=null,updated_at=now() where id=p_event;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_actor,'event.archived','event',p_event,jsonb_build_object('forced',true,'reason',left(v_reason,1000),'previousStatus',v_status));
end;$$;
revoke all on function public.upt_force_archive_event(uuid,text) from public,anon;
grant execute on function public.upt_force_archive_event(uuid,text) to authenticated;

create or replace function public.upt_restore_event(p_event uuid,p_reason text default null)
returns void language plpgsql security definer set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid(); v_status text; v_previous text; v_end timestamptz; v_restore_status text; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een gearchiveerd evenement herstellen.'; end if;
 select status,pre_archive_status,end_at into v_status,v_previous,v_end from public.events where id=p_event for update;
 if v_status is null then raise exception 'Evenement niet gevonden.'; end if;
 if v_status<>'archived' then raise exception 'Dit evenement is niet gearchiveerd.'; end if;
 v_restore_status:=coalesce(nullif(v_previous,'archived'),case when v_end<=now() then 'closed' else 'draft' end);
 update public.events set status=v_restore_status,restored_at=now(),restored_by=v_actor,updated_at=now() where id=p_event;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_actor,'event.restored','event',p_event,jsonb_build_object('restoredStatus',v_restore_status,'reason',v_reason));
end;$$;
revoke all on function public.upt_restore_event(uuid,text) from public,anon;
grant execute on function public.upt_restore_event(uuid,text) to authenticated;

notify pgrst,'reload schema';
