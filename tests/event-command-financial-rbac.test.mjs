import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const sql=readFileSync('supabase/migrations/20261118121230_redact_event_command_financial_totals_for_non_admins.sql','utf8')
const testSql=readFileSync('tests/sql/event-command-financial-privacy.sql','utf8')
const page=readFileSync('app/(app)/events/[id]/command/page.tsx','utf8')
const events=readFileSync('app/(app)/events/page.tsx','utf8')

test('database never returns event revenue to an ordinary event member or Responsible',()=>{
 assert.match(sql,/'sales',CASE WHEN public\.upt_is_admin\(v_actor\) THEN jsonb_build_object\(/)
 assert.match(sql,/ELSE jsonb_build_object\('netCents',0,'merchCents',0,'tokenCents',0\) END/)
 assert.match(sql,/public\.upt_is_approved\(\)/)
 assert.match(sql,/public\.event_members em/)
 assert.match(sql,/public\.upt_is_responsible\(p_event,null,v_actor\)/)
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.upt_event_command_snapshot\(uuid\) FROM PUBLIC,anon/)
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.upt_event_command_snapshot\(uuid\) TO authenticated/)
})

test('non-admin UI hides the Revenue card but preserves its operational command center',()=>{
 assert.match(page,/\{isAdmin&&<article[^>]+><p[^>]+>Revenue<\/p>/)
 assert.match(page,/snapshot\.sales\.netCents/)
 assert.match(events,/COMMAND CENTER/)
 assert.match(page,/upt_event_command_snapshot/)
 assert.match(page,/Event readiness/)
})

test('rollback-only SQL proves STAFF revenue denial, Admin revenue and operational continuity',()=>{
 for(const token of ['BEGIN;','ROLLBACK;','SET LOCAL ROLE authenticated','v_data->\'staffing\'','Admin lost accurate event revenue']){
  assert.ok(testSql.includes(token),token)
 }
 assert.match(testSql,/netCents'\)::bigint<>0/)
 assert.match(testSql,/netCents'\)::bigint<>2034/)
})

test('migration metadata remains in sync with release baseline/preflight',()=>{
 const versions=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql'))
  .map(n=>n.split('_')[0]).filter(v=>v.length===14&&[...v].every(c=>c>='0'&&c<='9')).sort()
 const latest=versions.at(-1)
 assert.ok(latest)
 assert.ok(readFileSync('lib/release-baseline.ts','utf8').includes("EXPECTED_DB_MIGRATION_VERSION='"+latest+"'"))
 assert.ok(readFileSync('scripts/production-preflight-readonly.sql','utf8').includes("WHERE version='"+latest+"'"))
})
