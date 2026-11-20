create or replace function public.upt_set_own_workplace_preference(p_workplace uuid default null)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Aanmelden vereist.';
  end if;

  if p_workplace is not null and not exists(
    select 1 from public.workplace_catalog wc
    where wc.id=p_workplace and wc.is_active=true
  ) then
    raise exception 'Werkplekvoorkeur is niet geldig.';
  end if;

  update public.profiles
  set preferred_workplace_id=p_workplace,
      updated_at=now()
  where id=auth.uid();

  if not found then
    raise exception 'Profiel niet gevonden.';
  end if;
end;
$$;

revoke all on function public.upt_set_own_workplace_preference(uuid) from public,anon;
grant execute on function public.upt_set_own_workplace_preference(uuid) to authenticated;

notify pgrst,'reload schema';
