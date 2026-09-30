import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('admin overview degrades per datasource instead of blanking the dashboard',async()=>{
 const source=await read('app/(app)/admin/page.tsx')
 assert.match(source,/failedOverviewSources/)
 assert.doesNotMatch(source,/results\.some\(x=>x\.error\).*Overzichtsgegevens konden niet volledig worden geladen/s)
 assert.match(source,/De beschikbare onderdelen blijven bruikbaar/)
})
test('mobile admin AI sits above bottom navigation and chat stacks above it',async()=>{
 const [layout,chat]=await Promise.all([read('components/layout/app-layout.tsx'),read('components/layout/floating-chat-button.tsx')])
 assert.match(layout,/fixed bottom-20 right-4/)
 assert.match(layout,/stackedAboveAdminAi=\{Boolean\(isAdmin\)\}/)
 assert.match(chat,/stackedAboveAdminAi \? "9\.5rem" : "5rem"/)
})
