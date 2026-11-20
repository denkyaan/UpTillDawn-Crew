grant execute on function upt_private.guestlist_can_view(uuid,uuid) to authenticated;

update public.role_ui_rules
set label='Inkom & Guestlist',updated_at=now()
where feature_key='guestlist' and role in('admin','responsible_lead','staff');

notify pgrst,'reload schema';