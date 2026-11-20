import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const migration=readFileSync("supabase/migrations/20261028080000_admin_artist_booking_note_audit.sql","utf8")
const route=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("artist note edits are audited by a trigger without duplicating content",()=>{
 assert.match(migration,/after update of internal_notes/)
 assert.match(migration,/old\.internal_notes is distinct from new\.internal_notes/)
 assert.match(migration,/previous_length,new_length/)
 assert.match(migration,/revoke all on public\.admin_artist_booking_note_audit from anon,authenticated/)
 assert.match(migration,/upt_can_manage_administration\(\)/)
 assert.doesNotMatch(migration,/old_notes|new_notes|old_content|new_content/)
})
test("AI note editor previews changes and shows bounded metadata history",()=>{
 assert.match(route,/admin_artist_booking_note_audit/)
 assert.match(route,/\.limit\(10\)/)
 assert.match(editor,/t\.preview/)
 assert.match(editor,/audit\.map\(entry/)
 assert.match(editor,/confirmed:true/)
})
