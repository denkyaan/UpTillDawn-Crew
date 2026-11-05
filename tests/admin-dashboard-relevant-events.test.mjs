import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin live dashboard only loads non-archived events that have not ended',()=>{
 assert.match(source,/s\.from\('events'\)\.select\('id,name,start_at,end_at,status'\)\.neq\('status','archived'\)\.gte\('end_at',now\.toISOString\(\)\)\.order\('start_at'\)/)
 assert.match(source,/activeEvents=eventRows\.filter/)
 assert.match(source,/eventRows\.filter\(event=>Date\.parse\(event\.end_at\)>=nowMs\)/)
})
