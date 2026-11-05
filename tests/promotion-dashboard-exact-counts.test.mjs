import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../app/(app)/portals/promotion/page.tsx',import.meta.url),'utf8')
test('promotion dashboard uses exact filtered server-side counts, not a capped sample',()=>{
 assert.match(source,/Promise\.all\(\[/)
 assert.match(source,/count:"exact",head:true/)
 assert.match(source,/\.eq\("status","NOT STARTED"\)/)
 assert.match(source,/\.eq\("status","IN PROGRESS"\)/)
 assert.match(source,/const error=notStartedResult\.error\?\?inProgressResult\.error/)
 assert.doesNotMatch(source,/\.limit\(500\)/)
 assert.doesNotMatch(source,/countIsPartial/)
})
