import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const mobile=readFileSync('components/layout/mobile-nav.tsx','utf8')
const desktop=readFileSync('components/layout/sidebar.tsx','utf8')
const administration=readFileSync('components/administration/administration-navigation.tsx','utf8')

test('operational role navigation never enables the retired tour or training sandbox',()=>{
 for(const legacy of ['tourPreview','tour=1','uptilldawn-tour-preview','uptilldawn-training-nav-target','uptilldawn-training-workflow-v3','trainingLocked','sandboxHelp']){
  assert.ok(!mobile.includes(legacy),'Retired navigation behavior: '+legacy)
 }
 assert.match(mobile,/Object\.prototype\.hasOwnProperty\.call\(featureVisibility,i\.key\)/)
 assert.match(mobile,/roles\.some\(r=>i\.roles\.includes\(r\)\)/)
 assert.doesNotMatch(mobile,/if\(!tourPreview\)/)
})
test('all role subtabs retain translated labels, actual links and the visibility rules',()=>{
 for(const locale of ['nl:','fr:','en:','de:'])assert.ok(mobile.includes(locale))
 assert.match(mobile,/href=\{href\}/)
 assert.match(mobile,/aria-current=\{active\?"page":undefined\}/)
 assert.match(mobile,/aria-description=\{help\.description\}/)
 assert.match(mobile,/max-h-\[38dvh\]/)
 assert.match(mobile,/setSelectedGroup\(\{key:"home",pathname\}\)/)
 assert.match(mobile,/uptilldawn-navigation-expanded/)
})
test('desktop and mobile Home navigate client-side to the correct role dashboard',()=>{
 for(const source of [mobile,desktop]){
  assert.match(source,/router\.push\(isAdmin\?"\/admin":"\/"\)/)
  assert.doesNotMatch(source,/window\.location\.(?:assign|href|replace)/)
 }
})
test('administration keeps its own context-preserving subtab panel',()=>{
 assert.match(administration,/onClick=\{\(\)=>setSelectedCategory\(null\)\}/)
 assert.match(administration,/uptilldawn-navigation-expanded/)
})

test('live event and shift context ranks permitted subtab destinations without showing hidden features',()=>{
 for(const symbol of ['ASSIGNED_EVENT_KEYS','STAFF_ACTIVE_SHIFT_KEYS','RESPONSIBLE_ACTIVE_SHIFT_KEYS','RESPONSIBLE_ASSIGNED_EVENT_KEYS'])assert.ok(mobile.includes(symbol))
 assert.match(mobile,/roleKey==="responsible_lead"/)
 assert.match(mobile,/contextualKeys\.map\(\(key,index\)=>\[key,index\]\)/)
 assert.match(mobile,/priority\.get\(a\.key\)/)
 assert.match(mobile,/min-h-14/)
 assert.match(mobile,/roles\.some\(r=>i\.roles\.includes\(r\)\)/)
})
