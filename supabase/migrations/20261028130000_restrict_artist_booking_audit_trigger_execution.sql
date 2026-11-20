-- Trigger functions must never be directly executable by API roles.
-- The database trigger remains functional when these grants are revoked.
revoke all on function public.upt_audit_artist_booking_note_change() from public;
revoke all on function public.upt_audit_artist_booking_note_change() from anon;
revoke all on function public.upt_audit_artist_booking_note_change() from authenticated;
