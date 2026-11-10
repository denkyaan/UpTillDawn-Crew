import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const actions=readFileSync('lib/actions/uptilldawn.ts','utf8')
const notification=readFileSync('app/(app)/notifications/page.tsx','utf8')
const administration=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')

test('bulk-read uses scoped RPC and fixed snapshot, never broad table UPDATE',()=>{
 const start=actions.indexOf('export async function markAllNotificationsRead()')
 const end=actions.indexOf('export async function archiveEvent(',start)
 const body=actions.slice(start,end)
 assert.ok(start>0&&end>start)
 assert.match(body,/s\.auth\.getUser\(\)/)
 assert.match(body,/\.eq\('user_id',user\.id\)\.is\('read_at',null\)/)
 assert.match(body,/\.lte\('created_at',cutoff\)/)
 assert.match(body,/\.limit\(50\)/)
 assert.match(body,/offset\+=5/)
 assert.match(body,/rpc\('upt_mark_notification_read',\{p_notification:row\.id\}\)/)
 assert.match(body,/for\(const result of results\)check\(result\.error\)/)
 assert.doesNotMatch(body,/\.update\(|service_role|adminClient/)
})
test('all three inbox routes refresh and provide one-click unread clearing',()=>{
 for(const href of ['/notifications','/portals/administration/modules/notifications','/portals/promotion/notifications'])assert.ok(actions.includes("revalidatePath('"+href+"')"))
 assert.match(notification,/form action=\{markAllNotificationsRead\}/)
 assert.match(notification,/!error&&!badgeError&&\(badgeCount\?\?0\)>0/)
 assert.match(notification,/PendingSubmitButton/)
 for(const text of ['alle pagina’s','toutes les pages','all pages','alle Seiten'])assert.ok(notification.includes(text),text)
 assert.match(administration,/await markAllNotificationsRead\(\)/)
 assert.match(administration,/db\.rpc\('upt_mark_notification_read',\{p_notification:id\}\)/)
 assert.doesNotMatch(administration,/from\('crew_notifications'\)\.update/)
})
