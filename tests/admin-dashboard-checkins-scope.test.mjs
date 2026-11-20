import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard scopes approved check-ins to relevant shift events',()=>{
 assert.match(source,/const relevantEventIds=/)
 assert.match(source,/\.eq\('status','approved'\)\.in\('event_id',relevantEventIds\)/)
 assert.doesNotMatch(source,/\.eq\('status','approved'\),s\.from\('responsible_assignments'\)/)
 assert.match(source,/relevantEventIds\.length\?s\.from\('check_ins'\)/)
 assert.match(source,/const \[approvedChecks,historicalEventCheck,sessionBreaks\]=await Promise\.all\(\[/)
})
