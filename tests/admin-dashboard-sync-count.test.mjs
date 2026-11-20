import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin dashboard counts all unsynced operations without fetching capped rows',()=>{
 assert.match(source,/s\.from\('offline_operation_records'\)\.select\('id',\{count:'exact',head:true\}\)\.neq\('status','synced'\)/)
 assert.match(source,/pendingSyncCount=syncIssues\.count\?\?0/)
 assert.match(source,/pendingSyncCount\+' serveroperatie/)
 assert.doesNotMatch(source,/syncRows\.length/)
})
