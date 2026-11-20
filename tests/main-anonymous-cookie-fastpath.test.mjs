import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const middleware=readFileSync('lib/supabase/middleware.ts','utf8')

test('anonymous private routes redirect before any JWT verifier or Supabase SSR client initialization',()=>{
 const bypass=middleware.indexOf('const hasSessionCookie =')
 const authClient=middleware.indexOf('const supabase = createServerClient')
 const claims=middleware.indexOf('await supabase.auth.getClaims()')
 assert.ok(bypass>0&&authClient>bypass&&claims>authClient,
  'Anonymous requests must be rejected before any Auth CPU work')
 assert.match(middleware,/if \(!hasSessionCookie\) \{[\s\S]*?return NextResponse\.redirect\(login\)/)
 assert.match(middleware,/login\.pathname = '\/login'/)
 assert.match(middleware,/login\.search = ''/)
})
test('recognizes both standard and chunked Supabase SSR cookies, never PKCE verifier cookies',()=>{
 const match=middleware.match(/(\/\^sb-[^\n]*\/i)\.test\(cookie\.name\)/)
 assert.ok(match,'Supabase browser cookie regex must remain in middleware')
 const cookiePattern=new RegExp(match[1].slice(1,-2),'i')
 for(const name of ['sb-npbjrtiolqperdgljnhi-auth-token',
  'sb-npbjrtiolqperdgljnhi-auth-token.0',
  'sb-npbjrtiolqperdgljnhi-auth-token.12'])
  assert.match(name,cookiePattern)
 for(const name of ['sb-npbjrtiolqperdgljnhi-auth-token-code-verifier',
   'sb-npbjrtiolqperdgljnhi-auth-token-malicious',
   '__Host-custom-token',
   'sb-other-random'])
  assert.doesNotMatch(name,cookiePattern)
 assert.match(middleware,/cookie\.value\.length > 0/)
})
test('fast path does not accept, validate, or authorize a cookie by presence alone',()=>{
 assert.match(middleware,/const authenticated = !claimsError && typeof verified\?\.claims\?\.sub === 'string'/)
 assert.match(middleware,/await supabase\.rpc\('upt_current_effective_role'\)/)
 assert.match(middleware,/await supabase\.rpc\('upt_current_is_owner'\)/)
 assert.match(middleware,/if \(isPublicPath\(pathname\)/)
 assert.match(middleware,/pathname === '\/signup'/)
 assert.match(middleware,/pathname === '\/forgot-password'/)
 assert.doesNotMatch(middleware,/session\.user_metadata\?\.role|claims\.user_metadata/)
})