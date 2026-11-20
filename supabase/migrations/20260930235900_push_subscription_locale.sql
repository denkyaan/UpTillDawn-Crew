-- Persist the UI locale per push endpoint so background notifications follow the device/app language.
alter table public.push_subscriptions
  add column if not exists locale text not null default 'nl'
  check (locale in ('nl','fr','en','de'));

create or replace function public.upt_save_push_subscription(
  p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null,p_locale text default 'nl'
)
returns uuid
language plpgsql security definer
set search_path='pg_catalog','public'
as $body$
declare v_user uuid:=auth.uid(); v_id uuid; v_locale text:=lower(coalesce(p_locale,'nl'));
begin
  if v_user is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if char_length(coalesce(p_endpoint,'')) not between 20 and 4096
    or char_length(coalesce(p_p256dh,'')) not between 20 and 512
    or char_length(coalesce(p_auth,'')) not between 8 and 256 then
    raise exception 'Ongeldige push-subscriptie.';
  end if;
  if v_locale not in ('nl','fr','en','de') then v_locale:='nl'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key,user_agent,locale,enabled,updated_at)
  values(v_user,p_endpoint,p_p256dh,p_auth,left(nullif(p_user_agent,''),500),v_locale,true,now())
  on conflict(endpoint) do update
  set user_id=excluded.user_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key,
      user_agent=excluded.user_agent,locale=excluded.locale,enabled=true,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$body$;
revoke all on function public.upt_save_push_subscription(text,text,text,text,text) from public,anon;
grant execute on function public.upt_save_push_subscription(text,text,text,text,text) to authenticated;
