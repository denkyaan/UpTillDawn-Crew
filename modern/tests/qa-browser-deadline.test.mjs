import test from 'node:test'
import assert from 'node:assert/strict'
import {withDeadline} from './qa-browser-deadline.mjs'
test('deadline rejects hanging operations, preserves valid results and propagates real errors',async()=>{
 assert.equal(await withDeadline('SUCCESS',async()=>42,100),42)
 await assert.rejects(withDeadline('HANG',()=>new Promise(()=>{}),20),/DEADLINE_HANG/)
 await assert.rejects(withDeadline('FAIL',async()=>{throw Error('original error')},100),/original error/)
 await assert.rejects(withDeadline('INVALID',async()=>42,0),/INVALID_DEADLINE/)
})

test('browser login and HTTP session have independent bounded setup and explicit form-fill deadlines',async()=>{
 const {readFile}=await import('node:fs/promises')
 const source=await readFile(new URL('./qa-local-release-browser.mjs',import.meta.url),'utf8')
 assert.match(source,/context\.setDefaultTimeout\(8000\)/)
 assert.match(source,/step\('email-fill',\(\)=>page\.locator\('input\[name="email"\]'\)\.fill\(role\.email,\{timeout:5000\}\),6000\)/)
 assert.match(source,/step\('password-fill',\(\)=>page\.locator\('input\[name="password"\]'\)\.fill\(password,\{timeout:5000\}\),6000\)/)
 const run=source.slice(source.indexOf('async function runRole(role)'))
 assert.ok(run.indexOf('await signedState(role)')<run.indexOf('await browserLogin(role,state?.landing)'))
 assert.match(source,/limit\('ROUTE_REGISTER'/)
 assert.match(source,/loginCoverage\.complete/)
})
