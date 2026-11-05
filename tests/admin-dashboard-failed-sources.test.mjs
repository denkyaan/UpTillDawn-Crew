import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard identifies failing query sources without exposing error bodies',()=>{
 assert.match(source,/const sourceNames=/)
 assert.match(source,/primaryOverviewSources\[index\]\.error/)
 assert.match(source,/failedSourceNames\.push\('sessionBreaks'\)/)
 assert.match(source,/failedSourceNames \}/)
 assert.doesNotMatch(source,/console\.info\('\[admin-dashboard\] data timings',[^\n]*\.error/)
})
