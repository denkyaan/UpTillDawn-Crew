-- Cover the creator foreign key for provider event mappings.
-- This prevents unnecessary scans during referenced auth.users changes and
-- satisfies the full CI foreign-key indexing regression gate.
create index if not exists admin_provider_event_mappings_created_by_idx
  on public.admin_provider_event_mappings (created_by);
