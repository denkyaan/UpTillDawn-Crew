import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('approved roster application requires explicit admin confirmation and checks overlaps',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261022223000_admin_roster_shift_link.sql',import.meta.url),'utf8')
 const target=await readFile(new URL('../supabase/migrations/20261022224500_admin_roster_target_selection.sql',import.meta.url),'utf8')
 const page=await readFile(new URL('../app/(app)/portals/administration/rosters/page.tsx',import.meta.url),'utf8')
 assert.match(sql,/upt_admin_roster_apply/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
 assert.match(sql,/v_proposal\.status <> 'approved'/)
 assert.match(sql,/v_proposal\.applied_at is not null/)
 assert.match(sql,/v_shift\.event_id <> v_proposal\.event_id/)
 assert.match(sql,/Overlapping assigned shift/)
 assert.match(target,/p\.status='draft'/)
 assert.match(target,/s\.event_id=p\.event_id/)
 assert.match(page,/upt_admin_roster_target/)
 assert.match(page,/upt_admin_roster_apply/)
 assert.match(page,/p\.target_shift_id/)
 assert.match(page,/!p\.applied_at/)
})
