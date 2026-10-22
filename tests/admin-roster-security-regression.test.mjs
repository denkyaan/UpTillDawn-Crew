import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const migration=(name)=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
test('roster review requires a different approved admin',async()=>{
 const sql=await migration('20261022213000_admin_roster_proposals.sql')
 assert.match(sql,/created_by<>auth\.uid\(\)/)
 assert.match(sql,/status='submitted'/)
 assert.match(sql,/upt_is_approved\(\)/)
})
test('target selection is restricted to draft proposals in the same event',async()=>{
 const sql=await migration('20261022224500_admin_roster_target_selection.sql')
 assert.match(sql,/p\.status='draft'/)
 assert.match(sql,/s\.event_id=p\.event_id/)
 assert.match(sql,/upt_can_manage_administration\(\)/)
})
test('applying a roster rejects already started shifts and time conflicts',async()=>{
 const sql=await migration('20261022231000_admin_roster_shift_safety.sql')
 assert.match(sql,/v_shift\.start_time is not null/)
 assert.match(sql,/v_shift\.end_time is not null/)
 assert.match(sql,/v_shift\.scheduled_end <= now\(\)/)
 assert.match(sql,/v_proposal\.proposed_start <= now\(\)/)
 assert.match(sql,/Overlapping assigned shift/)
 assert.match(sql,/v_proposal\.applied_at is not null/)
})
