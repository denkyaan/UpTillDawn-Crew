import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const migration=readFileSync('supabase/migrations/20261110060000_admin_timesheet_labels_explicit_authorization.sql','utf8')
const check=readFileSync('tests/sql/administration_timesheet_labels_auth.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/timesheets/page.tsx','utf8')
test('timesheet label reader explicitly authenticates and delegates admin entitlement before privileged reads',()=>{
 assert.match(migration,/function public\.upt_administration_timesheet_labels\(p_timesheet_ids uuid\[\]\)/)
 assert.match(migration,/security definer/)
 assert.match(migration,/set search_path = ''/)
 assert.match(migration,/if auth\.uid\(\) is null or not public\.upt_can_manage_administration\(\) then/)
 assert.match(migration,/using errcode = '42501'/)
 assert.match(migration,/cardinality\(p_timesheet_ids\) > 100/)
 assert.match(migration,/from public\.timesheets t/)
 assert.match(migration,/revoke all on function public\.upt_administration_timesheet_labels\(uuid\[\]\) from public, anon, authenticated/)
 assert.match(migration,/grant execute on function public\.upt_administration_timesheet_labels\(uuid\[\]\) to authenticated/)
 assert.match(check,/has_function_privilege\('anon',v_rpc,'EXECUTE'\)/)
 assert.match(check,/has_function_privilege\('public',v_rpc,'EXECUTE'\)/)
 assert.match(page,/rpc\('upt_administration_timesheet_labels'/)
})
