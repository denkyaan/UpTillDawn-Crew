import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const dashboard=readFileSync('components/administration/administration-overview-dashboard.tsx','utf8')

test('Administration overview has a shared deadline across every data and label request',()=>{
 assert.match(dashboard,/const overviewSignal=AbortSignal\.timeout\(12_000\)/)
 const querySection=dashboard.slice(dashboard.indexOf('const [hours,inventory,contracts,financial,rosters,notifications,events,draftDocuments,automationRuns]'),dashboard.indexOf('const labels='))
 assert.equal((querySection.match(/\.abortSignal\(overviewSignal\)/g)||[]).length,9)
 assert.match(dashboard,/upt_administration_timesheet_labels[\s\S]*?\.abortSignal\(overviewSignal\)/)
})
test('Timed-out overview queries display unavailable status, never invented zero counts',()=>{
 assert.match(dashboard,/const hasDataError=Boolean\(hours\.error/)
 assert.match(dashboard,/hasDataError&&<p role="alert"/)
 assert.match(dashboard,/item\.error\?w\.loadError:item\.detail/)
 assert.match(dashboard,/item\.error\?"—":item\.count\?\?"—"/)
 assert.match(dashboard,/events\.error\?w\.loadError:w\.noEvents/)
})
