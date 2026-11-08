import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync(new URL('../app/(app)/events/[id]/command/page.tsx',import.meta.url),'utf8')
test('command center keeps event scope across staffing and timesheets',()=>{
 assert.match(page,/href=\{"\/workplaces\?event="\+encodeURIComponent\(id\)\}/)
 assert.match(page,/href=\{'\/timesheets\?event='\+id\}/)
 assert.doesNotMatch(page,/href="\/shifts"/)
})
