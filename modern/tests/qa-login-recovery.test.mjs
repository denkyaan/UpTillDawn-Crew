import test from 'node:test'
import assert from 'node:assert/strict'
import {mayRetryOwnerLookup} from './qa-login-recovery.mjs'
import {readFileSync} from 'node:fs'
test('only one fresh-session retry for explicit technical owner lookup failure',()=>{
 const input={attempt:0,stage:'response',status:200,code:'owner_lookup_error'}
 assert.equal(mayRetryOwnerLookup(input),true)
 for(const patch of [{attempt:1},{stage:'verified-cookie'},{status:403},{status:429},{code:'wrong_portal'},{code:'invalid_credentials'},{code:'account_blocked'},{code:'account_not_approved'},{code:'auth_rate_limited'},{code:'unknown'}]){
  assert.equal(mayRetryOwnerLookup({...input,...patch}),false)
 }
})
test('HTTP login failures stay in the acceptance gate; genuine browser session can still exercise routes',()=>{
 const qa=readFileSync(new URL('./qa-local-release-browser.mjs',import.meta.url),'utf8')
 assert.match(qa,/loginTransientAttempts\.push/)
 assert.match(qa,/return signedState\(role,attempt\+1\)/)
 assert.match(qa,/if\(!state\)state=browserState/)
 assert.match(qa,/!report\.loginCoverage\.complete/)
 assert.match(qa,/loginChecks\.some\(x=>x\.outcome!=='pass'\)/)
 assert.match(qa,/await step\('verified-cookie',\(\)=>verifyCookieIdentity\(context,role\)/)
})
