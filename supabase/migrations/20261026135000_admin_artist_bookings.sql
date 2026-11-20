-- DJ booking register foundation. No automated emails, signatures or payments.
create table public.admin_artist_bookings (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 artist_name text not null check (length(btrim(artist_name)) between 1 and 180),
 agency_contact_id uuid references public.admin_counterparties(id) on delete set null,
 status text not null default 'enquiry' check (status in ('enquiry','negotiating','confirmed','cancelled')),
 performance_at timestamptz,
 fee_amount numeric(15,2) check (fee_amount is null or fee_amount >= 0),
 currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
 rider_notes text,
 internal_notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index admin_artist_bookings_event_idx on public.admin_artist_bookings(event_id);
create index admin_artist_bookings_agency_idx on public.admin_artist_bookings(agency_contact_id);
create index admin_artist_bookings_created_by_idx on public.admin_artist_bookings(created_by);
create index admin_artist_bookings_status_idx on public.admin_artist_bookings(status);
alter table public.admin_artist_bookings enable row level security;
revoke all on public.admin_artist_bookings from anon;
grant select, insert, update on public.admin_artist_bookings to authenticated;
create policy admin_artist_bookings_read on public.admin_artist_bookings
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_artist_bookings_insert on public.admin_artist_bookings
 for insert to authenticated with check (
  public.upt_can_manage_administration()
  and created_by = (select auth.uid())
  and status = 'enquiry'
 );
create policy admin_artist_bookings_update on public.admin_artist_bookings
 for update to authenticated
 using (public.upt_can_manage_administration())
 with check (public.upt_can_manage_administration());
-- Never grant delete; retain cancelled bookings for accountability.
