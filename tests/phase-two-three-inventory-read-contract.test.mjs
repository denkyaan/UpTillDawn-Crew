import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('inventory manager read authority aligns with existing approved Admin mutation authority, retaining non-admin gates',()=>{
 const sql=read('supabase/migrations/20261126171000_align_inventory_manager_read_authority.sql')
 const rows=[['inventory_issues','user_id'],['inventory_movements','target_user_id'],['inventory_settlement_requests','user_id']]
 for(const [table,owner] of rows){
  const policy=sql.split('CREATE POLICY '+table+'_read')[1].split(';')[0]
  assert.match(policy,/FOR SELECT TO authenticated/)
  assert.match(policy,/public\.upt_is_approved\(\)/)
  assert.match(policy,/public\.upt_is_admin\(\(SELECT auth\.uid\(\)\)\)\s+OR\s+\(\s+public\.upt_feature_allowed\('inventory',event_id,workplace_id\)/)
  assert.ok(policy.includes(owner+'=(SELECT auth.uid())'))
  assert.ok(policy.includes('upt_private.inventory_can_manage(event_id,workplace_id)'))
 }
 assert.doesNotMatch(sql,/\b(?:GRANT|ALTER TABLE|FOR INSERT|FOR UPDATE|FOR DELETE)\b/i)
})
test('isolated native acceptance records independent domain failures without claiming completion',()=>{
 const source=read('modern/tests/qa-local-native-phase-two.mjs')
 for(const domain of ['guestlist','inventory','sales','qr-resource','checklist','events','pay-rate','knowledge','maker'])assert.ok(source.includes("await domain('"+domain+"'"))
 assert.ok(source.includes('if(failures.length)failed='))
 assert.ok(source.includes('if(failed)process.exitCode=1'))
 assert.ok(source.includes('FOREIGN_ISSUE_DENIAL'))
 assert.ok(source.includes('FOREIGN_MOVEMENT_DENIAL'))
})
