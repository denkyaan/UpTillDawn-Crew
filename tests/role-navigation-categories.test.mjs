import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const nav=readFileSync('components/layout/mobile-nav.tsx','utf8')
const items=readFileSync('components/layout/navigation-items.ts','utf8')
test('role categories preserve existing visibility and permission filters',()=>{
 assert.match(nav,/Object\.prototype\.hasOwnProperty\.call\(featureVisibility,i\.key\)/)
 assert.match(nav,/roles\.some\(r=>i\.roles\.includes\(r\)\)/)
 assert.match(nav,/availableGroups=groupedNavigation/)
 assert.match(nav,/filter\(group=>group\.entries\.length>0\)/)
})
test('role category navigation has bounded subtab height and active route fallback',()=>{
 assert.match(nav,/max-h-\[38dvh\]/)
 assert.match(nav,/currentGroup=availableGroups\.find/)
 assert.match(nav,/activeGroup=selectedGroup\?\.pathname===pathname&&availableGroups\.some/)
 assert.match(nav,/role-navigation-subtabs/)
})
test('each role navigation category points to known feature keys',()=>{
 const keys=[...items.matchAll(/\{ key:"([^"]+)", href:/g)].map(m=>m[1])
 const section=nav.slice(nav.indexOf('const groupedNavigation='),nav.indexOf('const availableGroups='))
 for(const match of section.matchAll(/keys:\[([^\]]+)\]/g)){
  for(const key of match[1].matchAll(/"([^"]+)"/g))assert.ok(keys.includes(key[1]),'Unknown feature '+key[1])
 }
})
