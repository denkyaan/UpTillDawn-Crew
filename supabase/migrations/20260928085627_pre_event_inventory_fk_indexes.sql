create index if not exists inventory_items_catalog_item_idx on public.inventory_items(catalog_item_id);
create index if not exists profiles_blocked_by_idx on public.profiles(blocked_by);
create index if not exists workplace_catalog_created_by_idx on public.workplace_catalog(created_by);
create index if not exists workplace_catalog_items_created_by_idx on public.workplace_catalog_items(created_by);
create index if not exists workplaces_catalog_workplace_idx on public.workplaces(catalog_workplace_id);