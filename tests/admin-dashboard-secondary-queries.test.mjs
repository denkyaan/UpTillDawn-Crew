import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/admin/page.tsx','utf8')
test('secondary dashboard lookups run concurrently and first-use only needs existence',()=>{
 assert.match(source,/const \[approvedChecks,historicalEventCheck,sessionBreaks\]=await Promise\.all\(\[/)
 assert.match(source,/s\.from\('events'\)\.select\('id'\)\.limit\(1\)/)
 assert.doesNotMatch(source,/s\.from\('events'\)\.select\('id',\{count:'exact',head:true\}\)/)
 assert.match(source,/if\(historicalEventCheck\?\.error\)failedSourceNames\.push\('historicalEventCheck'\)/)
 assert.match(source,/if\(sessionBreaks\.error\)failedSourceNames\.push\('sessionBreaks'\)/)
})

test('approved check-ins, historical existence and session breaks share one dependent parallel batch',()=>{
 assert.match(source,/const \[approvedChecks,historicalEventCheck,sessionBreaks\]=await Promise\.all\(\[/)
 assert.match(source,/relevantEventIds\.length\?s\.from\('check_ins'\)/)
 assert.match(source,/activeSessionIds\.length\?s\.from\('break_sessions'\)/)
 assert.match(source,/primaryOverviewSources=\[events,sessions,pendingIns,pendingOuts,incidents,assignments,shifts,profiles,workplaces,syncIssues,approvedChecks/)
})
