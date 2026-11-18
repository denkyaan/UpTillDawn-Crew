import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261118112738_bind_responsible_privileges_to_authenticated_actor.sql','utf8')
const regression=readFileSync('tests/sql/responsible-actor-impersonation.sql','utf8')

test('privileged Responsible RPC checks only the currently authenticated user',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.upt_is_responsible\(/)
 assert.match(migration,/uid uuid DEFAULT auth\.uid\(\)/)
 assert.match(migration,/STABLE SECURITY DEFINER/)
 assert.match(migration,/uid = \(SELECT auth\.uid\(\)\)/)
 assert.match(migration,/public\.upt_is_approved\(\)/)
 assert.match(migration,/public\.upt_effective_role\(uid\) = 'responsible_lead'/)
 assert.match(migration,/ra\.user_id=uid/)
 assert.match(migration,/ra\.event_id=event_uuid/)
 assert.match(migration,/workplace_uuid IS NULL OR ra\.workplace_id=workplace_uuid/)
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.upt_is_responsible\(uuid,uuid,uuid\) FROM PUBLIC,anon/)
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.upt_is_responsible\(uuid,uuid,uuid\) TO authenticated/)
})

test('role impersonation regression creates disposable Staff and Responsible sessions',()=>{
 assert.match(regression,/BEGIN;/)
 assert.match(regression,/ROLLBACK;/)
 assert.match(regression,/SET LOCAL ROLE authenticated/)
 assert.match(regression,/Staff can impersonate another Responsible/)
 assert.match(regression,/genuine Responsible lost assigned workplace/)
 assert.match(regression,/Responsible may query another identity/)
 assert.match(regression,/has_function_privilege\('anon'/)
 assert.match(regression,/has_function_privilege\('authenticated'/)
})

test('versioned SQL migration and read-only preflight stay synchronized',()=>{
 const files=readdirSync('supabase/migrations')
 const versions=files.filter(name=>name.endsWith('.sql'))
  .map(name=>name.split('_')[0])
  .filter(version=>version.length===14&&[...version].every(c=>c>='0'&&c<='9'))
  .sort()
 const latest=versions.at(-1)
 assert.ok(latest,'Expected at least one versioned Supabase migration')
 assert.match(readFileSync('lib/release-baseline.ts','utf8'),new RegExp("EXPECTED_DB_MIGRATION_VERSION='"+latest+"'"))
 assert.ok(readFileSync('scripts/production-preflight-readonly.sql','utf8').includes("WHERE version='"+latest+"'"))
})
