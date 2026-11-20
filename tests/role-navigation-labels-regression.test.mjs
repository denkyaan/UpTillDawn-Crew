import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const mobile=readFileSync('components/layout/mobile-nav.tsx','utf8')
const desktop=readFileSync('components/layout/sidebar.tsx','utf8')
test('incident reports and help centre remain separate and unambiguous in both layouts',()=>{
 for(const source of [mobile,desktop]){
  assert.match(source,/Incidenten/)
  assert.match(source,/Helpcentrum/)
  assert.match(source,/Incidents/)
  assert.match(source,/Help centre/)
  assert.match(source,/Hilfezentrum/)
 }
})
test('mobile subtab titles wrap instead of being truncated',()=>{
 assert.match(mobile,/max-w-full break-words text-center leading-tight/)
})
test('desktop category selection resets to the route category after navigation',()=>{
 assert.match(desktop,/selectedGroup\?\.pathname===pathname/)
 assert.match(desktop,/setSelectedGroup\(\{key:group\.key,pathname\}\)/)
})
