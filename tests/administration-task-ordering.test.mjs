import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('administration tasks have deterministic ordering before limiting rows',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(source,/from\("tasks"\)\.select\("id,title,status"\)\.order\("id",\{ascending:false\}\)\.limit\(50\)/)
 assert.match(source,/taskRows\?\.error/)
})

test('administration events have a stable secondary sort for equal start dates',()=>{
 const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
 assert.match(source,/from\("events"\)\.select\("id,name,status,start_at"\)\.order\("start_at",\{ascending:false,nullsFirst:false\}\)\.order\("id",\{ascending:true\}\)\.limit\(50\)/)
})
