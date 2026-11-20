import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('responsible operational automation stays scoped and God Mode configured',async()=>{
 const sql=await read('supabase/migrations/20260930223000_responsible_operational_automations.sql')
 assert.match(sql,/responsible_ops_watch/)
 assert.match(sql,/"configuration":"god_mode_only"/)
 assert.match(sql,/audience.*channels/)
 assert.match(sql,/ra\.event_id=v_row\.event_id and ra\.workplace_id=v_row\.workplace_id/)
 assert.match(sql,/p\.approved=true/)
 assert.match(sql,/now\(\) between e\.start_at and e\.end_at/)
 assert.match(sql,/automation_deliveries|emit_automation_notification/)
 assert.match(sql,/incident:/)
 assert.match(sql,/task-overdue:/)
 assert.match(sql,/handover-ready:/)
 assert.match(sql,/uptilldawn-responsible-ops/)
})

test('responsible automation effects do not expose configuration in role UI',async()=>{
 const role=await read('lib/role-ui.ts')
 const block=role.split('responsible_lead: [')[1].split('],\n  staff:')[0]
 assert.doesNotMatch(block,/automation|platform/i)
})
