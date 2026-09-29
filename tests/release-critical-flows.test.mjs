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
