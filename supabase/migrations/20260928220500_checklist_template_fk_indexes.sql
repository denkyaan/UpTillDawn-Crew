create index if not exists operational_checklist_template_items_template_idx
  on public.operational_checklist_template_items(template_id);

create index if not exists operational_checklist_templates_catalog_workplace_idx
  on public.operational_checklist_templates(catalog_workplace_id);

create index if not exists operational_checklist_templates_created_by_idx
  on public.operational_checklist_templates(created_by);

notify pgrst,'reload schema';
