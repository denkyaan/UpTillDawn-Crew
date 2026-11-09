
-- Preserve existing Promotion group conversations and upgrade them with
-- threaded replies and per-room read receipts without weakening room RLS.
alter table public.promotion_chat_messages
 add column if not exists reply_to_message_id uuid
 references public.promotion_chat_messages(id) on delete set null;

create index if not exists promotion_chat_reply_idx
 on public.promotion_chat_messages(reply_to_message_id)
 where reply_to_message_id is not null;

create or replace function public.upt_validate_promotion_chat_reply()
returns trigger language plpgsql set search_path='pg_catalog','public'
as $fn$
begin
 if new.reply_to_message_id is not null and not exists(
  select 1 from public.promotion_chat_messages previous
  where previous.id=new.reply_to_message_id and previous.room=new.room
 ) then
  raise exception 'Reply must belong to the same Promotion room' using errcode='23514';
 end if;
 return new;
end;
$fn$;

drop trigger if exists upt_promotion_reply_guard on public.promotion_chat_messages;
create trigger upt_promotion_reply_guard
 before insert on public.promotion_chat_messages
 for each row execute function public.upt_validate_promotion_chat_reply();

create table if not exists upt_private.promotion_chat_read_states(
 user_id uuid not null references public.profiles(id) on delete cascade,
 room text not null check(room in ('general','announcements')),
 last_read_at timestamptz not null default now(),
 primary key(user_id,room)
);
alter table upt_private.promotion_chat_read_states enable row level security;
revoke all on upt_private.promotion_chat_read_states from public,anon,authenticated;

create or replace function public.upt_promotion_chat_mark_read(p_room text)
returns void language plpgsql security definer
set search_path='pg_catalog','public','upt_private' as $fn$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or p_room is null or p_room not in ('general','announcements')
 or not public.upt_promotion_chat_allowed() then
  raise exception 'No access to Promotion read state' using errcode='42501';
 end if;
 insert into upt_private.promotion_chat_read_states(user_id,room,last_read_at)
 values(v_actor,p_room,clock_timestamp())
 on conflict (user_id,room)
 do update set last_read_at=greatest(upt_private.promotion_chat_read_states.last_read_at,excluded.last_read_at);
end;
$fn$;
revoke all on function public.upt_promotion_chat_mark_read(text) from public,anon;
grant execute on function public.upt_promotion_chat_mark_read(text) to authenticated;

create or replace function public.upt_promotion_chat_unread_counts()
returns table(room text,unread_count bigint)
language plpgsql security definer
set search_path='pg_catalog','public','upt_private' as $fn$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not public.upt_promotion_chat_allowed() then
  raise exception 'No access to Promotion unread count' using errcode='42501';
 end if;
 insert into upt_private.promotion_chat_read_states(user_id,room,last_read_at)
 select v_actor,v.room,now() from (values('general'::text),('announcements'::text)) v(room)
 on conflict(user_id,room) do nothing;
 return query
 select r.room,
  (select count(*) from public.promotion_chat_messages m
   where m.room=r.room and m.sender_id<>v_actor and m.created_at>r.last_read_at)::bigint
 from upt_private.promotion_chat_read_states r
 where r.user_id=v_actor order by r.room;
end;
$fn$;
revoke all on function public.upt_promotion_chat_unread_counts() from public,anon;
grant execute on function public.upt_promotion_chat_unread_counts() to authenticated;

create or replace function public.upt_promotion_chat_readers(p_message uuid)
returns table(user_id uuid,full_name text,read_at timestamptz)
language plpgsql stable security definer
set search_path='pg_catalog','public','upt_private' as $fn$
declare v_room text;v_created timestamptz;
begin
 if auth.uid() is null or not public.upt_promotion_chat_allowed() then
  raise exception 'No access to Promotion readers' using errcode='42501';
 end if;
 select m.room,m.created_at into v_room,v_created
 from public.promotion_chat_messages m where m.id=p_message;
 if v_room is null then raise exception 'Message not available' using errcode='42501'; end if;
 return query
 select p.id,p.full_name,r.last_read_at
 from upt_private.promotion_chat_read_states r
 join public.profiles p on p.id=r.user_id and p.approved=true and not coalesce(p.account_blocked,false)
 where r.room=v_room and r.last_read_at>=v_created and r.user_id<>auth.uid()
 and exists(select 1 from public.upt_promotion_directory() d where d.id=r.user_id and d.portal_label='promotion')
 order by r.last_read_at desc,p.full_name limit 200;
end;
$fn$;
revoke all on function public.upt_promotion_chat_readers(uuid) from public,anon;
grant execute on function public.upt_promotion_chat_readers(uuid) to authenticated;
notify pgrst,'reload schema';
