import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('ticketing exposes mapping management alongside imports',()=>{
 const page=read('../app/(app)/portals/administration/modules/[slug]/page.tsx')
 assert.match(page,/ProviderMappingManager/)
 assert.match(page,/TicketImportPreview/)
})
test('provider mapping manager supports four languages and secure API operations',()=>{
 const ui=read('../components/administration/provider-mapping-manager.tsx')
 for(const locale of ['nl','fr','en','de'])assert.match(ui,new RegExp('\\b'+locale+':\\{'))
 assert.match(ui,/method:"POST"/);assert.match(ui,/method:"PATCH"/)
 assert.match(ui,/disabled=\{busy/)
})
