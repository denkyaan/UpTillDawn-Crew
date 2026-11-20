grant execute on function upt_private.inventory_can_view(uuid,uuid) to authenticated;
grant execute on function upt_private.inventory_can_manage(uuid,uuid) to authenticated;

revoke all on function upt_private.apply_inventory_settlement(uuid,text,integer,text,uuid)
from public,anon,authenticated;
