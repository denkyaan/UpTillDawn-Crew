import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {administrationNavigationGroups,administrationRoute} from '../lib/administration/navigation.ts'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const overview=read('components/administration/administration-overview-dashboard.tsx')
const subtab=read('components/administration/administration-subtab-status.tsx')
const appLayout=read('components/layout/app-layout.tsx')
const css=read('app/globals.css')
const rootLayout=read('app/layout.tsx')

test('each real Administration subtab has one operational status, not a duplicate management page',()=>{
 const all=administrationNavigationGroups.flatMap(group=>group.slugs)
 const coveredAbove=new Set(['dashboard','events','timesheets','rosters','contracts','finance','inventory','notifications','automations'])
 assert.equal(new Set(all).size,all.length,'canonical navigation itself must remain unique')
 assert.match(overview,/AdministrationSubtabStatus locale=\{locale\}/)
 assert.match(subtab,/const shownAbove=new Set\(/)
 assert.match(subtab,/group\.slugs\.filter\(slug=>!shownAbove\.has\(slug\)/)
 assert.match(subtab,/data-administration-subtab-status=\{slug\}/)
 assert.match(subtab,/href=\{administrationRoute\(slug\)\}/)
 for(const slug of all){
  if(coveredAbove.has(slug))continue
  assert.ok(subtab.includes(slug+':')||subtab.includes('"'+slug+'":'),slug+' missing source for subtab')
 }
 assert.match(overview,/id:"finance",group:"money",label:w\.financial,href:"\/portals\/administration\/finance"/)
 assert.notEqual(administrationRoute('finance'),administrationRoute('invoices'))
})

test('subtab data is RLS-scoped, kept separate by source and does not pretend missing records are zero',()=>{
 for(const table of ['admin_artist_bookings','admin_financial_payments','admin_financial_documents','admin_operational_obligations','event_documents','chat_channels','admin_counterparties','sales_transactions','portal_role_assignments']){
  assert.ok(subtab.includes('.from("'+table+'")'),table)
 }
 assert.match(subtab,/upt_ticket_sales_summary/)
 assert.match(subtab,/validateTicketSalesSummary/)
 assert.match(subtab,/promotion_only/)
 assert.match(subtab,/upt_crew_directory/)
 assert.match(subtab,/upt_own_profile_details/)
 assert.match(subtab,/admin\?raw\.from\("promotion_evidence"\)/)
 assert.match(subtab,/if\(result\.error\|\|result\.count===null\)/)
 assert.match(subtab,/no separate status metric available/i)
 assert.doesNotMatch(subtab,/service.*connected\s*:\s*true/i)
})

test('Admin AI button remains in the topbar while expanded bottom navigation closes only its panel',()=>{
 assert.match(appLayout,/const adminAiVisible=isAdmin\|\|administrationPortal/)
 assert.doesNotMatch(appLayout,/adminAiVisible=.*!navigationExpanded/)
 assert.match(appLayout,/if\(open\)setAdminAiOpen\(false\)/)
 assert.match(appLayout,/adminAiAction=\s*adminAiVisible\?/)
})

test('iPhone focus never forces automatic Safari zoom, while manual accessibility zoom remains allowed',()=>{
 assert.match(css,/@media \(max-width: 767px\) and \(hover: none\) and \(pointer: coarse\)/)
 assert.match(css,/input:not\(\[type="checkbox"\]\)/)
 assert.match(css,/select,\s*textarea,\s*\[contenteditable="true"\]\s*\{\s*font-size: 16px !important;/)
 assert.match(rootLayout,/userScalable:\s*true/)
 assert.doesNotMatch(rootLayout,/userScalable:\s*false|maximumScale:\s*1/)
})
