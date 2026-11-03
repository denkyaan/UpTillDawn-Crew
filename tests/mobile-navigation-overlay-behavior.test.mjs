import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const mobile=readFileSync('components/layout/mobile-nav.tsx','utf8')
const shell=readFileSync('components/layout/app-layout.tsx','utf8')
test('role overview uses Next client navigation rather than document reload',()=>{
 assert.match(mobile,/usePathname, useRouter/)
 assert.match(mobile,/router\.push\(isAdmin\?"\/admin":"\/"\)/)
 assert.doesNotMatch(mobile,/window\.location\.assign/)
})
test('floating chat and AI both clear the expanded subtab area',()=>{
 assert.match(shell,/showFloatingChat=showChat&&!inDedicatedPortal&&!navigationExpanded/)
 assert.match(shell,/isAdmin&&!navigationExpanded/)
 assert.match(shell,/uptilldawn-navigation-expanded/)
})
