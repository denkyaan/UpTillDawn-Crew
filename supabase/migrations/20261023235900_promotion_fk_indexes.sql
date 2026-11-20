-- Foreign-key indexes required by SQL regression suite.
create index if not exists promotion_reference_media_created_by_idx
 on public.promotion_reference_media(created_by);
create index if not exists promotion_violations_recorded_by_idx
 on public.promotion_violations(recorded_by);
