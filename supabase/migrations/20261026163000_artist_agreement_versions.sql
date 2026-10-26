-- Immutable internal agreement snapshots, separate from legally binding signatures.
create table if not exists public.admin_artist_agreement_versions (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete cascade,
 version_number integer not null check (version_number > 0),
 snapshot jsonb not null,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique (booking_id,version_number),
 constraint agreement_snapshot_object check (jsonb_typeof(snapshot)='object')
);
create index if not exists admin_artist_agreement_versions_created_by_idx on public.admin_artist_agreement_versions(created_by);
create index if not exists admin_artist_agreement_versions_booking_idx on public.admin_artist_agreement_versions(booking_id,version_number desc);
alter table public.admin_artist_agreement_versions enable row level security;
create policy artist_agreement_versions_read on public.admin_artist_agreement_versions for select to authenticated using (public.upt_can_manage_administration());
create policy artist_agreement_versions_insert on public.admin_artist_agreement_versions for insert to authenticated with check (public.upt_can_manage_administration() and created_by=(select auth.uid()));
grant select,insert on public.admin_artist_agreement_versions to authenticated;
