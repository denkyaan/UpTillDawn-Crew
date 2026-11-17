import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync('scripts/main-adversarial-surface.mjs','utf8')
const probe=source.slice(source.indexOf('async function probe('),source.indexOf('// Low concurrency avoids'))
test('anonymous Main read-only GET may recover one transient socket reset, never a non-GET',()=>{
 assert.match(probe,/const maxAttempts=method==='GET'\?2:1/)
 assert.match(probe,/for\(let attempt=1;attempt<=maxAttempts;attempt\+\+\)/)
 assert.match(probe,/catch\(error\)\{/)
 assert.match(probe,/if\(attempt<maxAttempts\)/)
 assert.match(probe,/durationMs:Date\.now\(\)-started,attempts:attempt,failure/)
})
test('anonymous Main tests still FAIL on 503 and unauthorized private API success',()=>{
 assert.match(probe,/if\(response\.status>=500\)failure='Server error on read-only probe'/)
 assert.match(probe,/entry\.type==='api'&&privateApi\.test\(entry\.route\)&&response\.status>=200&&response\.status<300/)
 assert.match(probe,/if\(method==='POST'&&extra\.crossOrigin&&response\.status>=200&&response\.status<300\)failure=/)
 assert.match(probe,/record\(\{method,route:entry\.route,type:entry\.type,file:entry\.file,status:response\.status/)
 assert.match(source,/if\(failures\.length\)process\.exitCode=1/)
 assert.doesNotMatch(probe,/if\(response\.status>=500\)[^\n]*continue/)
})
test('POST mutating probes remain a single attempt and have no authenticated credentials',()=>{
 assert.match(probe,/const maxAttempts=method==='GET'\?2:1/)
 assert.match(source,/headers:\{'Content-Type':'application\/json',Origin:'https:\/\/malicious\.example'/)
 assert.doesNotMatch(source,/Authorization:|Bearer /)
})
