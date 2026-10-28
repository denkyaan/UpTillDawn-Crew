-- Cover the actor foreign key for administration communication audit queries.
create index admin_artist_booking_communications_actor_idx
 on public.admin_artist_booking_communications(actor_id);
