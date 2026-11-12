import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=(path)=>readFileSync(path,'utf8')
const groups=read('lib/administration/navigation.ts')
const nav=read('components/administration/administration-navigation.tsx')
const modules=read('lib/administration/modules.ts')
const home=read('components/administration/administration-overview-dashboard.tsx')
const portal=read('app/(app)/portals/[portal]/page.tsx')
const contacts=read('app/(app)/portals/administration/contacts/page.tsx')
const parties=read('app/(app)/portals/administration/counterparties/page.tsx')
const detail=read('app/(app)/portals/administration/modules/[slug]/page.tsx')

test('Administration home has an operational work pulse without a repeated module directory',()=>{
 assert.match(portal,/if \(portal === 'administration'\) return <AdministrationOverviewDashboard locale=\{locale\}/)
 assert.doesNotMatch(portal,/Alle administratieve modules|All administration modules/)
 assert.match(home,/<Link\b/)
 assert.match(home,/from\("admin_artist_bookings"\)/)
 assert.match(home,/from\("admin_financial_documents"\)/)
 assert.match(home,/from\("admin_roster_proposals"\)/)
 assert.match(home,/from\("events"\)/)
 assert.match(home,/from\("timesheets"\)/)
 assert.match(home,/from\("inventory_items"\)/)
})

test('same customer/supplier register has one canonical route and historical aliases',()=>{
 assert.match(contacts,/redirect\("\/portals\/administration\/counterparties"\)/)
 assert.match(detail,/if\(slug==="contacts"\)redirect\("\/portals\/administration\/counterparties"\)/)
 assert.match(parties,/async function addCounterparty/)
 assert.match(parties,/async function updateCounterparty/)
 assert.doesNotMatch(groups,/slugs:\[[^\]]*"contacts"/)
 assert.match(groups,/slugs:\[[^\]]*"counterparties"/)
})

test('rosters, workstates, personnel directory and payroll export use distinguishable labels',()=>{
 assert.match(nav,/slug==="staff"\?\(\{nl:"Loonexport"/)
 assert.match(nav,/slug==="timesheets"\?\(\{nl:"Werkstaten"/)
 assert.match(nav,/slug==="personnel"\?\(\{nl:"Personeelslijst"/)
 assert.match(modules,/\{"slug":"staff","title":\{"nl":"Loonexport"/)
 assert.match(detail,/slug==="staff"&&<section className="space-y-3 rounded-2xl border bg-card p-5"/)
 assert.doesNotMatch(detail,/\(slug==="staff"\|\|slug==="reports"\)/)
})

test('equivalent marketing, sponsor and contact shortcuts do not duplicate canonical actions',()=>{
 const admin=read('lib/admin-administration-navigation.ts')
 assert.match(groups,/slugs:\[[^\]]*"sponsors"/)
 assert.match(groups,/slugs:\[[^\]]*"marketing"/)
 assert.match(groups,/slugs:\[[^\]]*"promotion-tasks"/)
 assert.match(groups,/slugs:\[[^\]]*"counterparties"/)
 assert.doesNotMatch(admin,/key:"admin-contacts"/)
 assert.match(admin,/key:"admin-sponsors"/)
 assert.match(admin,/key:"admin-marketing"/)
 assert.match(admin,/key:"admin-counterparties"/)
})

test('Administration Events supports permission-scoped draft creation/edit without unreviewed publication',()=>{
 const source=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 const migration=read('supabase/migrations/20261112213000_administration_event_draft_workflow.sql')
 assert.match(source,/saveAdministrationEventDraft/)
 assert.match(source,/upt_administration_save_event_draft/)
 assert.match(source,/Nieuw evenement aanmaken/)
 assert.match(source,/Concept aanpassen/)
 assert.match(migration,/e\.status='draft'/)
 assert.match(migration,/a\.role='administrative_staff'/)
 assert.match(migration,/a\.approved IS TRUE AND a\.revoked_at IS NULL/)
 assert.match(migration,/e\.created_by=v_actor OR public\.upt_is_admin\(v_actor\)/)
 assert.match(migration,/GRANT EXECUTE ON FUNCTION/)
 const updateClause=migration.split('UPDATE public.events e')[1]?.split('WHERE e.id=')[0]||''
 assert.ok(updateClause,'Event draft UPDATE must exist')
 assert.doesNotMatch(updateClause,/\bstatus\s*=/)
})

test('Contracts tab can start a new agreement in the existing DJ workflow',()=>{
 const detail=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 const create=read('app/(app)/portals/administration/modules/artists/new/page.tsx')
 assert.match(detail,/artists\/new\?contract=1/)
 assert.match(create,/contract_context/)
 assert.match(create,/booking\.id\+"\/agreement"/)
})
