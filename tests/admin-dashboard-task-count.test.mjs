import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard counts unfinished task assignments server-side without transferring rows',()=>{
 assert.match(source,/s\.from\('task_assignments'\)\.select\('id',\{count:'exact',head:true\}\)\.neq\('status','COMPLETED'\)/)
 assert.match(source,/openAssignmentCount=assignments\.count\?\?0/)
 assert.match(source,/openAssignmentCount\+' open taaktoewijzing/)
 assert.match(source,/label="Open taaktoewijzingen" value=\{openAssignmentCount\}/)
 assert.doesNotMatch(source,/assignmentRows\.length/)
})
