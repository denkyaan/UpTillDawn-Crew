import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const role=readFileSync('components/layout/mobile-nav.tsx','utf8')
const administration=readFileSync('components/administration/administration-navigation.tsx','utf8')
test('route changes leave mobile subtabs collapsed while active category remains highlighted',()=>{
 assert.match(role,/selectedGroup\?\.pathname===pathname&&availableGroups\.some\(group=>group\.key===selectedGroup\.key\)\?selectedGroup\.key:"home"/)
 assert.match(role,/activeGroup==="home"&&currentGroup===group\.key/)
 assert.match(role,/aria-expanded=\{group\.key==="home"\?undefined:activeGroup===group\.key\}/)
 assert.match(role,/data-role-category=\{group\.key\} aria-pressed=\{active\}/)
})
test('administration navigation does not open the panel merely because a module route is active',()=>{
 assert.match(administration,/selectedCategory\?\.pathname===pathname\?selectedCategory\.key:"overview"/)
 assert.match(administration,/selected\.key==="overview"&&group\.key===current/)
 assert.match(administration,/const visible=selected\.key!=="overview"/)
})

test('subtab selection closes role and administration panels immediately',()=>{
 assert.match(role,/setSelectedGroup\(\{key:"home",pathname\}\)/)
 assert.match(administration,/onClick=\{\(\)=>setSelectedCategory\(null\)\}/)
})
