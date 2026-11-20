-- Audit only metadata for internal artist-booking note edits; never duplicate note contents.
create table public.admin_artist_booking_note_audit (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now(),
 previous_length integer not null,
 new_length integer not null
);
create index admin_artist_booking_note_audit_booking_time_idx
 on public.admin_artist_booking_note_audit(booking_id,changed_at desc);
alter table public.admin_artist_booking_note_audit enable row level security;
revoke all on public.admin_artist_booking_note_audit from anon,authenticated;
grant select on public.admin_artist_booking_note_audit to authenticated;
create policy admin_artist_booking_note_audit_read on public.admin_artist_booking_note_audit
 for select to authenticated using (public.upt_can_manage_administration());

create or replace function public.upt_audit_artist_booking_note_change()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public'
as $$
begin
 if old.internal_notes is distinct from new.internal_notes then
  insert into public.admin_artist_booking_note_audit
   (booking_id,actor_id,previous_length,new_length)
  values (new.id,auth.uid(),length(coalesce(old.internal_notes,'')),length(coalesce(new.internal_notes,'')));
 end if;
 return new;
end;
$$;
drop trigger if exists upt_artist_booking_note_audit on public.admin_artist_bookings;
create trigger upt_artist_booking_note_audit
 after update of internal_notes on public.admin_artist_bookings
 for each row execute function public.upt_audit_artist_booking_note_change();
notify pgrst,'reload schema';
