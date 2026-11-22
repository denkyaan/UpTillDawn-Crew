import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('candidate retries only the original integration READ DTO once, with cooling and no extra writes',()=>{
 const source=file('modern/src/original/transport.ts')
 assert.match(source,/invokeOriginalRead\(id:string,args:unknown\[\]\)/)
 assert.match(source,/for\(let attempt=0;attempt<2;attempt\+\+\)/)
 assert.match(source,/id==='external-services-view'/)
 assert.match(source,/id!=='external-services-view'/)
 assert.match(source,/new Set\(\[502,503,504\]\)/)
 assert.match(source,/setTimeout\(resolve,1800\)/)
 assert.match(source,/credentials:'same-origin'/)
 assert.match(source,/return \(result as \{value:unknown\}\)\.value/)
 assert.match(source,/if\(!response\.ok\)throw Error/)
 const actions=source.slice(source.indexOf('export async function invokeOriginalAction'),source.indexOf('export async function invokeOriginalRead'))
 assert.doesNotMatch(actions,/setTimeout\(resolve|for\(let attempt=/)
})

test('deep original Main QA keeps strict 44-route acceptance and bounded source read recovery',()=>{
 const qa=file('modern/tests/deep-route-parity-qa.mjs')
 assert.match(qa,/EXPECTED!==44/)
 assert.match(qa,/for\(let attempt=0;attempt<3;attempt\+\+\)/)
 assert.match(qa,/status!==502&&status!==503&&status!==504/)
 assert.match(qa,/if\(attempt===2\)return response/)
 assert.match(qa,/await navigateOriginalWithRecovery\(a,path\)/)
 assert.match(qa,/DEEP_PARITY_MISMATCHES/)
 assert.match(qa,/await matching\(a,b,name\)/)
 assert.match(qa,/document\.fonts\.ready/)
 assert.match(qa,/DEEP_PARITY_LAYOUT_GEOMETRY/)
 assert.match(qa,/bridgeRead5xx=/)
 assert.match(qa,/legacyMainReadRecoveries:legacyRecoveries/)
 assert.match(qa,/VITE_MIGRATION_ALLOW_WRITES!=='false'/)
 assert.match(qa,/writeActionsSubmitted:0/)
 assert.match(qa,/mainCutoverAllowed:false/)
})
