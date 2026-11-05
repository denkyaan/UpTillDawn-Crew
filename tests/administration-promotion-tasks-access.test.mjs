import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')

test('authorized administration personnel can open promotion tasks through portal layout',()=>{
 assert.match(layout,/canOpenPortal\("administration"/)
 assert.match(page,/getCurrentUser\(\)/)
 assert.doesNotMatch(page,/!actor\.isAdmin&&!actor\.isOwner/)
 assert.match(page,/href="\/portals\/administration\/promotion-discipline"/)
})
