import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('release keeps God Mode, AI and autonomous error recovery wired',async()=>{
  const [studio,assistant,errorBridge,errorRoute]=await Promise.all([
    read('components/god-mode/god-studio.tsx'),
    read('components/admin/platform-ai-assistant.tsx'),
    read('components/error-report-bridge.tsx'),
    read('app/api/error-reports/route.ts'),
  ])
  for(const surface of ['builder','ai','automations','source','data','sql','roles','versions','connections'])assert.ok(studio.includes("'"+surface+"'"),surface)
  assert.match(assistant,/<textarea/)
  assert.match(errorBridge,/unhandledrejection/)
  assert.match(errorRoute,/processErrorReport/)
  assert.match(errorRoute,/status:202/)
})

test('release keeps inventory, entrance/guestlist and sales production flows',async()=>{
  const [inventory,guestlist,importRoute,sales]=await Promise.all([
    read('components/crew/inventory-panel.tsx'),
    read('components/crew/guestlist-entrance-client.tsx'),
    read('app/api/guestlist/import/route.ts'),
    read('app/(app)/sales/page.tsx'),
  ])
  for(const label of ['RETOUR MELDEN','BEVESTIGEN','AFWIJZEN','TERUGGEVONDEN'])assert.ok(inventory.includes(label),label)
  assert.match(guestlist,/upt_guestlist_checkin/)
  assert.match(guestlist,/Artiesten aanwezig/)
  assert.match(importRoute,/upt_guestlist_import/)
  assert.match(sales,/sales_transactions/)
  assert.match(sales,/Totale netto-inkomsten/)
})

test('release keeps workplace and shifts integrated instead of duplicated',async()=>{
  const [page,planner,legacy]=await Promise.all([
    read('app/(app)/workplaces/page.tsx'),
    read('components/crew/workplace-shift-planner.tsx'),
    read('app/(app)/shifts/page.tsx'),
  ])
  assert.match(page,/Werkplaatsen & shifts/)
  assert.match(planner,/Personeel \+ uren toevoegen/)
  assert.match(planner,/assignAvailableCrewShift/)
  assert.match(legacy,/redirect\('\/workplaces'\)/)
})

test('release keeps canonical role labels and four-language runtime',async()=>{
  const [roles,runtime]=await Promise.all([
    read('lib/role-ui.ts'),
    read('lib/ui-translation-runtime.ts'),
  ])
  for(const role of ['admin','responsible_lead','staff'])assert.ok(roles.includes('"'+role+'"'),role)
  for(const locale of ['nl','fr','en','de'])assert.ok(runtime.includes(locale),locale)
})

test('release gate keeps role-aware mobile navigation and help discoverability',async()=>{
  const [mobile,roles,help]=await Promise.all([
    read('components/layout/mobile-nav.tsx'),
    read('lib/role-ui.ts'),
    read('lib/ui-field-help.ts'),
  ])
  for(const role of ['staff','responsible_lead','admin'])assert.ok(roles.includes(role),role)
  for(const key of ['ASSIGNED_EVENT_KEYS','STAFF_ACTIVE_SHIFT_KEYS','RESPONSIBLE_ACTIVE_SHIFT_KEYS'])assert.ok(mobile.includes(key),key)
  assert.match(mobile,/featureHelp\(item\.key,label\)/)
  assert.match(mobile,/aria-description=\{help\.description\}/)
  assert.match(help,/description/)
})

test('release gate keeps realtime multi-device and offline recovery contracts',async()=>{
  const [realtime,pwa,offlineSync,queue]=await Promise.all([
    read('lib/realtime-reconnect.ts'),
    read('components/pwa-register.tsx'),
    read('components/crew/global-offline-content-sync.tsx'),
    read('lib/crew-queue.ts'),
  ])
  assert.match(realtime,/state\.attempts < 20/)
  assert.match(pwa,/window\.addEventListener\("online"/)
  assert.match(pwa,/UPT_ACTIVATE_UPDATE/)
  assert.match(offlineSync,/window\.addEventListener\('online',onOnline\)/)
  assert.match(offlineSync,/visibilitychange/)
  assert.match(queue,/crew-queue-change/)
})

test('release gate keeps production cleanup and retired surfaces out of active navigation',async()=>{
  const [nav,roles]=await Promise.all([
    read('components/layout/navigation-items.ts'),
    read('lib/role-ui.ts'),
  ])
  assert.doesNotMatch(nav,/Systeemgezondheid/)
  assert.doesNotMatch(nav,/label:"Release"/)
  assert.match(roles,/navRule\("admin","shifts".*"never",false,false\)/)
  assert.match(roles,/navRule\("staff","shifts".*"never",false,false\)/)
  assert.match(roles,/navRule\("responsible_lead","shifts".*"never",false,false\)/)
})
