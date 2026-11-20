import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const proxy=readFileSync('lib/supabase/middleware.ts','utf8')
const allAuth=readFileSync('lib/actions/auth.ts','utf8')
const current=allAuth.slice(allAuth.indexOf('export const getCurrentUser = cache('),allAuth.indexOf('export async function verifyAdminSettingsCode'))
test('Supabase proxy enforces verified claims before any protected page and owner guard',()=>{
 assert.match(proxy,/await supabase\.auth\.getClaims\(\)/)
 assert.match(proxy,/!isPublicPath\(pathname\) && !authenticated/)
 assert.match(proxy,/authenticated && makerRoute/)
 assert.match(proxy,/upt_current_is_owner/)
 assert.doesNotMatch(proxy,/await supabase\.auth\.getUser\(\)/)
})
test('server current user obtains verified JWT identity through a signed, self-scoped PostgREST RPC',()=>{
 assert.match(current,/readContext\('upt_current_session_context'\)/)
 assert.doesNotMatch(current,/supabase\.auth\.getClaims\(\)/)
 assert.match(current,/if \(error \|\| !profile \|\| !profile\.id/)
 assert.match(current,/profile\.account_blocked && !isOwner/)
 assert.match(current,/!profile\.approved && !isOwner/)
 assert.match(current,/id: profile\.id/)
 assert.match(current,/verifiedEmail \|\| ''/)
 const sql=readFileSync('supabase/migrations/20261117175500_single_verified_session_context.sql','utf8')
 assert.match(sql,/security invoker/)
 assert.match(sql,/where p\.id=auth\.uid\(\)/)
 assert.match(sql,/auth\.jwt\(\)->>'email'/)
 assert.match(sql,/public\.upt_current_is_owner\(\)/)
 assert.match(sql,/public\.upt_current_effective_role\(\)/)

})
