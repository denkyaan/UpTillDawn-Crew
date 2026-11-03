import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const admin=readFileSync('components/administration/administration-navigation.tsx','utf8')
const mobile=readFileSync('components/layout/mobile-nav.tsx','utf8')
const shell=readFileSync('components/layout/app-layout.tsx','utf8')
test('administration overview navigates client-side without a full page reload',()=>{
 assert.match(admin,/usePathname,useRouter/)
 assert.match(admin,/router\.push\("\/portals\/administration"\)/)
 assert.doesNotMatch(admin,/window\.location\.(?:assign|href|replace)/)
})
test('mobile and administration tabs communicate their expansion to the AI overlay',()=>{
 assert.match(admin,/uptilldawn-navigation-expanded/)
 assert.match(mobile,/uptilldawn-navigation-expanded/)
 assert.match(shell,/!navigationExpanded/)
 assert.match(shell,/uptilldawn-navigation-expanded/)
})
test('mobile subtabs stay bounded and long labels can wrap',()=>{
 assert.match(admin,/max-h-\[38dvh\]/)
 assert.match(admin,/break-words leading-tight/)
 assert.match(mobile,/max-h-\[38dvh\]/)
})
