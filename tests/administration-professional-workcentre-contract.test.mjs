import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute} from '../lib/administration/navigation.ts'

const overview=readFileSync(new URL('../components/administration/administration-overview-dashboard.tsx',import.meta.url),'utf8')
const workspace=readFileSync(new URL('../app/(app)/portals/administration/modules/[slug]/page.tsx',import.meta.url),'utf8')
const shared=readFileSync(new URL('../lib/admin-administration-navigation.ts',import.meta.url),'utf8')

test('New Event goes directly to the existing Administration draft form, not a duplicate events page',()=>{
 assert.match(overview,/href="\/portals\/administration\/modules\/events\?create=1#administration-event-draft"/)
 assert.match(overview,/href="\/portals\/administration\/modules\/events">\{t\.manageEvents\}/)
 assert.match(workspace,/id="administration-event-draft" open=\{requestedCreate==="1"\}/)
 assert.match(workspace,/form action=\{saveAdministrationEventDraft\}/)
 assert.match(workspace,/upt_administration_save_event_draft/)
 assert.equal(administrationRoute('events'),'/portals/administration/modules/events')
})

test('Administration keeps one navigation entry per workflow, with full capabilities preserved',()=>{
 const slugs=administrationNavigationGroups.flatMap(group=>group.slugs)
 assert.equal(new Set(slugs).size,slugs.length)
 for(const slug of ['events','artists','contracts','rosters','timesheets','finance','invoices','banking','inventory','ticketing','personnel','counterparties','automations','ai','documents','reports','sales']){
  assert.ok(slugs.includes(slug),slug)
 }
 assert.equal(slugs.filter(slug=>slug==='counterparties').length,1)
 assert.ok(!slugs.includes('contacts'),'legacy Contacts must remain an alias, not a second workflow')
})

test('Admin accesses canonical Administration routes, not an independently reimplemented financial or contract workflow',()=>{
 assert.match(shared,/import \{administrationRoute\}/)
 assert.match(shared,/return entry\?administrationRoute\(entry\.slug\):null/)
 for(const slug of ['artists','contracts','rosters','timesheets','counterparties','finance','invoices','banking','ticketing']){
  assert.match(shared,new RegExp('slug:"'+slug+'"'))
 }
})
