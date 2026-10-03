import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('guestlist and entrance are one searchable realtime flow',async()=>{
  const page=await read('app/(app)/guestlist/page.tsx')
  const client=await read('components/crew/guestlist-entrance-client.tsx')
  const importRoute=await read('app/api/guestlist/import/route.ts')
  assert.match(page,/Inkom & Guestlist/)
  assert.match(page,/GuestlistImportForm/)
  assert.match(client,/event_guestlist_entries/)
  assert.match(client,/Zoek naam, artiest, guest of notitie/)
  assert.match(client,/upt_guestlist_checkin/)
  assert.match(client,/Artiesten aanwezig/)
  assert.match(importRoute,/\.xlsx/)
  assert.match(importRoute,/toMarkdown/)
  assert.match(importRoute,/\.pdf/)
  assert.match(importRoute,/\.docx/)
  assert.match(importRoute,/\.png/)
  assert.match(importRoute,/onbetrouwbare data/)
  assert.match(importRoute,/drinks/)
  assert.match(importRoute,/hospitality_notes/)
  assert.match(importRoute,/upt_guestlist_import/)
})

test('artist arrival immediately notifies backstage and writes the workplace chat',async()=>{
  const migration=await read('supabase/migrations/20260928101133_guestlist_backstage_artist_arrival.sql')
  assert.match(migration,/Artiest - '\|\|v_name\|\|', is aangekomen\.'/)
  assert.match(migration,/insert into public\.crew_notifications/)
  assert.match(migration,/kind='workplace'/)
  assert.match(migration,/insert into public\.messages/)
  assert.match(migration,/arrival_notified_at/)
  assert.match(migration,/artist_arrival_setup/)
})

test('backstage artist checklist carries drinks and preserves completed checks across imports',async()=>{
  const migration=await read('supabase/migrations/20260928101133_guestlist_backstage_artist_arrival.sql')
  const client=await read('components/crew/backstage-artist-checklist.tsx')
  assert.match(migration,/artist_backstage_checklists/)
  assert.match(migration,/drinks_ready/)
  assert.match(migration,/artist_received/)
  assert.match(migration,/v_row->>'drank'/)
  assert.match(migration,/coalesce\(nullif\(public\.artist_backstage_checklists\.drinks/)
  assert.doesNotMatch(migration,/set drinks_ready=false/)
  assert.match(client,/Drank klaar/)
  assert.match(client,/Artiest ontvangen/)
})

test('merch and token sales are transactional inventory movements with payment method',async()=>{
  const migration=await read('supabase/migrations/20260928101805_inventory_sales_cash_register.sql')
  const client=await read('components/crew/sales-register-client.tsx')
  assert.match(migration,/sale_category in\('merch','token'\)/)
  assert.match(migration,/p_payment_method not in\('cash','card'\)/)
  assert.match(migration,/available_quantity=available_quantity-p_quantity/)
  assert.match(migration,/total_quantity=total_quantity-p_quantity/)
  assert.match(migration,/insert into public\.sales_transactions/)
  assert.match(migration,/movement_type.*'sold'/s)
  assert.match(client,/Merch/)
  assert.match(client,/Tokens \/ Kassa/)
  assert.match(client,/CASH/)
  assert.match(client,/KAART/)
  assert.match(client,/✓ VERKOCHT/)
})

test('sales page is income-only per event with merch and token totals',async()=>{
  const page=await read('app/(app)/sales/page.tsx')
  assert.match(page,/Totale netto-inkomsten/)
  assert.match(page,/Merchandise-inkomsten/)
  assert.match(page,/Token- en kassaverkoop/)
  assert.match(page,/sales_transactions/)
  assert.doesNotMatch(page,/Kassa begininhoud/)
  assert.doesNotMatch(page,/EXCEL SALES DOWNLOADEN/)
  assert.doesNotMatch(page,/TERUGBOEKEN/)
})

test('admin AI receives guestlist artist backstage sales and register context',async()=>{
  const route=await read('app/api/admin-assistant/route.ts')
  const assistant=await read('components/admin/platform-ai-assistant.tsx')
  const guestlistPage=await read('app/(app)/guestlist/page.tsx')
  assert.match(route,/event_guestlist_entries/)
  assert.match(route,/artist_backstage_checklists/)
  assert.match(route,/sales_transactions/)
  assert.match(route,/sales_registers/)
  assert.match(route,/artistPresence/)
  assert.match(route,/cashRegisters/)
  assert.match(assistant,/<textarea/)
  assert.match(assistant,/setMessage\(e\.target\.value\)/)
  assert.doesNotMatch(assistant,/const quick=/)
  assert.match(guestlistPage,/PlatformAiAssistant/)
})

test('navigation exposes guestlist and sales with role scoped defaults',async()=>{
  const nav=await read('components/layout/navigation-items.ts')
  const roles=await read('lib/role-ui.ts')
  const layout=await read('components/layout/app-layout.tsx')
  assert.match(nav,/key:"guestlist".*href:"\/guestlist"/)
  assert.match(nav,/key:"sales".*href:"\/sales"/)
  assert.match(roles,/navRule\("staff","guestlist","Inkom & Guestlist".*"assigned_event"/)
  assert.match(roles,/navRule\("staff","sales","Verkoop".*"assigned_workplace_role"/)
  assert.match(roles,/navRule\("admin","sales","Sales"/)
  assert.match(layout,/pathname\.startsWith\("\/guestlist"\)\?"guestlist"/)
  assert.match(layout,/pathname\.startsWith\("\/sales"\)\?"sales"/)
  assert.match(layout,/guestlist:showGuestlist/)
  assert.match(layout,/sales:showSales/)
})


test('admin main dashboard exposes the AI assistant',async()=>{
  const admin=await read('app/(app)/admin/page.tsx')
  assert.match(admin,/PlatformAiAssistant/)
  assert.match(admin,/components\/admin\/platform-ai-assistant/)
})


test('bar counter merch and token workplaces expose translated price-list input and upload',async()=>{
  const [page,workplaces,translations,actions]=await Promise.all([
    read('app/(app)/sales/page.tsx'),
    read('app/(app)/workplaces/page.tsx'),
    read('lib/ui-translation-catalog-app-extra.ts'),
    read('lib/actions/uptilldawn.ts'),
  ])
  assert.match(page,/Prijslijst invoeren/)
  assert.match(page,/price_list_text/)
  assert.match(page,/PRIJSLIJST UPLOADEN/)
  assert.match(page,/\.pdf,\.docx,\.pptx,\.xlsx,\.txt,\.csv,\.jpg,\.jpeg,\.png,\.webp/)
  assert.match(page,/counter\|comptoir\|theke/)
  assert.match(page,/if\(params\.workplace\)salesWorkplaces=salesWorkplaces\.filter/)
  assert.match(workplaces,/Prijslijst & Sales/)
  assert.match(translations,/"Bar \/ Toog": \{fr:"Bar \/ Comptoir",en:"Bar \/ Counter",de:"Bar \/ Theke"\}/)
  assert.match(translations,/"Prijslijst & Sales":/)
  assert.match(actions,/createPriceListTextEntry/)
  assert.match(actions,/createPriceListDocument/)
})
