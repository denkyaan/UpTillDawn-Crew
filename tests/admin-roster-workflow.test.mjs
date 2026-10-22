import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const migration=new URL('../supabase/migrations/20261022213000_admin_roster_proposals.sql',import.meta.url)
const page=new URL('../app/(app)/portals/administration/rosters/page.tsx',import.meta.url)
test('administrative rosters enforce admin review and immutable decision transitions',async()=>{
 const sql=await readFile(migration,'utf8')
 assert.match(sql,/enable row level security/i)
 assert.match(sql,/upt_can_manage_administration\(\)/)
 assert.match(sql,/if not public\.upt_is_admin\(\)/)
 assert.match(sql,/created_by<>auth\.uid\(\)/)
 assert.match(sql,/where id=p_id and status='submitted'/)
 assert.match(sql,/not p_approve and length\(trim\(coalesce\(p_note,''\)\)\)=0/)
 assert.doesNotMatch(sql,/insert into public\.shifts|update public\.shifts/i)
})
test('roster UI requires authentication and uses server-only review actions',async()=>{
 const source=await readFile(page,'utf8')
 assert.match(source,/getCurrentUser\(\)/)
 assert.match(source,/canOpenPortal\("administration"/)
 assert.match(source,/upt_admin_roster_create/)
 assert.match(source,/upt_admin_roster_submit/)
 assert.match(source,/upt_admin_roster_review/)
 assert.match(source,/p\.created_by!==user\.id/)
 assert.match(source,/user\.isAdmin/)
})
