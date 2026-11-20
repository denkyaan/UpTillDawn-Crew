alter table public.admin_artist_agreement_versions
 add column approved_by uuid references auth.users(id),
 add column approved_at timestamptz,
 add constraint artist_agreement_approval_pair check ((approved_by is null) = (approved_at is null)),
 add constraint artist_agreement_separation check (approved_by is null or approved_by <> created_by);
create index admin_artist_agreement_versions_approved_by_idx on public.admin_artist_agreement_versions(approved_by);
create or replace function public.upt_guard_artist_agreement_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id
 or new.booking_id is distinct from old.booking_id
 or new.version_number is distinct from old.version_number
 or new.snapshot is distinct from old.snapshot
 or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at
 or old.approved_at is not null
 or new.approved_by is distinct from (select auth.uid())
 or new.approved_at is null then
  raise exception 'Agreement snapshot cannot be modified';
 end if;
 return new;
end;
$$;
create trigger guard_artist_agreement_approval before update on public.admin_artist_agreement_versions
for each row execute function public.upt_guard_artist_agreement_approval();
create policy artist_agreement_versions_approve on public.admin_artist_agreement_versions
for update to authenticated
using (public.upt_can_manage_administration() and approved_at is null and created_by <> (select auth.uid()))
with check (public.upt_can_manage_administration() and approved_by = (select auth.uid()));
grant update (approved_by,approved_at) on public.admin_artist_agreement_versions to authenticated;
