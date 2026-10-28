-- Dedicated promotion conversations, independent of crew-wide organization chat.
create table if not exists public.promotion_chat_messages (
 id uuid primary key default gen_random_uuid(),
 room text not null check(room in ('general','announcements')),
 sender_id uuid not null references public.profiles(id),
 body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists promotion_chat_messages_room_created_idx
 on public.promotion_chat_messages(room,created_at desc);
alter table public.promotion_chat_messages enable row level security;

create or replace function public.upt_promotion_chat_allowed()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid())
 and p.approved and not coalesce(p.account_blocked,false)
 and (p.role='admin' or exists(
 select 1 from public.portal_role_assignments a
 where a.user_id=p.id and a.portal='promotion'
 and a.approved and a.revoked_at is null)));
$$;
revoke all on function public.upt_promotion_chat_allowed() from public,anon;
grant execute on function public.upt_promotion_chat_allowed() to authenticated;

drop policy if exists promotion_chat_read on public.promotion_chat_messages;
create policy promotion_chat_read on public.promotion_chat_messages
 for select to authenticated using (public.upt_promotion_chat_allowed());
drop policy if exists promotion_chat_send on public.promotion_chat_messages;
create policy promotion_chat_send on public.promotion_chat_messages
 for insert to authenticated with check (
 sender_id=(select auth.uid()) and public.upt_promotion_chat_allowed()
 and (room='general' or public.upt_is_admin())
);
revoke all on public.promotion_chat_messages from anon;
grant select,insert on public.promotion_chat_messages to authenticated;
notify pgrst,'reload schema';
