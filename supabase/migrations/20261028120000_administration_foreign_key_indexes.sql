-- Cover public foreign keys reported by the full staging release SQL gate.
-- These indexes improve joins and parent-row delete/update checks.
create index if not exists admin_artist_booking_note_audit_actor_id_idx
 on public.admin_artist_booking_note_audit(actor_id);
create index if not exists admin_financial_payments_created_by_idx
 on public.admin_financial_payments(created_by);
create index if not exists admin_payment_reminders_approved_by_idx
 on public.admin_payment_reminders(approved_by);
create index if not exists admin_payment_reminders_created_by_idx
 on public.admin_payment_reminders(created_by);
