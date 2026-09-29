create index if not exists automation_rules_updated_by_idx on public.automation_rules(updated_by);
create index if not exists events_archived_by_idx on public.events(archived_by);
create index if not exists events_restored_by_idx on public.events(restored_by);
