import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const auth=readFileSync('lib/actions/auth.ts','utf8')
const current=auth.slice(auth.indexOf('export const getCurrentUser = cache('),auth.indexOf('export async function verifyAdminSettingsCode'))

test('anonymous Main API requests do not open PostgREST sessions before authentication is possible',()=>{
 const cookies=current.indexOf('const hasSessionCookie = (await cookies()).getAll()')
 const fastDenial=current.indexOf('if (!hasSessionCookie) return null')
 const client=current.indexOf('const supabase = await createClient()')
 const verified=current.indexOf("await readContext('upt_current_session_context')")
 assert.ok(cookies>=0&&fastDenial>cookies&&client>fastDenial&&verified>client,
  'Absent auth cookies must reject before any Data API work')
})

test('cookie precheck recognizes signed-session cookie shape without accepting unrelated PKCE or spoofed names',()=>{
 const pattern=/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i
 for(const value of [
  'sb-npbjrtiolqperdgljnhi-auth-token',
  'sb-npbjrtiolqperdgljnhi-auth-token.0',
  'sb-npbjrtiolqperdgljnhi-auth-token.12',
 ])assert.match(value,pattern)
 for(const value of [
  'sb-npbjrtiolqperdgljnhi-auth-token-code-verifier',
  'sb-npbjrtiolqperdgljnhi-auth-token-malicious',
  'sb-other-random',
  '__Host-custom-token',
 ])assert.doesNotMatch(value,pattern)
 assert.match(current,/\^sb-\[a-z0-9\]\+-auth-token/)
 assert.match(current,/cookie\.value\.length > 0/)
})

test('present, invalid and stale cookies never authorize users without the signed RLS-scoped RPC',()=>{
 assert.match(current,/await readContext\('upt_current_session_context'\)/)
 assert.match(current,/if \(error \|\| !profile \|\| !profile\.id/)
 assert.match(current,/if \(profile\.account_blocked && !isOwner\) return null/)
 assert.match(current,/if \(!profile\.approved && !isOwner\) return null/)
 assert.doesNotMatch(current,/supabase\.auth\.getSession\(\)/)
})
