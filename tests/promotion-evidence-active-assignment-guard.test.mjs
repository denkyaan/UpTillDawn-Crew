import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync(new URL('../supabase/migrations/20261104213000_promotion_evidence_requires_active_assignment.sql',import.meta.url),'utf8')
const server=readFileSync(new URL('../app/(app)/portals/promotion/tasks/page.tsx',import.meta.url),'utf8')

test('direct RPC evidence submission rejects unstarted and closed assignments',()=>{
 assert.match(migration,/create or replace function public\.upt_submit_promotion_evidence\(/)
 assert.match(migration,/for update;/)
 assert.match(migration,/upper\(coalesce\(v_status,''\)\) <> 'IN PROGRESS'/)
 assert.match(migration,/raise exception 'Assignment must be in progress'/)
 assert.match(migration,/where id=p_assignment and user_id=v_actor/)
 assert.match(migration,/public\.upt_promotion_is_blocked\(v_actor\)/)
 assert.match(migration,/grant execute on function public\.upt_submit_promotion_evidence\(uuid,text,text\) to authenticated/)
 assert.match(server,/assigned\.status!=="IN PROGRESS"/)
})
