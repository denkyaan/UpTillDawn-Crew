-- Restrict the two dedicated promotion organization chats to approved promoters and admins.
-- Existing organization channels retain their previous access behavior.
create or replace function public.upt_can_read_channel(p_channel uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $function$
  select public.upt_is_approved()
    and exists (
      select 1 from public.chat_channels c
      where c.id = p_channel
        and (
          (
            c.kind = 'organization'
            and (
              c.name not in ('Promo groep Up Till Dawn', 'Up Till Dawn · Promotie')
              or public.upt_is_admin()
              or exists (
                select 1 from public.portal_role_assignments pra
                where pra.user_id = (select auth.uid())
                  and pra.portal = 'promotion'
                  and pra.role = 'promoter'
                  and pra.approved = true
                  and pra.revoked_at is null
              )
            )
          )
          or (
            c.kind = 'private'
            and exists (
              select 1 from public.chat_members cm
              where cm.channel_id = c.id and cm.user_id = (select auth.uid())
            )
            and (
              (c.name = 'Up Till Dawn · persoonlijk'
                and 1 = (select count(*) from public.chat_members cm2 where cm2.channel_id = c.id))
              or (c.name is null
                and 2 = (select count(*) from public.chat_members cm3 where cm3.channel_id = c.id))
            )
          )
          or (
            c.kind = 'event'
            and c.event_id is not null
            and exists (
              select 1 from public.events e
              where e.id = c.event_id
                and now() >= e.start_at
                and now() <= e.end_at + interval '3 days'
            )
            and (
              public.upt_is_admin()
              or exists (select 1 from public.event_members em where em.event_id = c.event_id and em.user_id = (select auth.uid()))
              or exists (select 1 from public.shifts s where s.event_id = c.event_id and s.user_id = (select auth.uid()) and s.status <> 'cancelled' and coalesce(s.response_status, '') <> 'declined')
              or exists (select 1 from public.responsible_assignments ra where ra.event_id = c.event_id and ra.user_id = (select auth.uid()))
            )
          )
          or (
            c.kind = 'workplace'
            and c.event_id is not null and c.workplace_id is not null
            and exists (
              select 1 from public.events e
              where e.id = c.event_id
                and now() >= e.start_at
                and now() <= e.end_at + interval '3 days'
            )
            and (
              public.upt_is_admin()
              or public.upt_is_responsible(c.event_id, c.workplace_id, (select auth.uid()))
              or exists (select 1 from public.shifts s where s.event_id = c.event_id and s.workplace_id = c.workplace_id and s.user_id = (select auth.uid()) and s.status <> 'cancelled' and coalesce(s.response_status, '') <> 'declined')
            )
          )
        )
    );
$function$;

insert into public.chat_channels (kind, name)
select 'organization', v.name
from (values ('Promo groep Up Till Dawn'), ('Up Till Dawn · Promotie')) as v(name)
where not exists (select 1 from public.chat_channels c where c.kind = 'organization' and c.name = v.name);
