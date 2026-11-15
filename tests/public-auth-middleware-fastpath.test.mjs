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

test('proxy bypasses only the same public routes that already skip session verification',()=>{
 const proxy=readFileSync('proxy.ts','utf8')
 const match=proxy.match(/matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'([^']+)'/)
 assert.ok(match,'Proxy must have a statically inspectable matcher')
 const pattern=new RegExp('^'+match[1].replace(/\\\\/g,'\\')+'$')
 const skipped=[
  '/login','/login/staff','/login/responsible','/login/administration','/login/promotion','/login/admin',
  '/api/crew','/api/god/health','/auth/callback','/auth/confirm',
  '/auth/recovery','/auth/reset-password','/unauthorized','/disabled','/verify-email',
  '/robots.txt','/manifest.webmanifest','/sitemap.xml','/icon.png',
 ]
 for(const path of skipped)assert.equal(pattern.test(path),false,'already-public path must bypass proxy: '+path)
 const protectedRoutes=[
  '/','/admin','/events','/chat','/portals/administration/finance','/maker-mode',
  '/god-mode','/god-mode/logs','/signup','/forgot-password','/api-not-real','/login-fake',
 ]
 for(const path of protectedRoutes)assert.equal(pattern.test(path),true,'protected/redirect-guarded path must keep proxy: '+path)
 assert.match(readFileSync('lib/supabase/middleware.ts','utf8'),/pathname !== '\/signup'/)
 assert.match(readFileSync('lib/supabase/middleware.ts','utf8'),/pathname !== '\/forgot-password'/)
})
