-- Optional manual follow-up date for DJ bookings.
alter table public.admin_artist_bookings
 add column follow_up_at timestamptz;
create index admin_artist_bookings_follow_up_idx
 on public.admin_artist_bookings(follow_up_at)
 where follow_up_at is not null and status not in ('confirmed','cancelled');
