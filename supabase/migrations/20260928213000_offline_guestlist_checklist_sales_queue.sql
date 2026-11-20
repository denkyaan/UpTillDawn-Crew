create or replace function public.upt_sync_operation(p_id uuid,p_type text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  old public.offline_operation_records%rowtype;
  result_value jsonb;
  entity uuid;
  workplace uuid;
  event uuid;
  evidence jsonb;
  session_ref uuid;
  break_ref uuid;
  channel_event uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid operation'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into old from public.offline_operation_records where id=p_id;
  if found then
    if old.user_id<>auth.uid() or old.operation_type<>p_type or old.payload<>p_payload then raise exception 'Operation ID conflict'; end if;
    return old.result;
  end if;

  case p_type
    when 'start_work' then entity:=public.upt_start_work((p_payload->>'event_id')::uuid,(p_payload->>'shift_id')::uuid);
    when 'start_break' then
      session_ref:=nullif(p_payload->>'session_id','')::uuid;
      if session_ref is null and nullif(p_payload->>'session_operation_id','') is not null then
        select (r.result->>'id')::uuid into session_ref from public.offline_operation_records r
        where r.id=(p_payload->>'session_operation_id')::uuid and r.user_id=auth.uid() and r.operation_type='start_work';
      end if;
      if session_ref is null then raise exception 'Missing work-session dependency'; end if;
      entity:=public.upt_start_break(session_ref);
    when 'stop_break' then
      break_ref:=nullif(p_payload->>'break_id','')::uuid;
      if break_ref is null and nullif(p_payload->>'break_operation_id','') is not null then
        select (r.result->>'id')::uuid into break_ref from public.offline_operation_records r
        where r.id=(p_payload->>'break_operation_id')::uuid and r.user_id=auth.uid() and r.operation_type='start_break';
      end if;
      if break_ref is null then raise exception 'Missing break dependency'; end if;
      perform public.upt_stop_break(break_ref); entity:=break_ref;
    when 'stop_work' then
      session_ref:=nullif(p_payload->>'session_id','')::uuid;
      if session_ref is null and nullif(p_payload->>'session_operation_id','') is not null then
        select (r.result->>'id')::uuid into session_ref from public.offline_operation_records r
        where r.id=(p_payload->>'session_operation_id')::uuid and r.user_id=auth.uid() and r.operation_type='start_work';
      end if;
      if session_ref is null then raise exception 'Missing work-session dependency'; end if;
      perform public.upt_stop_work(session_ref); entity:=session_ref;
    when 'transition' then
      session_ref:=nullif(p_payload->>'session_id','')::uuid;
      if session_ref is null and nullif(p_payload->>'session_operation_id','') is not null then
        select (r.result->>'id')::uuid into session_ref from public.offline_operation_records r
        where r.id=(p_payload->>'session_operation_id')::uuid and r.user_id=auth.uid() and r.operation_type='start_work';
      end if;
      if session_ref is null then raise exception 'Missing work-session dependency'; end if;
      entity:=public.upt_confirm_workplace_transition(session_ref,(p_payload->>'workplace_id')::uuid);
    when 'task' then
      perform public.upt_update_task_status((p_payload->>'assignment_id')::uuid,p_payload->>'status');
      entity:=(p_payload->>'assignment_id')::uuid;
    when 'message' then
      if not public.upt_can_read_channel((p_payload->>'channel_id')::uuid) or length(trim(coalesce(p_payload->>'body',''))) not between 1 and 4000 then raise exception 'Invalid message'; end if;
      select event_id into channel_event from public.chat_channels where id=(p_payload->>'channel_id')::uuid;
      if not public.upt_feature_allowed('chat',channel_event,null) then raise exception 'Chat is momenteel alleen-lezen.'; end if;
      insert into public.messages(user_id,sender_id,channel_id,body,content)
      values(auth.uid(),auth.uid(),(p_payload->>'channel_id')::uuid,trim(p_payload->>'body'),trim(p_payload->>'body')) returning id into entity;
    when 'incident' then
      event:=(p_payload->>'event_id')::uuid; workplace:=nullif(p_payload->>'workplace_id','')::uuid;
      entity:=public.upt_create_incident(event,workplace,trim(coalesce(p_payload->>'message','')),null,nullif(p_payload->>'latitude','')::numeric,nullif(p_payload->>'longitude','')::numeric,nullif(p_payload->>'accuracy','')::numeric);
      update public.incidents
      set category=case when p_payload->>'category' in ('medical','safety','security','equipment','technical','staff','general') then p_payload->>'category' else 'general' end,
          urgency=case when p_payload->>'urgency' in ('normal','high','urgent') then p_payload->>'urgency' else 'normal' end,
          people_involved=nullif(left(trim(coalesce(p_payload->>'people_involved','')),2000),'')
      where id=entity and reporter_id=auth.uid();
    when 'checklist_item' then
      entity:=(p_payload->>'item_id')::uuid;
      perform public.upt_set_operational_checklist_item(entity,coalesce((p_payload->>'complete')::boolean,true),nullif(p_payload->>'photo_path',''));
    when 'guestlist_checkin' then
      entity:=(p_payload->>'entry_id')::uuid;
      perform public.upt_guestlist_checkin(entity,greatest(-100,least(100,coalesce((p_payload->>'delta')::integer,1))));
    when 'sale' then
      entity:=public.upt_sales_record((p_payload->>'item_id')::uuid,greatest(1,least(1000,coalesce((p_payload->>'quantity')::integer,1))),p_payload->>'payment_method');
    else raise exception 'Unsupported operation';
  end case;

  if p_type in ('start_work','stop_work') then
    select event_id into event from public.work_sessions where id=entity and user_id=auth.uid();
    evidence:=public.upt_gps_assessment(event,nullif(p_payload->>'latitude','')::numeric,nullif(p_payload->>'longitude','')::numeric,nullif(p_payload->>'accuracy','')::numeric,p_payload->>'gps_status');
    if p_type='start_work' then update public.work_sessions set start_gps_status=evidence->>'status',start_gps_evidence=evidence where id=entity;
    else update public.work_sessions set stop_gps_status=evidence->>'status',stop_gps_evidence=evidence where id=entity; end if;
  end if;

  result_value:=jsonb_build_object('id',entity,'server_timestamp',now());
  insert into public.offline_operation_records(id,user_id,operation_type,payload,status,result,synced_at)
  values(p_id,auth.uid(),p_type,p_payload,'synced',result_value,now());
  return result_value;
end;
$$;
revoke all on function public.upt_sync_operation(uuid,text,jsonb) from public,anon;
grant execute on function public.upt_sync_operation(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
