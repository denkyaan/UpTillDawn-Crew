-- Editable internal contract conditions; no automatic execution or signatures.
alter table public.admin_artist_bookings
 add column if not exists agreement_payment_terms text,
 add column if not exists agreement_cancellation_terms text,
 add column if not exists agreement_liability_terms text,
 add column if not exists agreement_governing_law text;
alter table public.admin_artist_bookings
 add constraint admin_artist_agreement_payment_length check (char_length(coalesce(agreement_payment_terms,'')) <= 3000),
 add constraint admin_artist_agreement_cancellation_length check (char_length(coalesce(agreement_cancellation_terms,'')) <= 3000),
 add constraint admin_artist_agreement_liability_length check (char_length(coalesce(agreement_liability_terms,'')) <= 3000),
 add constraint admin_artist_agreement_law_length check (char_length(coalesce(agreement_governing_law,'')) <= 3000);
