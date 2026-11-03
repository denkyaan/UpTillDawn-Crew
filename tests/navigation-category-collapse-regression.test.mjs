import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const mobile=readFileSync('components/layout/mobile-nav.tsx','utf8')
const administration=readFileSync('components/administration/administration-navigation.tsx','utf8')
const shell=readFileSync('components/layout/app-layout.tsx','utf8')
test('role subtab categories toggle closed on a second tap even on nested routes',()=>{
 assert.match(mobile,/previous\?\.pathname===pathname&&previous\.key===group\.key\?"home":group\.key/)
 assert.match(mobile,/activeGroup=selectedGroup\?\.pathname===pathname/)
})
test('administration subtab categories toggle closed on a second tap even on module routes',()=>{
 assert.match(administration,/previous\?\.pathname===pathname&&previous\.key===group\.key\?\{key:"overview",pathname\}/)
 assert.match(administration,/selectedCategory\?\.pathname===pathname/)
})
test('expanding subtabs closes the AI dialog so it does not reappear unexpectedly',()=>{
 assert.match(shell,/if\(open\)setAdminAiOpen\(false\)/)
 assert.match(shell,/isAdmin&&!navigationExpanded/)
})
