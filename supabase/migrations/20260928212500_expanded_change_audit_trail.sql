create or replace function public.upt_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_entity uuid;
  v_old jsonb;
  v_new jsonb;
begin
  v_entity:=coalesce(
    case when TG_OP in ('INSERT','UPDATE') then new.id else null end,
    case when TG_OP in ('UPDATE','DELETE') then old.id else null end
  );

  if TG_TABLE_NAME='profiles' then
    if TG_OP in ('UPDATE','DELETE') then
      v_old:=jsonb_build_object('role',old.role,'approved',old.approved,'account_blocked',old.account_blocked);
    end if;
    if TG_OP in ('INSERT','UPDATE') then
      v_new:=jsonb_build_object('role',new.role,'approved',new.approved,'account_blocked',new.account_blocked);
    end if;
  else
    if TG_OP in ('UPDATE','DELETE') then v_old:=to_jsonb(old); end if;
    if TG_OP in ('INSERT','UPDATE') then v_new:=to_jsonb(new); end if;
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,lower(TG_OP),TG_TABLE_NAME,v_entity,jsonb_build_object('old',v_old,'new',v_new));

  return case when TG_OP='DELETE' then old else new end;
end;
$$;

drop trigger if exists upt_mutation_audit on public.inventory_items;
create trigger upt_mutation_audit after insert or update or delete on public.inventory_items
for each row execute function public.upt_audit_mutation();

drop trigger if exists upt_mutation_audit on public.event_guestlist_entries;
create trigger upt_mutation_audit after insert or update or delete on public.event_guestlist_entries
for each row execute function public.upt_audit_mutation();

drop trigger if exists upt_mutation_audit on public.sales_transactions;
create trigger upt_mutation_audit after insert or update or delete on public.sales_transactions
for each row execute function public.upt_audit_mutation();

drop trigger if exists upt_mutation_audit on public.operational_checklists;
create trigger upt_mutation_audit after insert or update or delete on public.operational_checklists
for each row execute function public.upt_audit_mutation();

drop trigger if exists upt_mutation_audit on public.checklist_items;
create trigger upt_mutation_audit after insert or update or delete on public.checklist_items
for each row execute function public.upt_audit_mutation();

notify pgrst,'reload schema';
