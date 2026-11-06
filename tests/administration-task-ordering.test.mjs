import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('administration tasks have deterministic ordering before limiting rows',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(source,/from\("tasks"\)\.select\("id,title,status"\)\.order\("id",\{ascending:false\}\)\.limit\(50\)/)
 assert.match(source,/taskRows\?\.error/)
})
