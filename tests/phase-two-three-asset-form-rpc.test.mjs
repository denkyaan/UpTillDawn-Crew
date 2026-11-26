import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('both asset form handlers use the same narrow approved-Admin audited RPC',()=>{
 const sql=read('supabase/migrations/20261126172500_inventory_asset_form_rpc.sql')
 for(const token of ['NOT public.upt_is_approved()','NOT public.upt_is_admin(v_actor)','FOR UPDATE','public.upt_update_inventory_asset_metadata(','p_photo_path=>v_item.photo_path','p_purchase_date=>v_item.purchase_date','p_last_maintenance_at=>v_item.last_maintenance_at','FROM PUBLIC,anon','TO authenticated'])assert.ok(sql.includes(token),token)
 assert.doesNotMatch(sql,/GRANT\s+UPDATE/i)
 const legacy=read('lib/actions/platform.ts').split('export async function updateAssetMetadata(')[1].split('export async function')[0]
 const native=read('modern/src/api/native-mega-operations-actions.ts').split('case "updateAssetMetadata":')[1].split('case "removeOperationalChecklistItem":')[0]
 for(const code of [legacy,native]){
  assert.ok(code.includes('upt_update_inventory_asset_form'))
  assert.doesNotMatch(code,/\.from\(["']inventory_items["']\)\.update/)
 }
})
