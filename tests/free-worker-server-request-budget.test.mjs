import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(path,'utf8')

test('server Supabase client is cached only inside React request context, never process-global',()=>{
 const src=read('lib/supabase/crew-server.ts')
 assert.match(src,/import \{ cache \} from 'react'/)
 assert.match(src,/const createRequestClient = cache\(async \(\) => \{/)
 assert.match(src,/export async function createClient\(\)/)
 assert.match(src,/return createRequestClient\(\)/)
 assert.match(src,/getAll\(\)/)
 assert.match(src,/cookieStore\.getAll\(\)/)
 assert.doesNotMatch(src,/service_role|serviceRoleKey|SECRET_KEY/)
})
test('verified RLS user and owner are resolved in parallel, before any account/owner gates',()=>{
 const src=read('lib/actions/auth.ts')
 const start=src.indexOf('export const getCurrentUser = cache(')
 assert.ok(start>0)
 const protectedPart=src.slice(start,src.indexOf('export async function verifyAdminSettingsCode()',start))
 assert.match(protectedPart,/supabase\.auth\.getClaims\(\)/)
 assert.match(protectedPart,/await Promise\.all\(\[\s*supabase\.rpc\('upt_current_profile'\),\s*supabase\.rpc\('upt_current_is_owner'\)/)
 assert.match(protectedPart,/if \(error \|\| !profile \|\| ownerError\) return null/)
 assert.match(protectedPart,/if \(profile\.account_blocked && !isOwner\) return null/)
 assert.match(protectedPart,/if \(!profile\.approved && !isOwner\) return null/)
 assert.match(read('lib/supabase/middleware.ts'),/await supabase\.auth\.getClaims\(\)/)
})
test('Realtime admin updates coalesce server refreshes and reload once after tab becomes visible',()=>{
 const src=read('components/realtime-refresh.tsx')
 assert.match(src,/MIN_REFRESH_INTERVAL_MS=8000/)
 assert.match(src,/Math\.max\(debounceMs,cooldown\)/)
 assert.match(src,/lastRefresh\.current=Date\.now\(\)/)
 assert.match(src,/document\.addEventListener\('visibilitychange',onVisibility\)/)
 assert.match(src,/router\.refresh\(\)/)
 assert.match(src,/channel\.on\('postgres_changes'/)
})
test('staff home reads remain concurrent but within the six outgoing connection budget',()=>{
 const src=read('app/(app)/page.tsx')
 assert.match(src,/await boundedQueries\(\[/)
 assert.match(src,/s\.from\('events'\)/)
 assert.match(src,/s\.from\('responsible_assignments'\)/)
 assert.match(src,/\],3\)/)
})
