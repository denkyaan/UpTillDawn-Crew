import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/api/auth/admin-login/route.ts','utf8')
test('admin login logs phase timings and total duration',()=>{
 assert.match(source,/\[admin-login\] phase timing/)
 assert.match(source,/\[admin-login\] completed/)
 for(const phase of ['supabase_client','password_auth','admin_access','role_mode','success_audit','redirect']) assert.ok(source.includes(`enterPhase('${phase}')`))
})
test('timing log payload excludes login credentials and user identifiers',()=>{
 const phaseLog=source.match(/console\.info\('\[admin-login\] phase timing',\s*\{([^}]*)\}/)?.[1]||''
 assert.match(phaseLog,/durationMs/)
 assert.doesNotMatch(phaseLog,/password|email|submittedLogin|userAgent|ip\b/i)
})
