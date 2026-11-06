import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const hub=readFileSync('app/(app)/admin/management/page.tsx','utf8')
const dashboard=readFileSync('app/(app)/admin/page.tsx','utf8')
test('admin management hub is authenticated and linked from dashboard',()=>{
 assert.ok(hub.includes('getCurrentUser()'))
 assert.ok(hub.includes('!actor?.isAdmin'))
 assert.ok(hub.includes('actor.account_blocked'))
 assert.ok(dashboard.includes('href="/admin/management"'))
})
test('management hub links to existing admin routes and guarded promotion workflows',()=>{
 for(const href of ['/personnel','/admin/time-records','/shifts','/tasks','/events','/crew','/inventory','/incidents','/admin/platform','/sales','/exports'])assert.ok(hub.includes('href:"'+href+'"'))
 for(const href of ['/portals/administration/promotion-tasks','/admin/management/promotion-discipline'])assert.ok(hub.includes('href:"'+href+'"'))
 const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')
 assert.ok(layout.includes('!user.isOwner&&!user.realIsAdmin'))
 assert.ok(layout.includes('canOpenPortal("administration"'))
})
