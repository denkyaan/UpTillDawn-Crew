import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync('lib/actions/auth.ts','utf8')
const middleware=readFileSync('lib/supabase/middleware.ts','utf8')
const administration=readFileSync('lib/administration/access.ts','utf8')
const runtime=source.slice(source.indexOf('export const getCurrentUser = cache('))

test('anonymous API requests are rejected before a Supabase SSR client or PostgREST RPC is opened',()=>{
 const cookieCheck=runtime.indexOf('const hasSessionCookie = (await cookies()).getAll().some(')
 const denial=runtime.indexOf('if (!hasSessionCookie) return null')
 const client=runtime.indexOf('const supabase = await createClient()')
 const verification=runtime.indexOf("readContext('upt_current_session_context')")
 assert.ok(cookieCheck>=0&&cookieCheck<denial&&denial<client&&client<verification,
  'getCurrentUser must reject absent cookies before any network request, retaining signed context verification')
 assert.match(runtime,/getCurrentUser = cache\(async function getCurrentUser\(\)/)
 assert.match(runtime,/if \(error \|\| !profile \|\| !profile\.id/)
 assert.match(administration,/if\(!user\)return \{ok:false as const,status:401\}/)
})

test('only actual Supabase JWT cookies pass the negative guard, including official chunked formats',()=>{
 const match=runtime.match(/(\/\^sb-[^\n]*\/i)\.test\(cookie\.name\)/)
 assert.ok(match,'SSR Auth cookie name pattern missing')
 const pattern=new RegExp(match[1].slice(1,-2),'i')
 for(const name of ['sb-npbjrtiolqperdgljnhi-auth-token',
  'sb-npbjrtiolqperdgljnhi-auth-token.0',
  'sb-npbjrtiolqperdgljnhi-auth-token.12'])assert.match(name,pattern)
 for(const name of ['sb-npbjrtiolqperdgljnhi-auth-token-code-verifier',
  'sb-npbjrtiolqperdgljnhi-auth-token-bogus',
  '__Host-token','sb-unrelated'])assert.doesNotMatch(name,pattern)
 assert.match(runtime,/cookie\.value\.length > 0/)
 assert.match(middleware,/const hasSessionCookie = request\.cookies\.getAll\(\)/)
})

test('cookie presence cannot authorize an API user or Maker role by itself',()=>{
 assert.match(runtime,/upt_current_session_context/)
 assert.match(runtime,/profile\.account_blocked && !isOwner/)
 assert.match(runtime,/!profile\.approved && !isOwner/)
 assert.match(runtime,/effective_role/)
 assert.match(runtime,/is_owner/)
 assert.doesNotMatch(runtime,/session\.user_metadata\?\.role/)
})
