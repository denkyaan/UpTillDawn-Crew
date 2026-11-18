import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261117174500_restore_attendance_rpc_authenticated_grants.sql','utf8')
const runner=readFileSync('scripts/main-30-distinct-staff.mjs','utf8')
const retirement=readFileSync('supabase/migrations/20261118121657_revoke_retired_pre_qr_attendance_rpcs.sql','utf8')

test('historical attendance grants have been superseded by explicit retirement',()=>{
 for(const fn of [
  'public.upt_request_check_in\\(uuid,uuid,boolean,text,numeric,numeric,numeric,text\\)',
  'public.upt_request_check_out\\(uuid,text\\)',
 ]){
  assert.match(migration,new RegExp('revoke execute on function '+fn+' from public, anon;'))
  assert.match(migration,new RegExp('grant execute on function '+fn+' to authenticated;'))
 }
 assert.doesNotMatch(migration,/grant\s+execute[\s\S]+?\bto (?:anon|public)\b/i)
 assert.doesNotMatch(migration,/grant\s+(?:all|insert|update|delete|select)\s+on\b/i)
 for(const signature of [
  'public.upt_request_check_in\\(uuid,uuid,boolean,text,numeric,numeric,numeric,text\\)',
  'public.upt_request_check_out\\(uuid,text\\)',
 ]){
  assert.match(retirement,new RegExp('REVOKE ALL ON FUNCTION '+signature+' FROM PUBLIC,anon,authenticated'))
 }
})

test('30 distinct users must receive the actual QR outside-window decision and no attendance write',()=>{
 assert.match(runner,/client\.rpc\('upt_qr_request'\)/)
 assert.match(runner,/throwIfError\(guarded,'Authenticated QR attendance guard'\)/)
 assert.match(runner,/guarded\.data\?\.action,'outside_window'/)
 assert.match(runner,/guarded\.data\?\.next_shift_id\?\?null,null/)
 assert.match(runner,/history\.length,0/)
 assert.doesNotMatch(runner,/client\.rpc\('upt_request_check_in'\)/)
 assert.match(runner,/report\.checkinDenied\+\+/)
 assert.match(runner,/cleanupVerified/)
})
