create or replace function public.upt_admin_set_account(p_user uuid,p_approved boolean,p_role text)
returns void
language plpgsql security definer
set search_path to 'pg_catalog','public','upt_private','auth','storage'
as $fn$
declare v_actor uuid:=auth.uid();
begin
  if not public.upt_is_admin() then raise exception 'Not authorized'; end if;

  if p_role='__delete__' then
    if p_user=v_actor then raise exception 'Je kunt je eigen account niet verwijderen.'; end if;
    if upt_private.is_app_owner(p_user) then raise exception 'Een app-eigenaar kan niet via personeelsbeheer worden verwijderd.'; end if;
    if not exists(select 1 from auth.users where id=p_user) then raise exception 'Gebruiker niet gevonden.'; end if;
    if exists(select 1 from public.inventory_issues where user_id=p_user and outstanding_quantity>0) then
      raise exception 'Werk eerst het uitstaande materiaal van deze gebruiker af.';
    end if;
    update storage.objects set owner=v_actor,owner_id=v_actor::text where owner=p_user or owner_id=p_user::text;
    update public.messages set sender_id=null where sender_id=p_user;
    update public.check_ins set approved_by=null where approved_by=p_user;
    update public.incidents set resolved_by=null where resolved_by=p_user;
    update public.configuration_versions set created_by=v_actor where created_by=p_user;
    update public.event_documents set uploaded_by=v_actor where uploaded_by=p_user;
    update public.inventory_items set created_by=v_actor where created_by=p_user;
    update public.inventory_movements set actor_id=v_actor where actor_id=p_user;
    update public.knowledge_articles set created_by=v_actor where created_by=p_user;
    update public.operational_checklists set created_by=v_actor where created_by=p_user;
    update public.planning_recommendations set created_by=v_actor where created_by=p_user;
    update public.qr_resources set created_by=v_actor where created_by=p_user;
    update public.staff_pay_rates set created_by=v_actor where created_by=p_user;
    update public.workplace_inventory_notes set created_by=v_actor where created_by=p_user;
    update public.inventory_issues set issued_by=v_actor where issued_by=p_user;
    delete from public.incidents where reporter_id=p_user;
    delete from public.time_corrections where corrected_by=p_user;
    delete from public.work_attachments where uploaded_by=p_user;
    delete from public.inventory_settlement_requests where user_id=p_user;
    delete from public.inventory_issues where user_id=p_user;
    delete from auth.users where id=p_user;
    return;
  end if;

  if p_role not in ('admin','responsible_lead','staff') or p_role is null or p_approved is null then
    raise exception 'Invalid role';
  end if;
  if upt_private.is_app_owner(p_user) and not p_approved then raise exception 'De maker van de app kan niet worden gedeactiveerd.'; end if;
  if exists(select 1 from public.profiles where id=p_user and account_blocked=true) and p_approved then
    raise exception 'Deblokkeer dit account eerst.';
  end if;
  if p_user=v_actor and not upt_private.is_app_owner(p_user) and (not p_approved or p_role<>'admin') then
    raise exception 'Cannot revoke own admin access';
  end if;

  update public.profiles set approved=case when upt_private.is_app_owner(p_user) then true else p_approved end,role=p_role where id=p_user;
  if not found then raise exception 'Profile not found'; end if;
  if upt_private.is_app_owner(p_user) then
    insert into public.admin_role_modes(user_id,active_role,updated_at) values(p_user,p_role,now())
    on conflict(user_id) do update set active_role=excluded.active_role,updated_at=excluded.updated_at;
  end if;
end
$fn$;

notify pgrst,'reload schema';