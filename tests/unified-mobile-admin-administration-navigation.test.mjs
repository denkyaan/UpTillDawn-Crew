import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('Administration, crew and promotion use the same mobile bottom-tab styling',()=>{
 const [administration,crew,promotion]=['components/administration/administration-navigation.tsx','components/layout/mobile-nav.tsx','components/promotion/promotion-bottom-nav.tsx'].map(read)
 for(const source of [administration,crew,promotion]){
  assert.match(source,/fixed inset-x-0 bottom-0/)
  assert.match(source,/bg-card pb-\[env\(safe-area-inset-bottom\)\]/)
  assert.match(source,/bg-violet-500\/15 text-violet-400/)
 }
 for(const source of [administration,crew]){
  assert.match(source,/grid-cols-3 gap-1\.5 max-h-\[38dvh\]/)
  assert.match(source,/mb-2 block text-xs/)
 }
 assert.match(crew,/expandedItem\?\(active\?"border-violet-500 text-violet-400":"border-border"\)/)
})
test('distinct Administration tools are assigned to existing Admin groups only once',()=>{
 const navigationConfig=read('lib/admin-administration-navigation.ts')
 const nav=read('components/layout/mobile-nav.tsx')
 const sidebar=read('components/layout/sidebar.tsx')
 const entries=[...navigationConfig.matchAll(/\{key:"(admin-[^"]+)",slug:"([^"]+)",group:"([^"]+)"\}/g)]
 assert.equal(entries.length,17)
 assert.equal(new Set(entries.map(item=>item[1])).size,17)
 assert.equal(new Set(entries.map(item=>item[2])).size,17)
 for(const group of ['events','work','team','support','manage']){
  assert.ok(nav.includes('...adminAdministrationGroupKeys.'+group))
  assert.ok(sidebar.includes('...adminAdministrationGroupKeys.'+group))
 }
 for(const slug of ['artists','contracts','rosters','permits','timesheets','logistics','promotion-tasks','promotion-discipline','finance','invoices','banking','ticketing','reports','documents','counterparties','sponsors','marketing'])
  assert.ok(entries.some(item=>item[2]===slug),slug)
 assert.ok(!entries.some(item=>item[2]==='contacts'),'Contacts is a canonical alias only')
 for(const slug of ['events','tasks','sales','inventory','chat','settings','automations','ai','notifications','personnel'])
  assert.ok(!entries.some(item=>item[2]===slug),'duplicate '+slug)
 const navItems=read('components/layout/navigation-items.ts')
 assert.match(navItems,/\.\.\.adminAdministrationSubtabs\.map/)
 assert.match(navItems,/roles:\["admin"\]/)
})
test('chat is lower and respects iOS safe area above bottom navigation',()=>{
 const chat=read('components/layout/floating-chat-button.tsx')
 assert.match(chat,/bottom: stackedAboveAdminAi \? "calc\(5\.5rem \+ env\(safe-area-inset-bottom\)\)" : "calc\(5rem \+ env\(safe-area-inset-bottom\)\)"/)
 assert.match(chat,/touch-none select-none/)
})
