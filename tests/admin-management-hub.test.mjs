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
 for(const href of ['/admin/management/promotion-tasks','/admin/management/promotion-discipline'])assert.ok(hub.includes('href:"'+href+'"'))
 const layout=readFileSync('app/(app)/portals/administration/layout.tsx','utf8')
 assert.ok(layout.includes('!user.isOwner&&!user.realIsAdmin'))
 assert.ok(layout.includes('canOpenPortal("administration"'))
})

test('admin promotion moderation stays in admin route and invalidates both portal views',()=>{
 const adminRoute=readFileSync('app/(app)/admin/management/promotion-discipline/page.tsx','utf8')
 const moderation=readFileSync('app/(app)/portals/administration/promotion-discipline/page.tsx','utf8')
 assert.ok(adminRoute.includes('export default PromotionDisciplinePage'))
 assert.ok(adminRoute.includes('portals/administration/promotion-discipline/page'))
 assert.ok(hub.includes('href:"/admin/management/promotion-discipline"'))
 assert.equal(moderation.split('revalidatePath("/admin/management/promotion-discipline")').length-1,3)
 assert.ok(moderation.includes('actor.realIsAdmin'))
})

test('native admin promotion tasks preserve search, pagination and privileged access',()=>{
 const route=readFileSync('app/(app)/admin/management/promotion-tasks/page.tsx','utf8')
 const shared=readFileSync('app/(app)/portals/administration/promotion-tasks/page.tsx','utf8')
 assert.ok(route.includes('adminView'))
 assert.ok(shared.includes('if(adminView&&('))
 assert.ok(shared.includes('const basePath=adminView?"/admin/management/promotion-tasks"'))
 assert.ok(shared.includes('action={basePath}'))
 assert.ok(shared.includes('href={pageHref(page+1)}'))
 assert.ok(shared.includes('"/admin/management/promotion-discipline"'))
 assert.equal(shared.split('revalidatePath("/admin/management/promotion-tasks")').length-1,2)
})
