import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261118095730_deny_blocked_in_central_approval_guard.sql','utf8')
const sqlGate=readFileSync('tests/sql/blocked-account-approval-guard.sql','utf8')
const workflow=readFileSync('.github/workflows/ci.yml','utf8')

test('central approval SQL denies blocked-but-approved accounts without changing Maker recovery',()=>{
 assert.match(migration,/create or replace function public\.upt_is_approved\(\)/i)
 assert.match(migration,/auth\.uid\(\) is not null/)
 assert.match(migration,/p\.approved = true/)
 assert.match(migration,/coalesce\(p\.account_blocked,false\) = false/)
 assert.match(migration,/upt_private\.is_app_owner\(auth\.uid\(\)\)/)
 assert.match(migration,/security definer/)
 assert.match(migration,/set search_path = 'pg_catalog', 'public', 'upt_private'/)
})

test('grants remain authenticated-only and protect direct mutation of authorization columns',()=>{
 assert.match(migration,/revoke all on function public\.upt_is_approved\(\) from public, anon/)
 assert.match(migration,/grant execute on function public\.upt_is_approved\(\) to authenticated/)
 for(const field of ['role','approved','account_blocked']) assert.ok(sqlGate.includes(`'public.profiles','${field}','UPDATE'`))
 assert.match(sqlGate,/has_function_privilege\('anon'/)
 assert.match(sqlGate,/has_function_privilege\('authenticated'/)
 assert.match(sqlGate,/full_name/)
})

test('release SQL runner automatically includes the guarded policy regression, without adding Main long CI',()=>{
 assert.match(workflow,/for file in tests\/sql\/\*\.sql/)
 assert.doesNotMatch(workflow,/tests\/sql\/blocked-account-approval-guard\.sql\|/)
})
