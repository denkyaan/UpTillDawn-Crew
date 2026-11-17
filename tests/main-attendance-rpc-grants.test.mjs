import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261117174500_restore_attendance_rpc_authenticated_grants.sql','utf8')
const runner=readFileSync('scripts/main-30-distinct-staff.mjs','utf8')

test('attendance API grants only authenticated the exact self-service function signatures',()=>{
 for(const fn of [
  'public.upt_request_check_in\\(uuid,uuid,boolean,text,numeric,numeric,numeric,text\\)',
  'public.upt_request_check_out\\(uuid,text\\)',
 ]){
  assert.match(migration,new RegExp('revoke execute on function '+fn+' from public, anon;'))
  assert.match(migration,new RegExp('grant execute on function '+fn+' to authenticated;'))
 }
 assert.doesNotMatch(migration,/grant\s+execute[\s\S]+?\bto (?:anon|public)\b/i)
 assert.doesNotMatch(migration,/grant\s+(?:all|insert|update|delete|select)\s+on\b/i)
})

test('30 distinct users must reach a business-rule denial, not an RPC privilege error',()=>{
 assert.match(runner,/upt_request_check_in/)
 assert.match(runner,/assert\.ok\(denied\.error/)
 assert.match(runner,/denied\.status<500/)
 assert.match(runner,/\/dienst\|Werk & pauze\/i/)
 assert.match(runner,/report\.checkinDenied\+\+/)
 assert.match(runner,/cleanupVerified/)
})
