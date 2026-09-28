
create or replace function upt_private.require_event_onboarding_before_checkin()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_enabled boolean:=false;
begin
  select fr.enabled
  into v_enabled
  from public.feature_rollouts fr
  where fr.feature_key='eventOnboarding';

  if coalesce(v_enabled,false)
     and exists(select 1 from public.events e where e.id=new.event_id and e.onboarding_required=true)
     and not exists(
       select 1 from public.event_onboarding_progress p
       where p.event_id=new.event_id
         and p.user_id=new.user_id
         and p.step='confirmed'
     )
  then
    raise exception 'Rond eerst de evenement-onboarding af.';
  end if;
  return new;
end;
$fn$;

update public.feature_rollouts
set enabled=false,
    notes='Frontend deployment pending; enforcement activates after onboarding UI is live.',
    updated_at=now()
where feature_key='eventOnboarding';

notify pgrst,'reload schema';
