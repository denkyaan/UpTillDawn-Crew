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
test('server current user needs verified identity and checks live role, owner, approval and block',()=>{
 assert.match(current,/supabase\.auth\.getClaims\(\)/)
 assert.match(current,/if \(authError \|\| typeof claims\?\.sub !== 'string' \|\| !claims\.sub\) return null/)
 assert.match(current,/supabase\.rpc\('upt_current_profile'\)/)
 assert.match(current,/supabase\.rpc\('upt_current_is_owner'\)/)
 assert.match(current,/profile\.account_blocked && !isOwner/)
 assert.match(current,/!profile\.approved && !isOwner/)
 assert.match(current,/id: claims\.sub/)
})
