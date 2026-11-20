import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('inventory end workflow remains pre-event capable and workplace scoped',async()=>{
 const [page,catalog,materials]=await Promise.all([
  read('app/(app)/inventory/page.tsx'),
  read('components/crew/workplace-catalog-inventory.tsx'),
  read('components/crew/workplace-inventory-materials.tsx'),
 ])
 assert.match(page,/workplace_catalog/)
 assert.match(page,/workplace_catalog_items/)
 assert.match(catalog,/Nieuwe evenementen krijgen deze actieve werkplekken en materialen automatisch mee/)
 assert.match(materials,/OPSTARTCONTROLE/)
 assert.match(materials,/SLUITCONTROLE/)
 assert.match(materials,/phase="opening"/)
 assert.match(materials,/phase="closing"/)
 assert.match(materials,/missing/)
 assert.match(materials,/damaged/)
})

test('guestlist end workflow supports manual entry document import search artist guest spots and realtime checkin',async()=>{
 const [page,client,importer]=await Promise.all([
  read('app/(app)/guestlist/page.tsx'),
  read('components/crew/guestlist-entrance-client.tsx'),
  read('components/crew/guestlist-import-form.tsx'),
 ])
 assert.match(page,/addGuestlistEntry/)
 assert.match(page,/GuestlistImportForm/)
 assert.match(client,/Zoek naam, artiest, guest of notitie/)
 assert.match(client,/spots_total/)
 assert.match(client,/spots_checked_in/)
 assert.match(client,/upt_guestlist_checkin/)
 assert.match(client,/entry_type==='artist'/)
 assert.match(importer,/humanizeAppError\(error\)/)
})

test('inventory and guestlist user-facing static text stays under four-language release gate',async()=>{
 const coverage=await read('tests/i18n-static-ui-coverage.test.mjs')
 assert.match(coverage,/every static user-facing UI string has NL\/FR\/EN\/DE coverage/)
 assert.match(coverage,/roots=\['app','components'\]/)
})
