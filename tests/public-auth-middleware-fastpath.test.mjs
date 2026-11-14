import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('lib/supabase/middleware.ts','utf8')
test('public login and API routes skip server-side session refresh',()=>{
 const early=source.indexOf('if (isPublicPath(pathname) &&')
 const auth=source.indexOf('await supabase.auth.getClaims()')
 assert.ok(early>0 && early<auth,'public fast path must run before verified claims')
 assert.match(source,/return NextResponse.next\(\{ request \}\)/)
 assert.match(source,/pathname !== '\/signup'/)
 assert.match(source,/pathname !== '\/forgot-password'/)
})
