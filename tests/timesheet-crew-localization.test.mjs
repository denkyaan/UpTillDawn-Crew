import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync(new URL('../app/(app)/timesheets/page.tsx',import.meta.url),'utf8')
const controls=readFileSync(new URL('../components/crew/timesheet-controls.tsx',import.meta.url),'utf8')
test('timesheet status is translated across all four locales',()=>{
 for(const lang of ['nl','fr','en','de']) assert.match(page,new RegExp(lang+':\\{[^\\n]*statuses:'))
 for(const status of ['open','submitted','approved','rejected','locked']) assert.equal((page.match(new RegExp(status+':','g'))||[]).length>=4,true)
 assert.match(controls,/copy\.statuses\[r\.status\]/)
 assert.match(controls,/copy\.statuses\[own\?\.status/)
})
test('reviewer sees permitted profile names with fallback for missing profiles',()=>{
 assert.match(page,/const names(?::Record<string,string>)?=Object\.fromEntries/)
 assert.match(page,/names=\{names\}/)
 assert.match(controls,/names\[r\.user_id\]\|\|r\.user_id/)
})
