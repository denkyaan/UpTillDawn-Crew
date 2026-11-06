import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const modulePage=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
const inventoryPage=readFileSync('app/(app)/portals/administration/modules/inventory/page.tsx','utf8')
const disciplinePage=readFileSync('app/(app)/portals/administration/promotion-discipline/page.tsx','utf8')
const browserTest=readFileSync('scripts/administration-full-browser-e2e.mjs','utf8')

test('inventory preserves event search params and applies event scope to records and counts',()=>{
 assert.match(inventoryPage,/searchParams/)
 assert.match(inventoryPage,/AdministrationModulePage\(\{params:Promise\.resolve\(\{slug:"inventory"\}\),searchParams\}\)/)
 assert.match(modulePage,/const selectedEvent=slug==="inventory"/)
 assert.match(modulePage,/inventory_items"\)\.select\("id",\{count:"exact",head:true\}\)\.eq\("event_id",selectedEvent\)/)
 assert.match(modulePage,/inventory_items"\)\.select\("id,name,missing_quantity,damaged_quantity,event_id"\)\.eq\("event_id",selectedEvent\)/)
 assert.match(modulePage,/inventory\?event=\$\{encodeURIComponent\(event\.id\)\}/)
 assert.match(browserTest,/u\.pathname\+u\.search===expectedClickedPath/)
})

test('office staff cannot follow admin-only promotion discipline navigation',()=>{
 assert.match(modulePage,/\(current\.realIsAdmin\|\|current\.isOwner\).*href="\/portals\/administration\/promotion-discipline"/)
 assert.match(disciplinePage,/actor\\.realIsAdmin&&!actor\\.isOwner/)
 assert.match(disciplinePage,/actor\\.realIsAdmin&&!actor\\.isOwner/)
})
