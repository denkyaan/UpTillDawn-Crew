-- Keep assigned crew event/workplace chat readable for exactly three days after event end,
-- including events whose lifecycle status is archived/closed by upt_close_event.
create or replace function public.upt_can_read_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $$
  select public.upt_is_approved()
    and exists(
      select 1
      from public.chat_channels c
      where c.id=p_channel
        and (
          c.kind='organization'
          or (
            c.kind='event'
            and c.event_id is not null
            and exists(
              select 1 from public.events e
              where e.id=c.event_id
                and now()>=e.start_at
                and now()<=e.end_at+interval '3 days'
            )
            and (
              public.upt_is_admin()
              or exists(select 1 from public.event_members em where em.event_id=c.event_id and em.user_id=auth.uid())
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.user_id=auth.uid() and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
              or exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=auth.uid())
            )
          )
          or (
            c.kind='workplace'
            and c.event_id is not null
            and c.workplace_id is not null
            and exists(
              select 1 from public.events e
              where e.id=c.event_id
                and now()>=e.start_at
                and now()<=e.end_at+interval '3 days'
            )
            and (
              public.upt_is_admin()
              or public.upt_is_responsible(c.event_id,c.workplace_id,auth.uid())
              or exists(select 1 from public.shifts s where s.event_id=c.event_id and s.workplace_id=c.workplace_id and s.user_id=auth.uid() and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
            )
          )
        )
    );
$$;
revoke all on function public.upt_can_read_channel(uuid) from public,anon;
grant execute on function public.upt_can_read_channel(uuid) to authenticated;
notify pgrst,'reload schema';
