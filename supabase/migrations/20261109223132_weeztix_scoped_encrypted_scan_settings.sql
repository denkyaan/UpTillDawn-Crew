-- Allow the single event's assigned entrance crew to read an encrypted
-- Weeztix credential payload; keep plaintext and the master key on Worker.
create or replace function public.upt_weeztix_scan_secrets(
  p_event_id uuid, p_workplace_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ciphertext text;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p
    where p.id=v_uid and p.approved is true
      and coalesce(p.account_blocked,false) is false
  ) then
    raise exception 'scan_permission_denied' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.workplaces w
    join public.events e on e.id=w.event_id
    where w.id=p_workplace_id and w.event_id=p_event_id
      and w.is_active is true
      and e.status is distinct from 'archived'
      and (
        select coalesce(
          bool_and(p.name = any(array[
            'inkom','entrance','entree','entrée','eingang','toegang',
            'ticket scan','ticket scanning','ticketscan','ticket scanner',
            'ticketcontrole','ticketkontrolle','controle des billets',
            'guestlist','guest list'
          ])) and
          bool_or(p.name = any(array[
            'inkom','entrance','entree','entrée','eingang','toegang',
            'ticket scan','ticket scanning','ticketscan','ticket scanner',
            'ticketcontrole','ticketkontrolle','controle des billets'
          ])),false)
        from (
          select btrim(part) as name
          from regexp_split_to_table(
            regexp_replace(lower(btrim(w.name)), '[[:space:]]+', ' ', 'g'),
            '[[:space:]]*[/&+|–—-][[:space:]]*'
          ) part
        ) p
      )
  ) then
    raise exception 'scan_permission_denied' using errcode='42501';
  end if;

  if not public.upt_is_admin(v_uid)
     and not exists (
       select 1 from public.shifts s
       where s.user_id=v_uid and s.event_id=p_event_id
         and s.workplace_id=p_workplace_id
         and s.status is distinct from 'cancelled'
         and s.response_status is distinct from 'declined'
     )
     and not exists (
       select 1 from public.responsible_assignments a
       where a.user_id=v_uid and a.event_id=p_event_id
         and a.workplace_id=p_workplace_id
     )
  then
    raise exception 'scan_permission_denied' using errcode='42501';
  end if;

  select c.encrypted_credentials into v_ciphertext
  from upt_private.integration_connections c
  where c.provider='weeztix';

  if v_ciphertext is null then return jsonb_build_object('configured',false); end if;
  return jsonb_build_object('configured',true,'ciphertext',v_ciphertext);
end
$$;
revoke all on function public.upt_weeztix_scan_secrets(uuid,uuid) from public,anon,authenticated;
grant execute on function public.upt_weeztix_scan_secrets(uuid,uuid) to authenticated;
