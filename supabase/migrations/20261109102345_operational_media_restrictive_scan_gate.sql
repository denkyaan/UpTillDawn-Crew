-- Defense in depth: a future permissive Storage policy must never accidentally
-- expose unscanned chat, incident or work-media originals.
-- The existing five SELECT policies and private clean-verdict helper are
-- installed by 20261109101256_cross_portal_media_malware_quarantine.sql.
do $$
begin
 if to_regprocedure('upt_private.storage_media_scan_is_clean(text,text)') is null
 then raise exception 'Prerequisite trusted malware scan helper is absent'; end if;
end $$;
drop policy if exists upt_all_operational_media_scans_required on storage.objects;
create policy upt_all_operational_media_scans_required
on storage.objects as restrictive for select to authenticated using (
 bucket_id not in ('chat-attachments','incident-photos','work-media')
 or upt_private.storage_media_scan_is_clean(bucket_id,name)
);
comment on policy upt_all_operational_media_scans_required on storage.objects is
 'Future-proof mandatory antivirus verdict for all authenticated Storage reads of operational media, independent of any added permissive policy.';
