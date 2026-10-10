-- Keep the first-use approval gate consistent with the profile form:
-- admins supply name, phone, date of birth and photo; staff/responsible
-- also supply address, national register number and IBAN.
-- Called only by the authenticated owner of the profile.
create or replace function public.upt_mark_own_profile_complete()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  p public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Aanmelden vereist.';
  end if;
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then
    raise exception 'Profiel niet gevonden.';
  end if;
  if nullif(btrim(p.full_name),'') is null
    or nullif(btrim(p.phone_number),'') is null
    or p.date_of_birth is null
    or nullif(btrim(p.profile_photo_url),'') is null
  then
    raise exception 'Vul eerst de verplichte profielvelden en een profielfoto in.';
  end if;
  if p.role <> 'admin'
     and (nullif(btrim(p.home_address),'') is null
       or nullif(btrim(p.national_register_number),'') is null
       or nullif(btrim(p.iban),'') is null)
  then
    raise exception 'Vul eerst alle verplichte profielvelden in.';
  end if;
  update public.profiles
     set app_profile_completed_at = coalesce(app_profile_completed_at, now()),
         updated_at = now()
   where id = auth.uid();
  return true;
end;
$function$;

revoke all on function public.upt_mark_own_profile_complete() from public, anon;
grant execute on function public.upt_mark_own_profile_complete() to authenticated;
notify pgrst, 'reload schema';
