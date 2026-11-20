import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const role=readFileSync('components/layout/mobile-nav.tsx','utf8')
const admin=readFileSync('components/administration/administration-navigation.tsx','utf8')
const sidebar=readFileSync('components/layout/sidebar.tsx','utf8')
test('mobile active-route matching respects pathname boundaries and ignores query parameters',()=>{
 assert.match(role,/href\.split\('\?'\)\[0\]/)
 assert.match(role,/pathname===path\|\|pathname\.startsWith\(path\+'\/'\)/)
})
test('Escape closes subtab panels across mobile, administration and desktop layouts',()=>{
 for(const source of [role,admin,sidebar]){
  assert.match(source,/event\.key==="Escape"/)
  assert.match(source,/window\.addEventListener\("keydown",onKey\)/)
  assert.match(source,/window\.removeEventListener\("keydown",onKey\)/)
 }
})
