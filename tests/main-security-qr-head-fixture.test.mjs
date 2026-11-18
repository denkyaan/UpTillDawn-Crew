import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261118121657_revoke_retired_pre_qr_attendance_rpcs.sql','utf8')
const preflight=readFileSync('scripts/production-preflight-readonly.sql','utf8')
const qr=readFileSync('components/crew/qr-shift-request.tsx','utf8')
const fixtures=['tests/sql/release-access-matrix.sql','tests/sql/storage-security.sql','tests/sql/qr-attendance-workflow.sql']

test('legacy check-in and checkout cannot bypass the QR attendance flow',()=>{
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.upt_request_check_in\(uuid,uuid,boolean,text,numeric,numeric,numeric,text\) FROM PUBLIC,anon,authenticated/)
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.upt_request_check_out\(uuid,text\) FROM PUBLIC,anon,authenticated/)
 assert.match(preflight,/retired_pre_qr_attendance_closed_and_qr_flow_enabled/)
 assert.match(preflight,/NOT has_function_privilege\('authenticated'/)
 assert.match(preflight,/public\.upt_qr_request\(boolean,boolean,text\)/)
 assert.match(qr,/s\.rpc\('upt_qr_request'/)
})

test('rollback-only role and storage SQL no longer attempt to create a second Head Admin',()=>{
 for(const path of fixtures){
  const sql=readFileSync(path,'utf8')
  assert.match(sql,/upt_organization_leadership l/)
  assert.match(sql,/l\.slot='head'/)
  assert.match(sql,/Main QA requires an approved active designated Head/)
  assert.match(sql,/ROLLBACK;/)
 }
})
