import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(path,'utf8')
const common=read('app/(app)/notifications/page.tsx')
const admin=read('app/(app)/portals/administration/modules/notifications/page.tsx')
const promotion=read('app/(app)/portals/promotion/notifications/page.tsx')

test('shared inbox keeps filters and pagination inside the selected portal',()=>{
  assert.match(common,/scope===\x27administration\x27\?\x27\/portals\/administration\/modules\/notifications\x27/)
  assert.match(common,/scope===\x27promotion\x27\?\x27\/portals\/promotion\/notifications\x27/)
  assert.match(common,/const scopedSuffix=scope\?\x27&scope=\x27\+scope/)
  assert.match(common,/const pageHref=.*selectedView/)
  assert.match(common,/const viewHref=/)
  assert.match(common,/selectedView===\x27unread\x27\?notificationQuery\.is/)
})

test('Administration wrapper forwards the requested view with its access gate',()=>{
  assert.match(admin,/administrationAccess\(\)/)
  assert.match(admin,/if\(!access\.ok\)redirect\(\x27\/portals\x27\)/)
  assert.match(admin,/const \{page,view\}=await searchParams/)
  assert.match(admin,/\{page,view,scope:\x27administration\x27\}/)
})

test('Promotion wrapper preserves view and paging in the promotion portal',()=>{
  assert.match(promotion,/const \{page,view\}=await searchParams/)
  assert.match(promotion,/\{page,view,scope:\x27promotion\x27\}/)
})
