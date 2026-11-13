import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationRoute} from '../lib/administration/navigation.ts'

const overview=readFileSync(new URL('../components/administration/administration-overview-dashboard.tsx',import.meta.url),'utf8')
const extra=readFileSync(new URL('../components/administration/administration-subtab-status.tsx',import.meta.url),'utf8')

test('Operational overview stays informative even when all queues are empty',()=>{
 assert.match(overview,/const priorityItems=\[/)
 assert.match(overview,/priorityItems\.filter\(item=>item\.group===group\.key\)\.map/)
 assert.doesNotMatch(overview,/\.filter\(item=>Boolean\(item\.error\)\|\|\(item\.count\?\?0\)>0\)/)
 assert.match(overview,/const groups=\[/)
 for(const status of ['timesheets','rosters','finance','contracts','inventory','notifications','automations']){
  assert.match(overview,new RegExp('id:"'+status+'"'))
 }
 assert.match(overview,/automationRun\?\.error_code/)
 assert.match(overview,/w\.noRun/)
 assert.match(overview,/w\.allClear/)
 assert.match(overview,/w\.noEvents/)
})

test('Every operational status has exactly one canonical action, without duplicate create or manage controls',()=>{
 assert.match(overview,/data-administration-priority=\{item\.id\}/)
 assert.match(overview,/href=\{item\.href\}/)
 assert.match(overview,/href="\/portals\/administration\/modules\/events"/)
 assert.doesNotMatch(overview,/artists\/new\?contract=1|events\?create=1/)
 assert.doesNotMatch(overview,/const pulse=\[/)
 for(const moduleSlug of ['timesheets','rosters','contracts','finance','inventory','notifications','automations','events']){
  assert.ok(overview.includes('href:"'+administrationRoute(moduleSlug)+'"')||overview.includes('href="'+administrationRoute(moduleSlug)+'"'),moduleSlug)
 }
 assert.match(overview,/AdministrationSubtabStatus locale=\{locale\}/)
 assert.match(extra,/administrationRoute\(slug\)/)
 assert.ok(administrationRoute('invoices')!==administrationRoute('finance'))
})

test('Zero counts and unavailable sources are distinct; no false assurance for failed queries',()=>{
 assert.match(overview,/hasDataError/)
 assert.match(overview,/events\.error\?w\.loadError:w\.noEvents/)
 assert.match(overview,/item\.error\?w\.loadError:item\.detail/)
 assert.match(overview,/item\.error\?"—":item\.count\?\?"—"/)
 assert.match(overview,/draftDocuments\.error/)
 assert.match(overview,/automationRuns\.error/)
 assert.match(overview,/upt_administration_timesheet_labels/)
})

test('Overview texts and statuses are available in every supported UI language',()=>{
 for(const key of ['nl:','fr:','en:','de:'])assert.ok(overview.includes(key),key)
 assert.match(overview,/timeZone:"Europe\/Brussels"/)
})
