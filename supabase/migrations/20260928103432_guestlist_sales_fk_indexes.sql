create index if not exists artist_backstage_checklists_updated_by_idx
on public.artist_backstage_checklists(updated_by)
where updated_by is not null;

create index if not exists event_guestlist_settings_updated_by_idx
on public.event_guestlist_settings(updated_by)
where updated_by is not null;

create index if not exists sales_registers_opened_by_idx
on public.sales_registers(opened_by)
where opened_by is not null;

create index if not exists sales_registers_workplace_idx
on public.sales_registers(workplace_id);

notify pgrst,'reload schema';