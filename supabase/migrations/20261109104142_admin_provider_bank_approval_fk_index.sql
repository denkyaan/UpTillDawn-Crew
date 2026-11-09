-- Acceptance repair: every finance foreign key needs a covering leading
-- index; the provider settlement approved_by FK was missing one.
create index if not exists admin_provider_bank_settlements_approved_by_idx
 on public.admin_provider_bank_settlements (approved_by);
