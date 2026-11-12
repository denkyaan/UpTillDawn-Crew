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

test('Administration home has one read-only work pulse, no second module directory',()=>{
 assert.match(portal,/if \(portal === 'administration'\) return <AdministrationOverviewDashboard locale=\{locale\}/)
 assert.doesNotMatch(portal,/Alle administratieve modules|All administration modules/)
 assert.doesNotMatch(home,/<Link\b/)
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
