import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const migration=readFileSync('supabase/migrations/20261117175500_single_verified_session_context.sql','utf8')
const actions=readFileSync('lib/actions/auth.ts','utf8')
const middleware=readFileSync('lib/supabase/middleware.ts','utf8')
const context=actions.slice(actions.indexOf('export const getCurrentUser = cache('),actions.indexOf('export async function verifyAdminSettingsCode'))

test('composed identity is a single invoker RPC which scopes every field to signed JWT auth.uid',()=>{
 assert.match(migration,/create or replace function public\.upt_current_session_context\(\)/i)
 assert.match(migration,/security invoker/i)
 assert.match(migration,/from public\.upt_current_profile\(\) p/)
 assert.match(migration,/where p\.id=auth\.uid\(\)/)
 assert.match(migration,/auth\.jwt\(\)->>'email'/)
 assert.match(migration,/public\.upt_current_is_owner\(\)/)
 assert.match(migration,/public\.upt_current_effective_role\(\)/)
 assert.match(migration,/revoke execute on function public\.upt_current_session_context\(\) from public, anon;/i)
 assert.match(migration,/grant execute on function public\.upt_current_session_context\(\) to authenticated;/i)
 assert.doesNotMatch(migration,/security definer|from\s+auth\.users|grant .* to (?:anon|public)/i)
})
test('private Worker middleware still verifies JWT before any server page',()=>{
 assert.match(middleware,/await supabase\.auth\.getClaims\(\)/)
 assert.match(middleware,/const authenticated = !claimsError/)
 assert.match(middleware,/if \(!isPublicPath\(pathname\) && !authenticated\)/)
})
test('server user context eliminates duplicated local JWT crypto and separate RPC calls without dropping owner/approval checks',()=>{
 assert.match(context,/upt_current_session_context/)
 assert.doesNotMatch(context,/getClaims\(\)|getUser\(\)|rpc\('upt_current_profile'\)|rpc\('upt_current_is_owner'\)/)
 assert.match(context,/if \(profile\.account_blocked && !isOwner\) return null/)
 assert.match(context,/if \(!profile\.approved && !isOwner\) return null/)
 assert.match(context,/hasPermanentAdminAccess = realRole === 'admin' \|\| isOwner/)
 assert.match(context,/isAdmin: effectiveRole === 'admin'/)
 assert.match(context,/verifiedEmail \|\| ''/)
 assert.match(context,/cache\(async function getCurrentUser/)
})
