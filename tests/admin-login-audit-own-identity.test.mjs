import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261118105430_scope_admin_login_success_to_verified_admin_identity.sql','utf8')
const regression=readFileSync('tests/sql/admin-login-audit-own-identity.sql','utf8')
const nativeLogin=readFileSync('app/api/auth/admin-login/route.ts','utf8')
const sharedAuth=readFileSync('lib/actions/auth.ts','utf8')
const mapper=readFileSync('lib/maker-login.ts','utf8')

test('successful Admin audit cannot clear another login after staff or Admin authentication',()=>{
 assert.match(migration,/v_actor uuid := auth\.uid\(\)/)
 assert.match(migration,/NOT public\.upt_is_approved\(\)/)
 assert.match(migration,/NOT public\.upt_is_admin\(v_actor\)/)
 assert.match(migration,/FROM auth\.users u\s+WHERE u\.id=v_actor/)
 assert.match(migration,/v_key IS DISTINCT FROM v_verified_login/)
 assert.match(migration,/RAISE EXCEPTION 'Verified login does not match signed-in Admin'/)
 assert.match(migration,/FOR UPDATE/)
 assert.match(regression,/v_key IS DISTINCT FROM v_verified_login/)
})

test('Admin audit records a successful login only after canonical Auth login succeeds',()=>{
 assert.match(nativeLogin,/const email = resolveLoginEmail\(submittedLogin\)/)
 assert.match(nativeLogin,/signInWithPassword\(\{ email, password \}\)/)
 assert.match(nativeLogin,/upt_admin_login_success/)
 assert.match(nativeLogin,/p_login: email/)
 assert.match(sharedAuth,/upt_admin_login_success/)
 assert.match(sharedAuth,/p_login: email/)
 assert.match(mapper,/MAKER_LOGIN_ALIAS/)
 assert.match(mapper,/resolveLoginEmail/)
})

test('privileged audit function retains original signature, audit event and safe grants',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.upt_admin_login_success\(/)
 assert.match(migration,/p_login text,p_ip text DEFAULT NULL::text,p_location text DEFAULT NULL::text,p_user_agent text DEFAULT NULL::text/)
 assert.match(migration,/RETURNS void/)
 assert.match(migration,/SET search_path TO 'pg_catalog','upt_private','auth'/)
 assert.match(migration,/successful_login_after_failures/)
 assert.match(migration,/DELETE FROM upt_private\.admin_login_attempts WHERE login_key=v_key/)
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.upt_admin_login_success\(text,text,text,text\) FROM PUBLIC, anon/)
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.upt_admin_login_success\(text,text,text,text\) TO authenticated/)
})

test('release migration preflight matches deployed isolated Main database migration',()=>{
 const baseline=readFileSync('lib/release-baseline.ts','utf8')
 const preflight=readFileSync('scripts/production-preflight-readonly.sql','utf8')
 const versions=readdirSync('supabase/migrations')
  .filter(name=>name.endsWith('.sql'))
  .map(name=>name.split('_')[0])
  .filter(version=>version.length===14&&[...version].every(char=>char>='0'&&char<='9'))
  .sort()
 const latest=versions.at(-1)
 assert.ok(latest,'Expected a versioned migration')
 assert.ok(baseline.includes("EXPECTED_DB_MIGRATION_VERSION='"+latest+"'"))
 assert.ok(preflight.includes("WHERE version='"+latest+"'"))
})
