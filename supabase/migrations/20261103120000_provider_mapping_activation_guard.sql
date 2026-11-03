-- Enforce provider mapping approval in PostgreSQL, including direct PostgREST writes.
-- Existing administrative staff retain read/create access; only Admin may change activation.
revoke update on public.admin_provider_event_mappings from authenticated;
grant update (enabled) on public.admin_provider_event_mappings to authenticated;

drop policy if exists admin_provider_mapping_update on public.admin_provider_event_mappings;
create policy admin_provider_mapping_update on public.admin_provider_event_mappings
 for update to authenticated
 using (public.upt_is_admin())
 with check (public.upt_is_admin());

create or replace function public.upt_guard_provider_mapping()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.enabled is distinct from false then
   raise exception 'Provider mappings must start disabled' using errcode='42501';
  end if;
  if new.created_by is distinct from auth.uid() then
   raise exception 'Mapping creator must match authenticated user' using errcode='42501';
  end if;
  return new;
 end if;
 if not public.upt_is_admin() then
  raise exception 'Admin approval required' using errcode='42501';
 end if;
 if new.id is distinct from old.id
 or new.provider is distinct from old.provider
 or new.external_event_id is distinct from old.external_event_id
 or new.event_id is distinct from old.event_id
 or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at then
  raise exception 'Provider mapping identity is immutable' using errcode='42501';
 end if;
 new.updated_at:=now();
 return new;
end $$;

drop trigger if exists upt_provider_mapping_guard on public.admin_provider_event_mappings;
create trigger upt_provider_mapping_guard
before insert or update on public.admin_provider_event_mappings
for each row execute function public.upt_guard_provider_mapping();
revoke all on function public.upt_guard_provider_mapping() from public,anon,authenticated;
