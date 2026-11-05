import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard exposes safe aggregate data timing metrics',()=>{
 assert.match(source,/\[admin-dashboard\] data timings/)
 for(const metric of ['authDurationMs','initialQueriesDurationMs','approvedChecksDurationMs','totalDataDurationMs','failedSources'])assert.ok(source.includes(metric))
 const payload=source.match(/console\.info\('\[admin-dashboard\] data timings',\s*\{([^}]*)\}/)?.[1]||''
 assert.doesNotMatch(payload,/email|password|user_id|ip\b|sessionId/i)
})
