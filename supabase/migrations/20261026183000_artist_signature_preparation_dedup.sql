-- Avoid accidental duplicate requests for one immutable agreement version.
create unique index if not exists admin_artist_signature_one_prepared_per_version
on public.admin_artist_agreement_signature_requests (agreement_version_id)
where status = 'prepared';
