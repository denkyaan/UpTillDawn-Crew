-- Eventix / SumUp external event mapping. No credentials or payment details are stored here.
create table if not exists public.admin_provider_event_mappings (
 id uuid primary key default gen_random_uuid(),
 provider text not null check (provider in ('eventix','sumup')),
 external_event_id text not null check (length(external_event_id) between 1 and 160 and external_event_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'),
 event_id uuid not null references public.events(id) on delete restrict,
 enabled boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider,external_event_id)
);
create index if not exists admin_provider_event_mappings_event_idx on public.admin_provider_event_mappings(event_id);
alter table public.admin_provider_event_mappings enable row level security;
revoke all on public.admin_provider_event_mappings from public,anon;
grant select,insert,update on public.admin_provider_event_mappings to authenticated;
create policy admin_provider_mapping_read on public.admin_provider_event_mappings
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_provider_mapping_insert on public.admin_provider_event_mappings
 for insert to authenticated with check (public.upt_can_manage_administration() and created_by=auth.uid());
create policy admin_provider_mapping_update on public.admin_provider_event_mappings
 for update to authenticated using (public.upt_can_manage_administration())
 with check (public.upt_can_manage_administration());
-- Restrict edits to mapping fields; creator and audit timestamps are immutable.
revoke update on public.admin_provider_event_mappings from authenticated;
grant update (event_id,enabled,updated_at) on public.admin_provider_event_mappings to authenticated;
-- Disallow editing provider/external identity: create a new mapping instead.
-- Deletion is intentionally not granted; disable mappings to retain audit history.
