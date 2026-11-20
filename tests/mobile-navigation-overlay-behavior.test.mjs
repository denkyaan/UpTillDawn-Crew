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
test('floating chat clears the expanded subtab area, and only the AI panel closes',()=>{
 assert.match(shell,/showFloatingChat=showChat&&!inDedicatedPortal&&!navigationExpanded/)
 assert.match(shell,/const adminAiVisible=isAdmin\|\|administrationPortal/)
 assert.match(shell,/const adminAiAction=adminAiVisible\?/)
 assert.match(shell,/uptilldawn-navigation-expanded/)
 assert.match(shell,/if\(open\)setAdminAiOpen\(false\)/)
})
