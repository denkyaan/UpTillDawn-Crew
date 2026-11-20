-- Immutable, independently auditable DJ booking communication records.
create table public.admin_artist_booking_communications (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete restrict,
 kind text not null check (kind in ('email_sent','reply_received','follow_up')),
 details text not null check (length(btrim(details)) between 3 and 1500),
 actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index admin_artist_booking_communications_booking_created_idx on public.admin_artist_booking_communications(booking_id,created_at desc);
alter table public.admin_artist_booking_communications enable row level security;
revoke all on public.admin_artist_booking_communications from anon;
grant select, insert on public.admin_artist_booking_communications to authenticated;
create policy admin_artist_booking_communications_read on public.admin_artist_booking_communications
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_artist_booking_communications_insert on public.admin_artist_booking_communications
 for insert to authenticated with check (
  public.upt_can_manage_administration()
  and actor_id=(select auth.uid())
  and exists (select 1 from public.admin_artist_bookings b where b.id=booking_id)
 );
-- No update or delete grants: communication history is append-only.
