import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const middleware=readFileSync('lib/supabase/middleware.ts','utf8')
const qa=readFileSync('scripts/main-30-distinct-staff.mjs','utf8')

test('Finance GET authorizes before expensive protected server rendering',()=>{
 const earlyRole=middleware.indexOf('const requiresEarlyRoleCheck')
 const bypass=middleware.indexOf('if (safeRead && ordinaryAppPage && !requiresEarlyRoleCheck')
 const auth=middleware.indexOf("supabase.rpc('upt_can_manage_administration')")
 assert.ok(earlyRole>=0 && earlyRole<bypass,'Finance guard must precede generic safe GET bypass')
 assert.match(middleware,/const isFinanceArea = pathname === '\/portals\/administration\/finance'/)
 assert.match(middleware,/pathname === '\/admin' \|\| pathname.startsWith\('\/admin\/'\) \|\| isFinanceArea/)
 assert.ok(auth>bypass,'Signed finance authorization must be evaluated for requests bypassing ordinary SSR fastpath')
 assert.match(middleware,/if \(error\) return authzUnavailable\(\)/)
 assert.match(middleware,/if \(canManage !== true\) return redirectDenied\('\/portals'\)/)
 assert.doesNotMatch(middleware,/supabase\.rpc\('upt_my_portal_assignments'\)/,
  'The finance proxy should use one self-scoped RPC, not multiple auth lookups')
 assert.doesNotMatch(middleware,/request\.cookies\.get\('uptilldawn-last-workspace'\)/,
  'A client-selected workspace cookie must not grant financial access')
})

test('QA verifies only the canonical, authenticated QR attendance path',()=>{
 assert.match(qa,/client\.rpc\('upt_qr_request'\)/)
 assert.doesNotMatch(qa,/client\.rpc\('upt_request_check_in'\)/)
 assert.match(qa,/guarded\.data\?\.action,'outside_window'/)
 assert.match(qa,/guarded\.data\?\.next_shift_id\?\?null,null/)
 assert.match(qa,/history\.length,0/)
 assert.match(qa,/report\.checkinDenied===COUNT/)
 assert.match(qa,/report\.http5xx===0/)
 assert.match(qa,/report\.browserReady===COUNT/)
 assert.match(qa,/cleanupVerified/)
})

test('Main QA remains strict on browser and runtime errors',()=>{
 const browser=readFileSync('scripts/e2e-seven-main-bots.mjs','utf8')
 const worker=readFileSync('scripts/main-worker-outcomes.mjs','utf8')
 assert.match(browser,/if\(status>=500\)throw Error/)
 assert.match(browser,/if\(errors\.length\)process\.exitCode=1/)
 assert.match(worker,/observedFailures>0/)
 assert.match(worker,/process\.exitCode=1/)
})
