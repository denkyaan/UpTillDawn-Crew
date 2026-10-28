-- Optional payment and billing details for financial counterparties.
-- No automatic bank transfers or Peppol sending is enabled by these fields.
alter table public.admin_counterparties
 add column if not exists street_address text,
 add column if not exists postal_code text,
 add column if not exists city text,
 add column if not exists country_code text,
 add column if not exists iban text,
 add column if not exists bic text,
 add column if not exists payment_terms_days integer;

alter table public.admin_counterparties
 add constraint admin_counterparty_payment_terms_range check (payment_terms_days is null or payment_terms_days between 0 and 365),
 add constraint admin_counterparty_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
 add constraint admin_counterparty_iban_format check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
 add constraint admin_counterparty_bic_format check (bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
 add constraint admin_counterparty_address_lengths check (
  (street_address is null or length(street_address)<=300)
  and (postal_code is null or length(postal_code)<=32)
  and (city is null or length(city)<=120)
 );
